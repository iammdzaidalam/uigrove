export type SceneRevealEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface SceneRevealEngineOptions {
  startScale: number
  endScale: number
  radius: number
  edgeInset: number
  parallax: number
  dim: number
  easing: SceneRevealEasing
  smoothing: number
  instant: boolean
}

export interface SceneRevealFrame {
  progress: number
  opening: number
  heroScale: number
  heroY: number
  veil: number
  insetX: number
  insetY: number
  bleed: number
  radius: number
  nextScale: number
  nextY: number
}

const SETTLE = 0.001
const OPEN_START = 0.5
const OPEN_END = 0.95
const SETTLE_START = 0.75
const BURST = 0.06
const NEXT_ZOOM = 1.3

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeInCubic(t: number) {
  return t * t * t
}

export function sceneRevealEase(easing: SceneRevealEasing, t: number) {
  const x = clamp(t, 0, 1)
  switch (easing) {
    case 'ease-in':
      return easeInCubic(x)
    case 'ease-out':
      return easeOutCubic(x)
    case 'ease-in-out':
      return smoothstep(x)
    default:
      return x
  }
}

// Zero with the hero at rest, one once settled
export function sceneRevealFrame(
  progress: number,
  options: Omit<SceneRevealEngineOptions, 'smoothing' | 'instant'>,
): SceneRevealFrame {
  const p = clamp(progress, 0, 1)
  const open = clamp((p - OPEN_START) / (OPEN_END - OPEN_START), 0, 1)
  const opening = sceneRevealEase(options.easing, open)
  const push = easeOutCubic(open)
  const settle = easeOutCubic(clamp((p - SETTLE_START) / (1 - SETTLE_START), 0, 1))
  // Window bursts from a point, then grows to full
  const burst = clamp(opening / BURST, 0, 1)
  const inset = 50 - (50 - options.edgeInset * (1 - opening)) * burst
  return {
    progress: p,
    opening,
    heroScale: options.startScale + (options.endScale - options.startScale) * push,
    heroY: -options.parallax * p,
    veil: options.dim * opening,
    insetX: inset,
    insetY: inset,
    bleed: options.radius * easeInCubic(opening),
    radius: options.radius,
    nextScale: NEXT_ZOOM + (1 - NEXT_ZOOM) * settle,
    nextY: options.parallax * (1 - opening),
  }
}

export class SceneRevealEngine {
  target = 0
  current = 0
  idle = true
  options: SceneRevealEngineOptions

  constructor(options: SceneRevealEngineOptions) {
    this.options = { ...options }
  }

  setOptions(next: Partial<SceneRevealEngineOptions>) {
    this.options = { ...this.options, ...next }
    this.idle = Math.abs(this.target - this.current) < SETTLE
  }

  setTarget(t: number, jump = false) {
    this.target = clamp(t, 0, 1)
    if (jump || this.options.instant) this.current = this.target
    this.idle = Math.abs(this.target - this.current) < SETTLE
    if (this.idle) this.current = this.target
  }

  tick(dt: number) {
    const diff = this.target - this.current
    if (Math.abs(diff) < SETTLE || this.options.instant) {
      this.current = this.target
      this.idle = true
      return
    }
    // Frame-rate independent lerp, same feel as smoothing at 60fps
    const rate = 1 - Math.pow(1 - clamp(this.options.smoothing, 0.01, 1), dt * 60)
    this.current += diff * rate
    this.idle = false
  }

  frame() {
    return sceneRevealFrame(this.current, this.options)
  }
}
