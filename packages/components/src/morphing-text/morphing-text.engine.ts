export interface MorphingTextEngineOptions {
  count: number
  morphDuration: number
  holdDuration: number
  blur: number
  maxBlur: number
  loop: boolean
  paused: boolean
  reduced: boolean
}

export interface MorphingTextLayer {
  blur: number
  opacity: number
}

const OPACITY_CURVE = 0.4
const REDUCED_FADE = 0.4
const MIN_PHASE = 0.01

export class MorphingTextEngine {
  current = 0
  next = 0
  fraction = 0
  outgoing: MorphingTextLayer = { blur: 0, opacity: 1 }
  incoming: MorphingTextLayer = { blur: 0, opacity: 0 }

  private options: MorphingTextEngineOptions
  private cooldown = 0
  private elapsed = 0

  constructor(options: MorphingTextEngineOptions) {
    this.options = { ...options }
    this.reset()
  }

  get idle() {
    const { count, paused, loop } = this.options
    return paused || count < 2 || (!loop && this.current >= count - 1)
  }

  setOptions(options: Partial<MorphingTextEngineOptions>) {
    const prev = this.options
    this.options = { ...prev, ...options }
    if (this.options.count !== prev.count || this.options.reduced !== prev.reduced) this.reset()
    else if (this.fraction > 0) this.blend(this.fraction)
  }

  reset() {
    this.current = 0
    this.cooldown = this.holdPhase()
    this.elapsed = 0
    this.settle()
  }

  // Returns true when the layers changed and need to be written
  tick(dt: number) {
    if (this.idle) return false
    if (this.cooldown > 0) {
      this.cooldown -= dt
      // The crossing frame restarts the morph clock without drawing
      if (this.cooldown <= 0) this.elapsed = 0
      return false
    }
    this.elapsed += dt
    const e = this.elapsed / this.morphPhase()
    if (e >= 1) {
      this.current = (this.current + 1) % this.options.count
      this.elapsed = 0
      this.cooldown = this.holdPhase()
      this.settle()
    } else {
      this.blend(e)
    }
    return true
  }

  private morphPhase() {
    const { morphDuration, holdDuration, reduced } = this.options
    if (reduced) return Math.max(MIN_PHASE, Math.min(REDUCED_FADE, morphDuration + holdDuration))
    return Math.max(MIN_PHASE, morphDuration)
  }

  private holdPhase() {
    const { morphDuration, holdDuration, reduced } = this.options
    if (reduced) return Math.max(0, morphDuration + holdDuration - REDUCED_FADE)
    return Math.max(0, holdDuration)
  }

  private blurAt(x: number) {
    const { blur, maxBlur } = this.options
    if (blur <= 0) return 0
    return Math.min(x > 0 ? blur / x - blur : Infinity, maxBlur)
  }

  private settle() {
    const { count } = this.options
    this.next = count > 0 ? (this.current + 1) % count : 0
    this.fraction = 0
    this.outgoing = { blur: 0, opacity: 1 }
    this.incoming = { blur: 0, opacity: 0 }
  }

  private blend(e: number) {
    this.fraction = e
    if (this.options.reduced) {
      this.outgoing = { blur: 0, opacity: 1 - e }
      this.incoming = { blur: 0, opacity: e }
      return
    }
    this.outgoing = { blur: this.blurAt(1 - e), opacity: Math.pow(1 - e, OPACITY_CURVE) }
    this.incoming = { blur: this.blurAt(e), opacity: Math.pow(e, OPACITY_CURVE) }
  }
}
