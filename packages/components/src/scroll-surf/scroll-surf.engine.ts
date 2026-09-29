export type ScrollSurfVariant = 'magnetic' | 'uplift' | 'simple'

export interface ScrollSurfStep {
  x: number
  y: number
  z: number
}

export interface ScrollSurfEngineOptions {
  count: number
  copies: number
  scrollPerItem: number
  step: ScrollSurfStep
  variant: ScrollSurfVariant
  smoothing: number
  instant: boolean
}

export interface ScrollSurfTransform {
  x: number
  y: number
  z: number
}

export interface ScrollSurfCardState {
  scale: number
  lift: number
}

export interface SpringConfig {
  mass: number
  stiffness: number
  damping: number
}

export interface Spring {
  value: number
  velocity: number
}

interface Card {
  scale: Spring
  lift: Spring
  cx: number
  cy: number
}

export const hoverSpring: SpringConfig = { mass: 0.5, stiffness: 300, damping: 20 }
export const HOVER_REACH = 400
export const MAGNET_SCALE = 0.5
export const LIFT_PX = 100

const SCROLL_SETTLE = 0.01
const SCALE_SETTLE = 0.0005
const LIFT_SETTLE = 0.05

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// Track offset that puts card `progress` at the front
export function trackTransform(progress: number, step: ScrollSurfStep) {
  return { x: -progress * step.x, y: -progress * step.y, z: -progress * step.z }
}

export function cardTransform(index: number, step: ScrollSurfStep) {
  return { x: index * step.x, y: index * step.y, z: index * step.z }
}

// Card position relative to the camera, in scene pixels
export function surferTransform(
  progress: number,
  index: number,
  step: ScrollSurfStep,
): ScrollSurfTransform {
  const distance = index - progress
  return { x: distance * step.x, y: distance * step.y, z: distance * step.z }
}

// Exact damped spring solution, stable for any dt
export function stepSpring(spring: Spring, target: number, dt: number, config: SpringConfig) {
  const { mass, stiffness, damping } = config
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))
  const d = spring.value - target
  const v = spring.velocity
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const decay = Math.exp(-zeta * w0 * dt)
    const cos = Math.cos(wd * dt)
    const sin = Math.sin(wd * dt)
    const b = (v + zeta * w0 * d) / wd
    spring.value = target + decay * (d * cos + b * sin)
    spring.velocity = decay * ((b * wd - zeta * w0 * d) * cos - (d * wd + zeta * w0 * b) * sin)
    return
  }
  if (zeta === 1) {
    const decay = Math.exp(-w0 * dt)
    const b = v + w0 * d
    spring.value = target + decay * (d + b * dt)
    spring.velocity = decay * (b - w0 * (d + b * dt))
    return
  }
  const r = w0 * Math.sqrt(zeta * zeta - 1)
  const s1 = -zeta * w0 + r
  const s2 = -zeta * w0 - r
  const a = (v - s2 * d) / (s1 - s2)
  const b = d - a
  const e1 = Math.exp(s1 * dt)
  const e2 = Math.exp(s2 * dt)
  spring.value = target + a * e1 + b * e2
  spring.velocity = a * s1 * e1 + b * s2 * e2
}

function settle(spring: Spring, target: number, threshold: number) {
  if (Math.abs(spring.value - target) > threshold || Math.abs(spring.velocity) > threshold * 60) {
    return false
  }
  spring.value = target
  spring.velocity = 0
  return true
}

export class ScrollSurfEngine {
  target = 0
  current = 0
  idle = true
  hoverActive = false
  pointer: { x: number; y: number } | null = null
  count: number
  copies: number
  scrollPerItem: number
  step: ScrollSurfStep
  variant: ScrollSurfVariant
  smoothing: number
  instant: boolean
  private cards: Card[] = []

  constructor(options: ScrollSurfEngineOptions) {
    this.count = options.count
    this.copies = options.copies
    this.scrollPerItem = options.scrollPerItem
    this.step = options.step
    this.variant = options.variant
    this.smoothing = options.smoothing
    this.instant = options.instant
    this.allocate()
  }

  get cardCount() {
    return this.count * this.copies
  }

  get loop() {
    return this.count * this.scrollPerItem
  }

  // Scroll position in items, wrapped to one set
  get progress() {
    const loop = this.loop
    if (loop <= 0) return 0
    const px = ((this.current % loop) + loop) % loop
    return px / this.scrollPerItem
  }

  get activeIndex() {
    return this.count ? Math.round(this.progress) % this.count : 0
  }

  setOptions(next: Partial<ScrollSurfEngineOptions>) {
    if (next.count !== undefined) this.count = next.count
    if (next.copies !== undefined) this.copies = next.copies
    if (next.scrollPerItem !== undefined) this.scrollPerItem = next.scrollPerItem
    if (next.step !== undefined) this.step = next.step
    if (next.variant !== undefined) this.variant = next.variant
    if (next.smoothing !== undefined) this.smoothing = next.smoothing
    if (next.instant !== undefined) this.instant = next.instant
    if (this.cards.length !== this.cardCount) this.allocate()
    this.idle = false
  }

  setTarget(px: number, jump = false) {
    this.target = Math.max(0, px)
    if (jump || this.instant) this.current = this.target
    this.idle = false
  }

  setPointer(x: number, y: number | null) {
    this.pointer = y === null ? null : { x, y }
    this.idle = false
  }

  setCardCenter(index: number, x: number, y: number) {
    const card = this.cards[index]
    if (!card) return
    card.cx = x
    card.cy = y
  }

  trackTransform() {
    return trackTransform(this.progress, this.step)
  }

  cardTransform(index: number) {
    return cardTransform(index, this.step)
  }

  cardState(index: number): ScrollSurfCardState {
    const card = this.cards[index]
    return card ? { scale: card.scale.value, lift: card.lift.value } : { scale: 1, lift: 0 }
  }

  tick(dt: number) {
    const diff = this.target - this.current
    if (Math.abs(diff) < SCROLL_SETTLE || this.instant) this.current = this.target
    else {
      // Frame-rate independent lerp, same feel as smoothing at 60fps
      const rate = 1 - Math.pow(1 - clamp(this.smoothing, 0.01, 1), dt * 60)
      this.current += diff * rate
    }
    let settled = this.current === this.target
    let active = false
    for (const card of this.cards) {
      const near = 1 - clamp(this.distance(card) / HOVER_REACH, 0, 1)
      const scale = this.variant === 'magnetic' ? 1 + MAGNET_SCALE * near : 1
      const lift = this.variant === 'uplift' ? -LIFT_PX * near : 0
      if (this.instant) {
        card.scale.value = scale
        card.lift.value = lift
      } else {
        stepSpring(card.scale, scale, dt, hoverSpring)
        stepSpring(card.lift, lift, dt, hoverSpring)
        if (!settle(card.scale, scale, SCALE_SETTLE)) settled = false
        if (!settle(card.lift, lift, LIFT_SETTLE)) settled = false
      }
      if (card.scale.value !== 1 || card.lift.value !== 0) active = true
    }
    this.hoverActive = active
    this.idle = settled
  }

  private distance(card: Card) {
    if (!this.pointer || this.variant === 'simple') return Infinity
    return Math.hypot(this.pointer.x - card.cx, this.pointer.y - card.cy)
  }

  private allocate() {
    this.cards = Array.from({ length: this.cardCount }, () => ({
      scale: { value: 1, velocity: 0 },
      lift: { value: 0, velocity: 0 },
      cx: 0,
      cy: 0,
    }))
    this.hoverActive = false
  }
}
