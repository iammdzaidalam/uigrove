export interface SplitWordLoaderTiming {
  rise: number
  stagger: number
  riseDistance: number
  openAt: number
  open: number
  firstCut: number
  interval: number
  lastHold: number
  expand: number
  fade: number
  slotRatio: number
  clipOvershoot: number
}

export interface SplitWordLoaderEngineOptions {
  letters: number
  images: number
  durationScale: number
  imageRatio: number
  reduced: boolean
}

export interface SplitWordLoaderLayout {
  width: number
  height: number
  cap: number
}

export interface SplitWordLoaderTimeline {
  riseEnd: number
  openStart: number
  openEnd: number
  appear: number[]
  expandStart: number
  expandEnd: number
  end: number
}

export interface SplitWordLoaderFrame {
  letters: number[]
  masked: boolean
  slot: number
  boxWidth: number
  boxHeight: number
  image: number
  opacity: number
  progress: number
  revealed: boolean
  finished: boolean
}

// Timeline in seconds, distances in multiples of cap height
export const splitWordLoaderTiming: SplitWordLoaderTiming = {
  rise: 0.613,
  stagger: 0.018,
  riseDistance: 1.056,
  openAt: 0.947,
  open: 0.605,
  firstCut: 0.75,
  interval: 0.36,
  lastHold: 0.44,
  expand: 0.965,
  fade: 0.35,
  slotRatio: 1.1,
  clipOvershoot: 0.02,
}

export const splitWordLoaderBezier = [0.76, 0, 0.24, 1] as const

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sampleX = (s: number) => ((ax * s + bx) * s + cx) * s
  const sampleY = (s: number) => ((ay * s + by) * s + cy) * s
  const slopeX = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let s = x
    for (let i = 0; i < 8; i++) {
      const error = sampleX(s) - x
      if (Math.abs(error) < 1e-6) return sampleY(s)
      const slope = slopeX(s)
      if (Math.abs(slope) < 1e-6) break
      s -= error / slope
    }
    let lo = 0
    let hi = 1
    s = x
    while (hi - lo > 1e-6) {
      if (sampleX(s) < x) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return sampleY(s)
  }
}

export const splitWordLoaderEase = cubicBezier(...splitWordLoaderBezier)

function clamp01(value: number) {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

export function splitWordLoaderTimeline(
  options: SplitWordLoaderEngineOptions,
  timing: SplitWordLoaderTiming = splitWordLoaderTiming,
): SplitWordLoaderTimeline {
  const k = Math.max(options.durationScale, 0.05)
  if (options.reduced) {
    return {
      riseEnd: 0,
      openStart: 0,
      openEnd: 0,
      appear: [],
      expandStart: 0,
      expandEnd: 0,
      end: timing.fade * k,
    }
  }
  const riseEnd = (timing.rise + timing.stagger * Math.max(options.letters - 1, 0)) * k
  const openStart = timing.openAt * k
  const openEnd = openStart + timing.open * k
  const appear: number[] = []
  for (let i = 0; i < options.images; i++) {
    appear.push(i === 0 ? openStart : openStart + (timing.firstCut + (i - 1) * timing.interval) * k)
  }
  const last = appear[appear.length - 1] ?? openStart
  const expandStart = Math.max(last, openEnd) + timing.lastHold * k
  const expandEnd = expandStart + timing.expand * k
  return {
    riseEnd,
    openStart,
    openEnd,
    appear,
    expandStart,
    expandEnd,
    end: expandEnd + timing.fade * k,
  }
}

export class SplitWordLoaderEngine {
  time = 0
  timeline: SplitWordLoaderTimeline
  private options: SplitWordLoaderEngineOptions
  private timing: SplitWordLoaderTiming

  constructor(
    options: SplitWordLoaderEngineOptions,
    timing: SplitWordLoaderTiming = splitWordLoaderTiming,
  ) {
    this.options = options
    this.timing = timing
    this.timeline = splitWordLoaderTimeline(options, timing)
  }

  reset() {
    this.time = 0
  }

  // Latest time the clock may reach while assets are still loading
  gate(progress: number) {
    if (progress >= 1) return Infinity
    const { openEnd, expandStart } = this.timeline
    return openEnd + clamp01(progress) * (expandStart - openEnd)
  }

  advance(dt: number, progress = 1) {
    const limit = this.gate(progress)
    this.time = Math.min(this.time + dt, Math.max(this.time, limit))
  }

  get finished() {
    return this.time >= this.timeline.end
  }

  frame(layout: SplitWordLoaderLayout, time = this.time): SplitWordLoaderFrame {
    const { letters, imageRatio, durationScale } = this.options
    const timing = this.timing
    const line = this.timeline
    const k = Math.max(durationScale, 0.05)
    const ease = splitWordLoaderEase
    const offsets: number[] = []
    for (let i = 0; i < letters; i++) {
      const p = this.options.reduced
        ? 1
        : clamp01((time - i * timing.stagger * k) / (timing.rise * k))
      offsets.push(timing.riseDistance * layout.cap * (1 - ease(p)))
    }
    const reduced = this.options.reduced
    const open = reduced
      ? 0
      : ease(clamp01((time - line.openStart) / (line.openEnd - line.openStart)))
    const grow = reduced
      ? 0
      : ease(clamp01((time - line.expandStart) / (line.expandEnd - line.expandStart)))
    const base = imageRatio * layout.cap * open
    const boxWidth = base + (layout.width - base) * grow
    const boxHeight = open > 0 ? layout.cap + (layout.height - layout.cap) * grow : 0
    let image = -1
    for (let i = 0; i < line.appear.length; i++) {
      const at = line.appear[i]
      if (at !== undefined && time >= at) image = i
    }
    return {
      letters: offsets,
      masked: time < line.riseEnd,
      slot: boxWidth * timing.slotRatio,
      boxWidth,
      boxHeight,
      image,
      opacity: 1 - clamp01((time - line.expandEnd) / (line.end - line.expandEnd)),
      progress: line.expandEnd > 0 ? clamp01(time / line.expandEnd) : 1,
      revealed: time >= line.expandEnd,
      finished: time >= line.end,
    }
  }
}
