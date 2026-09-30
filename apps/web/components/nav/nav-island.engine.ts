import {
  dynamicIslandEnter,
  dynamicIslandSpring,
  type DynamicIslandLayerFrame,
  type DynamicIslandSpring,
} from '@uigrove/components/dynamic-island'

export interface NavRect {
  x: number
  y: number
  width: number
  height: number
}

interface Channel {
  value: number
  velocity: number
  target: number
}

const RECT_KEYS = ['x', 'y', 'width', 'height'] as const
// Matches the island engine's content enter length
const ENTER_MS = 440
const REST_DELTA = 0.02
const REST_SPEED = 0.5

// Closed-form damped oscillator, same maths as the island engine
function step(x: number, v: number, dt: number, spring: DynamicIslandSpring) {
  const omega = Math.sqrt(spring.stiffness / spring.mass)
  const zeta = spring.damping / (2 * Math.sqrt(spring.stiffness * spring.mass))
  if (zeta < 1) {
    const decay = zeta * omega
    const damped = omega * Math.sqrt(1 - zeta * zeta)
    const envelope = Math.exp(-decay * dt)
    const cos = Math.cos(damped * dt)
    const sin = Math.sin(damped * dt)
    return {
      x: envelope * (x * cos + ((v + decay * x) / damped) * sin),
      v: envelope * (v * cos - ((decay * v + omega * omega * x) / damped) * sin),
    }
  }
  const envelope = Math.exp(-omega * dt)
  const b = v + omega * x
  return { x: envelope * (x + b * dt), v: envelope * (v - omega * b * dt) }
}

function advance(channel: Channel, dt: number, spring: DynamicIslandSpring) {
  if (channel.value === channel.target && channel.velocity === 0) return
  const next = step(channel.value - channel.target, channel.velocity, dt, spring)
  if (Math.abs(next.x) < REST_DELTA && Math.abs(next.v) < REST_SPEED) {
    channel.value = channel.target
    channel.velocity = 0
  } else {
    channel.value = channel.target + next.x
    channel.velocity = next.v
  }
}

const still = (c: Channel) => c.value === c.target && c.velocity === 0

const channel = (value: number): Channel => ({ value, velocity: 0, target: value })

export class NavIslandEngine {
  idle = true
  private rect = { x: channel(0), y: channel(0), width: channel(0), height: channel(0) }
  private necks = [channel(0), channel(0)]
  private spring = dynamicIslandSpring(0.2, 800)
  private joinSpring = dynamicIslandSpring(0.3, 420)
  private releaseSpring = dynamicIslandSpring(0.25, 640)
  private dropSpring = dynamicIslandSpring(0.2, 360)
  private drop = channel(0)
  private layer = { id: '', start: -ENTER_MS }
  private time = 0

  get panel(): NavRect {
    const { x, y, width, height } = this.rect
    return {
      x: x.value,
      y: y.value,
      width: Math.max(0, width.value),
      height: Math.max(0, height.value),
    }
  }

  neck(index: number) {
    return this.necks[index]?.value ?? 0
  }

  get layerId() {
    return this.layer.id
  }

  setPanel(rect: NavRect) {
    for (const key of RECT_KEYS) this.rect[key].target = rect[key]
    this.idle = this.settled()
  }

  jumpPanel(rect: NavRect) {
    for (const key of RECT_KEYS) {
      const c = this.rect[key]
      c.value = c.target = rect[key]
      c.velocity = 0
    }
    this.idle = this.settled()
  }

  get dropX() {
    return this.drop.value
  }

  setNecks(targets: readonly number[], pointerX = this.drop.target) {
    // Teleport the drop when nothing is connected yet
    if (this.necks.every((c) => c.value <= 0.01)) {
      this.drop.value = pointerX
      this.drop.velocity = 0
    }
    this.drop.target = pointerX
    this.necks.forEach((c, i) => {
      c.target = targets[i] ?? 0
    })
    this.idle = this.settled()
  }

  show(id: string, animate: boolean) {
    this.layer = { id, start: animate ? this.time : this.time - ENTER_MS }
    this.idle = this.settled()
  }

  hide() {
    this.layer = { id: '', start: this.time - ENTER_MS }
    this.idle = this.settled()
  }

  frame(id: string): DynamicIslandLayerFrame {
    if (id !== this.layer.id) return { opacity: 0, blur: 0, scale: 1 }
    return dynamicIslandEnter(this.time - this.layer.start)
  }

  finish() {
    for (const c of [...Object.values(this.rect), ...this.necks, this.drop]) {
      c.value = c.target
      c.velocity = 0
    }
    this.layer.start = this.time - ENTER_MS
    this.idle = true
  }

  tick(dt: number) {
    this.time += dt * 1000
    for (const key of RECT_KEYS) advance(this.rect[key], dt, this.spring)
    for (const c of this.necks) {
      advance(c, dt, c.target < c.value ? this.releaseSpring : this.joinSpring)
    }
    advance(this.drop, dt, this.dropSpring)
    this.idle = this.settled()
  }

  private settled() {
    const rect = RECT_KEYS.every((key) => still(this.rect[key]))
    return (
      rect &&
      this.necks.every(still) &&
      still(this.drop) &&
      this.time - this.layer.start >= ENTER_MS
    )
  }
}
