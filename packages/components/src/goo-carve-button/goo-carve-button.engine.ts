export type GooCarveRest = 'visible' | 'hidden'

export interface GooCarveButtonEngineOptions {
  radius: number
  smoothing: number
  stretch: number
  rest: GooCarveRest
  enterDuration: number
  leaveDuration: number
  instant: boolean
}

export interface GooCarveBlob {
  x: number
  y: number
  r: number
  angle: number
  scale: number
}

// Follow lag runs 20ms to 400ms, 210ms at the default
const LAG_MIN = 0.02
const LAG_SPAN = 0.38
// Stretch gain per px/s at full stretch and its settle rate
const STRETCH_GAIN = 0.0019
const STRETCH_RATE = 9.5
const STRETCH_MAX = 2.4
const SETTLE_DISTANCE = 0.05
const SETTLE_SCALE = 0.001
const HOLD_DISTANCE = 0.01

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

export class GooCarveButtonEngine {
  idle = true
  options: GooCarveButtonEngineOptions
  private width = 0
  private height = 0
  private active = false
  // Positions are offsets from the button center
  private x = 0
  private y = 0
  private targetX = 0
  private targetY = 0
  private angle = 0
  private scale = 1
  private progress: number

  constructor(options: GooCarveButtonEngineOptions) {
    this.options = options
    this.progress = options.rest === 'visible' ? 1 : 0
  }

  setOptions(next: Partial<GooCarveButtonEngineOptions>) {
    this.options = { ...this.options, ...next }
    this.idle = false
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
  }

  setPointer(x: number | null, y = 0) {
    if (x === null) {
      this.active = false
      this.idle = false
      return
    }
    const offsetX = x - this.width / 2
    const offsetY = y - this.height / 2
    if (!this.active) {
      this.active = true
      // Snap to the entry point instead of sliding over
      this.x = offsetX
      this.y = offsetY
    }
    this.targetX = offsetX
    this.targetY = offsetY
    this.idle = false
  }

  tick(dt: number) {
    const { instant, rest, enterDuration, leaveDuration, smoothing, stretch } = this.options
    const goal = this.active || rest === 'visible' ? 1 : 0
    const duration = goal ? enterDuration : leaveDuration
    const step = instant || duration <= 0 ? 1 : (dt * 1000) / duration
    this.progress += Math.max(-step, Math.min(step, goal - this.progress))
    if (instant) {
      this.x = this.y = this.targetX = this.targetY = 0
      this.angle = 0
      this.scale = 1
      this.idle = true
      return
    }
    if (this.progress === 0) {
      this.scale = 1
      this.idle = true
      return
    }
    const dx = this.targetX - this.x
    const dy = this.targetY - this.y
    const distance = Math.hypot(dx, dy)
    const lag = LAG_MIN + LAG_SPAN * clamp01(smoothing)
    const follow = 1 - Math.exp(-dt / lag)
    this.x += dx * follow
    this.y += dy * follow
    if (distance > HOLD_DISTANCE) this.angle = Math.atan2(dy, dx)
    // The approach speed is the remaining distance over the lag
    const target = Math.min(STRETCH_MAX, 1 + STRETCH_GAIN * clamp01(stretch) * (distance / lag))
    this.scale += (target - this.scale) * (1 - Math.exp(-STRETCH_RATE * dt))
    const settled = distance < SETTLE_DISTANCE && Math.abs(this.scale - 1) < SETTLE_SCALE
    this.idle = settled && this.progress === goal
  }

  blob(): GooCarveBlob {
    return {
      x: this.x,
      y: this.y,
      r: this.options.radius * easeInOut(this.progress),
      angle: (this.angle * 180) / Math.PI,
      scale: this.scale,
    }
  }
}
