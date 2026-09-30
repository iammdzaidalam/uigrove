export interface DynamicIslandBox {
  width: number
  height: number
  radius: number
}

export interface DynamicIslandSpring {
  stiffness: number
  damping: number
  mass: number
}

export interface DynamicIslandLayerFrame {
  opacity: number
  blur: number
  scale: number
}

interface Channel {
  value: number
  velocity: number
  target: number
}

interface Layer {
  id: number
  start: number
}

const FADE_DELAY = 36
const POP_DELAY = 52
const FADE_MS = 300
const ENTER_MS = 440
const SCALE_FROM = 0.9
const BLUR_FROM = 5
const POP_STIFFNESS = 550
const POP_DAMPING = 30
const SETTLE_EPSILON = 0.001
// Critical damping reaches a thousandth once omega times duration hits this
const CRITICAL_SPAN = 9.2335
const REST_DELTA = 0.02
const REST_SPEED = 0.5

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x
      const slope = slopeX(t)
      if (Math.abs(error) < 1e-6 || Math.abs(slope) < 1e-6) break
      t = clamp01(t - error / slope)
    }
    return ((ay * t + by) * t + cy) * t
  }
}

const fade = cubicBezier(0.25, 0.1, 0.35, 1)

// Closed-form damped oscillator: new offset and velocity after dt
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

const pop: DynamicIslandSpring = { stiffness: POP_STIFFNESS, damping: POP_DAMPING, mass: 1 }

// Spring whose envelope decays to a thousandth within duration ms
export function dynamicIslandSpring(bounce: number, duration: number): DynamicIslandSpring {
  const seconds = Math.max(duration, 10) / 1000
  const zeta = Math.min(1, Math.max(0.05, 1 - bounce))
  const omega =
    zeta >= 0.99
      ? CRITICAL_SPAN / seconds
      : Math.log(zeta / (SETTLE_EPSILON * Math.sqrt(1 - zeta * zeta))) / (zeta * seconds)
  return { stiffness: omega * omega, damping: 2 * zeta * omega, mass: 1 }
}

export function dynamicIslandEnter(ms: number): DynamicIslandLayerFrame {
  if (ms >= ENTER_MS) return { opacity: 1, blur: 0, scale: 1 }
  const eased = fade((ms - FADE_DELAY) / FADE_MS)
  const t = Math.max(0, ms - POP_DELAY) / 1000
  const offset = step(1 - SCALE_FROM, 0, t, pop).x
  return { opacity: eased, blur: BLUR_FROM * (1 - eased), scale: 1 - offset }
}

export class DynamicIslandEngine {
  idle = true
  private channels: [Channel, Channel, Channel]
  private spring: DynamicIslandSpring = dynamicIslandSpring(0.2, 800)
  private layers: Layer[] = []
  private time = 0

  constructor(box: DynamicIslandBox) {
    this.channels = [
      { value: box.width, velocity: 0, target: box.width },
      { value: box.height, velocity: 0, target: box.height },
      { value: box.radius, velocity: 0, target: box.radius },
    ]
  }

  get box(): DynamicIslandBox {
    const [width, height, radius] = this.channels
    return {
      width: Math.max(0, width.value),
      height: Math.max(0, height.value),
      radius: Math.max(0, radius.value),
    }
  }

  setTarget(box: DynamicIslandBox, spring: DynamicIslandSpring) {
    this.spring = spring
    const [width, height, radius] = this.channels
    width.target = box.width
    height.target = box.height
    radius.target = box.radius
    this.idle = this.settled()
  }

  jump(box: DynamicIslandBox) {
    const targets = [box.width, box.height, box.radius]
    this.channels.forEach((channel, i) => {
      channel.value = channel.target = targets[i] ?? channel.value
      channel.velocity = 0
    })
    this.idle = this.settled()
  }

  // Old content leaves at once, only the new layer animates
  show(id: number, animate: boolean) {
    this.layers = [{ id, start: animate ? this.time : this.time - ENTER_MS }]
    this.idle = this.settled()
  }

  frame(id: number): DynamicIslandLayerFrame {
    const layer = this.layers.find((l) => l.id === id)
    if (!layer) return { opacity: 1, blur: 0, scale: 1 }
    return dynamicIslandEnter(this.time - layer.start)
  }

  visibleLayers() {
    return this.layers.map((layer) => layer.id)
  }

  finish() {
    for (const channel of this.channels) {
      channel.value = channel.target
      channel.velocity = 0
    }
    for (const layer of this.layers) layer.start = this.time - ENTER_MS
    this.idle = true
  }

  tick(dt: number) {
    this.time += dt * 1000
    for (const channel of this.channels) {
      if (channel.value === channel.target && channel.velocity === 0) continue
      const next = step(channel.value - channel.target, channel.velocity, dt, this.spring)
      if (Math.abs(next.x) < REST_DELTA && Math.abs(next.v) < REST_SPEED) {
        channel.value = channel.target
        channel.velocity = 0
      } else {
        channel.value = channel.target + next.x
        channel.velocity = next.v
      }
    }
    this.idle = this.settled()
  }

  private settled() {
    const still = this.channels.every((c) => c.value === c.target && c.velocity === 0)
    return still && this.layers.every((l) => this.time - l.start >= ENTER_MS)
  }
}
