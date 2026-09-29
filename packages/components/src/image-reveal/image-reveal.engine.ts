export interface ImageRevealEngineOptions {
  count: number
  smoothing: number
  startInset: number
  instant: boolean
}

export interface ImageRevealLayer {
  visible: boolean
  reveal: number
  clipTop: number
  clipSide: number
  scale: number
  brightness: number
  contrast: number
}

const SETTLE = 0.0005
const REVEAL_SHARE = 0.5
const END_SCALE = 0.75
const START_BRIGHTNESS = 3
const START_CONTRAST = 2.5

const HIDDEN: ImageRevealLayer = {
  visible: false,
  reveal: 0,
  clipTop: 1,
  clipSide: 0,
  scale: 1,
  brightness: START_BRIGHTNESS,
  contrast: START_CONTRAST,
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// Scroll distance past the item's start, measured in items
export function revealLayer(progress: number, startInset: number): ImageRevealLayer {
  if (progress < 0 || progress >= 1 + REVEAL_SHARE) return HIDDEN
  const reveal = clamp(progress / REVEAL_SHARE, 0, 1)
  const settle = clamp(progress, 0, 1)
  return {
    visible: true,
    reveal,
    clipTop: 1 - reveal,
    clipSide: clamp(startInset, 0, 0.5) * (1 - reveal),
    scale: 1 - (1 - END_SCALE) * settle,
    brightness: START_BRIGHTNESS - (START_BRIGHTNESS - 1) * reveal,
    contrast: START_CONTRAST - (START_CONTRAST - 1) * reveal,
  }
}

export class ImageRevealEngine {
  target = 0
  current = 0
  idle = true
  count: number
  smoothing: number
  startInset: number
  instant: boolean

  constructor(options: ImageRevealEngineOptions) {
    this.count = options.count
    this.smoothing = options.smoothing
    this.startInset = options.startInset
    this.instant = options.instant
  }

  get max() {
    return Math.max(0, this.count)
  }

  get activeIndex() {
    return clamp(Math.floor(this.current), 0, Math.max(0, this.count - 1))
  }

  // Fill of the side bar, restarts for every item
  get itemProgress() {
    if (this.count === 0) return 0
    if (this.current >= this.count) return 1
    return this.current - Math.floor(this.current)
  }

  setOptions(next: Partial<ImageRevealEngineOptions>) {
    if (next.count !== undefined) this.count = next.count
    if (next.smoothing !== undefined) this.smoothing = next.smoothing
    if (next.startInset !== undefined) this.startInset = next.startInset
    if (next.instant !== undefined) this.instant = next.instant
    this.target = clamp(this.target, 0, this.max)
    this.current = clamp(this.current, 0, this.max)
    this.idle = Math.abs(this.target - this.current) < SETTLE
  }

  setTarget(t: number, jump = false) {
    this.target = clamp(t, 0, this.max)
    if (jump || this.instant) this.current = this.target
    this.idle = Math.abs(this.target - this.current) < SETTLE
    if (this.idle) this.current = this.target
  }

  tick(dt: number) {
    const diff = this.target - this.current
    if (Math.abs(diff) < SETTLE || this.instant) {
      this.current = this.target
      this.idle = true
      return
    }
    // Frame-rate independent lerp, same feel as smoothing at 60fps
    const rate = 1 - Math.pow(1 - clamp(this.smoothing, 0.01, 1), dt * 60)
    this.current += diff * rate
    this.idle = false
  }

  layerFor(index: number) {
    return revealLayer(this.current - index, this.startInset)
  }
}
