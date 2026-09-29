export interface OrbitTilesEngineOptions {
  count: number
  speed: number
  instant: boolean
}

export interface OrbitTileLayout {
  x: number
  y: number
  scale: number
  depth: number
  z: number
}

type Mode = 'auto' | 'drag' | 'coast' | 'settle'

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const FRICTION = 2.6
const BLEND = 5
const SPRING = 90
const DAMPING = 2 * Math.sqrt(SPRING)
const REST = 0.0005
const LIFT = 0.55

// Places one tile on a tilted, rolled ring seen with perspective
export function orbitLayout(
  angle: number,
  index: number,
  count: number,
  radiusX: number,
  radiusY: number,
  tilt: number,
  roll: number,
  perspective: number,
): OrbitTileLayout {
  const a = angle + (index * TAU) / Math.max(1, count)
  const px = radiusX * Math.sin(a)
  const forward = radiusY * Math.cos(a)
  const tiltRad = tilt * DEG
  const rollRad = roll * DEG
  // Lift the ring so the front tile sits near the middle
  const py = forward * Math.sin(tiltRad) - radiusY * Math.sin(tiltRad) * LIFT
  const z = forward * Math.cos(tiltRad)
  const x = px * Math.cos(rollRad) - py * Math.sin(rollRad)
  const y = px * Math.sin(rollRad) + py * Math.cos(rollRad)
  const scale = perspective / Math.max(1, perspective - z)
  return { x: x * scale, y: y * scale, scale, depth: (Math.cos(a) + 1) / 2, z }
}

export class OrbitTilesEngine {
  angle = 0
  velocity = 0
  idle = false
  count: number
  speed: number
  instant: boolean
  hovered = false
  private mode: Mode = 'auto'
  private target = 0
  private dragDelta = 0

  constructor(options: OrbitTilesEngineOptions) {
    this.count = options.count
    this.speed = options.speed
    this.instant = options.instant
    this.velocity = this.autoVelocity
  }

  get step() {
    return TAU / Math.max(1, this.count)
  }

  private get autoVelocity() {
    return this.instant || this.hovered ? 0 : -this.speed * DEG
  }

  setOptions(next: Partial<OrbitTilesEngineOptions>) {
    if (next.count !== undefined) this.count = next.count
    if (next.speed !== undefined) this.speed = next.speed
    if (next.instant !== undefined) this.instant = next.instant
    if (this.instant && this.mode !== 'drag') {
      this.velocity = 0
      this.mode = 'auto'
    }
    this.idle = false
  }

  setHover(hovered: boolean) {
    this.hovered = hovered
    this.idle = false
  }

  dragStart() {
    this.mode = 'drag'
    this.velocity = 0
    this.dragDelta = 0
    this.idle = false
  }

  dragMove(dx: number, radiusX: number) {
    if (this.mode !== 'drag') return
    const delta = dx / Math.max(40, radiusX)
    this.angle += delta
    this.dragDelta += delta
  }

  dragEnd() {
    if (this.mode !== 'drag') return
    this.mode = this.instant ? 'auto' : 'coast'
    if (this.instant) this.velocity = this.autoVelocity
    this.idle = false
  }

  nudge(steps: number) {
    if (this.mode === 'drag') return
    const base = this.mode === 'settle' ? this.target : this.angle
    this.target = Math.round(base / this.step) * this.step - steps * this.step
    if (this.instant) {
      this.angle = this.target
      this.velocity = 0
      this.mode = 'auto'
    } else {
      this.mode = 'settle'
    }
    this.idle = false
  }

  tick(dt: number) {
    switch (this.mode) {
      case 'drag': {
        const sampled = this.dragDelta / Math.max(dt, 0.001)
        this.velocity += (sampled - this.velocity) * 0.5
        this.dragDelta = 0
        break
      }
      case 'coast': {
        this.angle += this.velocity * dt
        this.velocity *= Math.exp(-FRICTION * dt)
        if (Math.abs(this.velocity) < Math.abs(this.autoVelocity) + 0.05) this.mode = 'auto'
        break
      }
      case 'settle': {
        const diff = this.target - this.angle
        this.velocity += (SPRING * diff - DAMPING * this.velocity) * dt
        this.angle += this.velocity * dt
        if (Math.abs(diff) < 0.002 && Math.abs(this.velocity) < 0.01) {
          this.angle = this.target
          this.mode = 'auto'
        }
        break
      }
      case 'auto': {
        const goal = this.autoVelocity
        this.velocity += (goal - this.velocity) * (1 - Math.exp(-BLEND * dt))
        this.angle += this.velocity * dt
        break
      }
    }
    if (this.angle > TAU || this.angle < -TAU) this.angle %= TAU
    this.idle = this.mode === 'auto' && this.autoVelocity === 0 && Math.abs(this.velocity) < REST
  }
}
