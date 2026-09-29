export interface WheelCarouselEngineOptions {
  count: number
  spacing: number
  snap: boolean
  momentum: boolean
  dragSpeed: number
  scrollSpeed: number
  instant: boolean
}

type Mode = 'idle' | 'drag' | 'coast' | 'settle' | 'scroll'

const FRICTION = 3.2
const OUTSIDE_FRICTION = 18
const OUTSIDE_DRAG = 0.3
const HANDOVER_SPEED = 24
const SPRING = 220
const DAMPING = 2 * Math.sqrt(SPRING)
const SCROLL_PAUSE = 0.1

export class WheelCarouselEngine {
  rotation = 0
  velocity = 0
  idle = true
  count: number
  spacing: number
  snap: boolean
  momentum: boolean
  dragSpeed: number
  scrollSpeed: number
  instant: boolean
  private mode: Mode = 'idle'
  private target = 0
  private dragRaw = 0
  private dragDelta = 0
  private sinceScroll = 0

  constructor(options: WheelCarouselEngineOptions, initialIndex = 0) {
    this.count = options.count
    this.spacing = options.spacing
    this.snap = options.snap
    this.momentum = options.momentum
    this.dragSpeed = options.dragSpeed
    this.scrollSpeed = options.scrollSpeed
    this.instant = options.instant
    this.rotation = this.clampIndex(initialIndex) * this.spacing
    this.target = this.rotation
  }

  get max() {
    return Math.max(0, this.count - 1) * this.spacing
  }

  get activeIndex() {
    return this.clampIndex(Math.round(this.rotation / this.spacing))
  }

  setOptions(next: Partial<WheelCarouselEngineOptions>) {
    const index = this.activeIndex
    const previousSpacing = this.spacing
    if (next.count !== undefined) this.count = next.count
    if (next.spacing !== undefined) this.spacing = next.spacing
    if (next.snap !== undefined) this.snap = next.snap
    if (next.momentum !== undefined) this.momentum = next.momentum
    if (next.dragSpeed !== undefined) this.dragSpeed = next.dragSpeed
    if (next.scrollSpeed !== undefined) this.scrollSpeed = next.scrollSpeed
    if (next.instant !== undefined) this.instant = next.instant
    if (this.spacing !== previousSpacing) {
      this.rotation = this.clampIndex(index) * this.spacing
      this.target = this.rotation
      this.velocity = 0
      if (this.mode !== 'drag') this.mode = 'idle'
    }
    if (this.mode === 'idle') this.rotation = this.clamp(this.rotation)
    this.idle = this.mode === 'idle'
  }

  canScroll(direction: number) {
    if (direction > 0) return this.rotation < this.max - 0.001
    if (direction < 0) return this.rotation > 0.001
    return false
  }

  dragStart() {
    this.mode = 'drag'
    this.dragRaw = this.rotation
    this.velocity = 0
    this.dragDelta = 0
    this.idle = false
  }

  dragMove(dy: number) {
    if (this.mode !== 'drag') return
    this.dragRaw -= dy * this.dragSpeed
    const next = this.rubber(this.dragRaw)
    this.dragDelta += next - this.rotation
    this.rotation = next
  }

  dragEnd() {
    if (this.mode !== 'drag') return
    const outside = this.rotation < 0 || this.rotation > this.max
    if (this.instant || !this.momentum || outside) {
      this.settleTo(this.snap || outside ? this.nearest(this.rotation) : this.rotation)
      return
    }
    const projected = this.rotation + this.velocity / FRICTION
    this.target = this.snap ? this.nearest(projected) : this.clamp(projected)
    this.mode = 'coast'
    this.idle = false
  }

  scroll(delta: number) {
    if (this.mode === 'drag') return
    this.mode = 'scroll'
    this.velocity = 0
    this.sinceScroll = 0
    this.rotation = this.clamp(this.rotation + delta * this.scrollSpeed)
    this.idle = false
  }

  select(index: number) {
    if (this.mode === 'drag') return
    this.velocity = 0
    this.settleTo(this.clampIndex(index) * this.spacing)
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
        const outside = this.rotation < 0 || this.rotation > this.max
        this.rotation += this.velocity * dt * (outside ? OUTSIDE_DRAG : 1)
        this.velocity *= Math.exp(-(outside ? OUTSIDE_FRICTION : FRICTION) * dt)
        const passed =
          this.velocity > 0 ? this.rotation >= this.target : this.rotation <= this.target
        if (passed || Math.abs(this.velocity) < HANDOVER_SPEED) this.mode = 'settle'
        break
      }
      case 'scroll': {
        this.sinceScroll += dt
        if (this.sinceScroll > SCROLL_PAUSE) {
          if (this.snap) this.settleTo(this.nearest(this.rotation))
          else this.mode = 'idle'
        }
        break
      }
    }
    if (this.mode === 'settle') {
      // Critically damped spring keeps velocity continuous after coasting
      const diff = this.target - this.rotation
      this.velocity += (SPRING * diff - DAMPING * this.velocity) * dt
      this.rotation += this.velocity * dt
      if (Math.abs(diff) < 0.01 && Math.abs(this.velocity) < 0.5) {
        this.rotation = this.target
        this.velocity = 0
        this.mode = 'idle'
      }
    }
    this.idle = this.mode === 'idle'
  }

  private settleTo(target: number) {
    this.target = target
    if (this.instant) {
      this.rotation = target
      this.velocity = 0
      this.mode = 'idle'
    } else {
      this.mode = 'settle'
    }
    this.idle = this.mode === 'idle'
  }

  private nearest(rotation: number) {
    return this.clamp(Math.round(rotation / this.spacing) * this.spacing)
  }

  private clamp(rotation: number) {
    return Math.min(Math.max(rotation, 0), this.max)
  }

  private clampIndex(index: number) {
    return Math.min(Math.max(index, 0), Math.max(0, this.count - 1))
  }

  // Overshoot past either end approaches two items and stops
  private rubber(raw: number) {
    const limit = this.spacing * 2
    if (raw < 0) return -this.stretch(-raw, limit)
    if (raw > this.max) return this.max + this.stretch(raw - this.max, limit)
    return raw
  }

  private stretch(distance: number, limit: number) {
    return (limit * distance) / (distance + limit)
  }
}
