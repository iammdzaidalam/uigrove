import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface GooeyDotsOptions {
  count: number
  size: number
  sizeVariance: number
  color: string
  speed: number
  wander: number
  cursorRadius: number
  cursorMode: 'attract' | 'repel' | 'none'
  cursorStrength: number
  seed: number
}

const TAU = Math.PI * 2
const SETTLE = 0.05

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class GooeyDotsEngine implements DotCanvasEngine {
  idle = false
  options: GooeyDotsOptions
  private width = 0
  private height = 0
  private count = 0
  private pos = new Float32Array(0)
  private vel = new Float32Array(0)
  private radii = new Float32Array(0)
  private phase = new Float32Array(0)
  private pointerX = 0
  private pointerY = 0
  private pointerActive = false
  private time = 0

  constructor(options: GooeyDotsOptions) {
    this.options = options
  }

  setOptions(options: GooeyDotsOptions) {
    const rebuild =
      options.count !== this.options.count ||
      options.seed !== this.options.seed ||
      options.size !== this.options.size ||
      options.sizeVariance !== this.options.sizeVariance
    this.options = options
    if (rebuild) this.build()
    this.idle = false
  }

  resize(width: number, height: number) {
    const first = this.width === 0
    this.width = width
    this.height = height
    if (first || this.count !== this.options.count) this.build()
    else this.clampInside()
  }

  private build() {
    const { count, size, sizeVariance, seed } = this.options
    const rand = mulberry32(seed)
    this.count = count
    this.pos = new Float32Array(count * 2)
    this.vel = new Float32Array(count * 2)
    this.radii = new Float32Array(count)
    this.phase = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      this.pos[i * 2] = rand() * this.width
      this.pos[i * 2 + 1] = rand() * this.height
      this.radii[i] = size * (1 + (rand() * 2 - 1) * sizeVariance)
      this.phase[i * 2] = rand() * TAU
      this.phase[i * 2 + 1] = rand() * TAU
    }
    this.idle = false
  }

  private clampInside() {
    for (let i = 0; i < this.count; i++) {
      this.pos[i * 2] = Math.min(this.pos[i * 2]!, this.width)
      this.pos[i * 2 + 1] = Math.min(this.pos[i * 2 + 1]!, this.height)
    }
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active
    this.idle = false
  }

  tick(dt: number) {
    const { speed, wander, cursorRadius, cursorMode, cursorStrength } = this.options
    const { pos, vel, phase, count, width, height } = this
    this.time += dt * speed
    const t = this.time
    const usePointer = this.pointerActive && cursorMode !== 'none'
    const sign = cursorMode === 'attract' ? 1 : -1
    const r2 = cursorRadius * cursorRadius
    const drift = wander * speed
    const damping = Math.exp(-2.2 * dt)
    let energy = 0

    for (let i = 0; i < count; i++) {
      const ix = i * 2
      const iy = ix + 1
      let x = pos[ix]!
      let y = pos[iy]!
      let vx = vel[ix]!
      let vy = vel[iy]!

      vx += Math.sin(t * 0.7 + phase[ix]!) * drift * dt
      vy += Math.cos(t * 0.9 + phase[iy]!) * drift * dt

      if (usePointer) {
        const dx = this.pointerX - x
        const dy = this.pointerY - y
        const d2 = dx * dx + dy * dy
        if (d2 < r2 && d2 > 1) {
          const d = Math.sqrt(d2)
          const f = ((1 - d / cursorRadius) * cursorStrength * sign) / d
          vx += dx * f * dt
          vy += dy * f * dt
        }
      }

      if (x < 0) vx += -x * 4 * dt
      else if (x > width) vx -= (x - width) * 4 * dt
      if (y < 0) vy += -y * 4 * dt
      else if (y > height) vy -= (y - height) * 4 * dt

      vx *= damping
      vy *= damping
      x += vx * dt
      y += vy * dt
      pos[ix] = x
      pos[iy] = y
      vel[ix] = vx
      vel[iy] = vy
      energy += Math.abs(vx) + Math.abs(vy)
    }

    this.idle = speed === 0 && energy < SETTLE * count
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { pos, radii, count } = this
    ctx.fillStyle = this.options.color
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const x = pos[i * 2]!
      const y = pos[i * 2 + 1]!
      const r = radii[i]!
      ctx.moveTo(x + r, y)
      ctx.arc(x, y, r, 0, TAU)
    }
    ctx.fill()
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    this.draw(ctx)
  }
}
