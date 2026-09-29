export interface LensCarouselEngineOptions {
  // Centre of every item along the strip, in px
  points: number[]
  // Length of one full strip when looping
  loopLength: number
  loop: boolean
  snap: boolean
  inertia: boolean
  instant: boolean
}

export interface GlassLensOptions {
  // Visible glass width
  lens: number
  // Extra source width outside the viewport edge
  outer: number
  // Extra source width past the inner glass edge
  inner: number
  // Top of the card band inside the lens element
  top: number
  cardHeight: number
  // Magnification at the outer edge, 0 to 1
  strength: number
  // Horizontal red-blue split in px
  fringe: number
  // Map pixel size, larger is cheaper
  step: number
}

export interface GlassLensMaps {
  width: number
  height: number
  // Displacement maps per colour tap, blue holds the smear mask
  left: Uint8ClampedArray<ArrayBuffer>[]
  right: Uint8ClampedArray<ArrayBuffer>[]
  // feDisplacementMap scale that decodes the maps
  scale: number
  // Offset the maps cannot express, undone by moving the source
  shift: number
}

type Mode = 'idle' | 'drag' | 'tween' | 'scroll'

const THROW_TIME = 0.13
const TWEEN_DURATION = 0.75
const SCROLL_DURATION = 0.5
const SCROLL_PAUSE = 0.12
const RUBBER_LIMIT = 160
const SCALE_PER_SPEED = 2.6e-5
const SCALE_FLOOR = 0.85
const SCALE_SMOOTHING = 24
const DRAG_SAMPLE = 0.05
const FOCUS_Y = 0.39
const SHEAR_Y = 0.15
const SHEAR = 0.75
const FRINGE_RAMP = 0.3
const SMEAR_POWER = 1.5

export class LensCarouselEngine {
  offset = 0
  velocity = 0
  scale = 1
  idle = true
  points: number[]
  loopLength: number
  loop: boolean
  snap: boolean
  inertia: boolean
  instant: boolean
  private mode: Mode = 'idle'
  private from = 0
  private target = 0
  private elapsed = 0
  private duration = TWEEN_DURATION
  private dragRaw = 0
  private dragDelta = 0
  private dragTime = 0
  private sinceScroll = 0

  constructor(options: LensCarouselEngineOptions, initialIndex = 0) {
    this.points = options.points
    this.loopLength = options.loopLength
    this.loop = options.loop
    this.snap = options.snap
    this.inertia = options.inertia
    this.instant = options.instant
    this.offset = this.pointAt(initialIndex)
    this.target = this.offset
  }

  get min() {
    return this.points[0] ?? 0
  }

  get max() {
    return this.points[this.points.length - 1] ?? 0
  }

  get activeIndex() {
    return this.nearestIndex(this.offset)
  }

  setOptions(next: Partial<LensCarouselEngineOptions>) {
    const index = this.activeIndex
    const previous = this.points
    if (next.points !== undefined) this.points = next.points
    if (next.loopLength !== undefined) this.loopLength = next.loopLength
    if (next.loop !== undefined) this.loop = next.loop
    if (next.snap !== undefined) this.snap = next.snap
    if (next.inertia !== undefined) this.inertia = next.inertia
    if (next.instant !== undefined) this.instant = next.instant
    if (this.points !== previous && this.mode !== 'drag') {
      // Layout changed, keep the same card centred without animating
      this.offset = this.pointAt(index)
      this.target = this.offset
      this.velocity = 0
      this.mode = 'idle'
    }
    this.idle = this.mode === 'idle' && this.scale === 1
  }

  canScroll(direction: number) {
    if (this.loop) return direction !== 0
    if (direction > 0) return this.offset < this.max - 0.5
    if (direction < 0) return this.offset > this.min + 0.5
    return false
  }

  dragStart() {
    this.mode = 'drag'
    this.dragRaw = this.offset
    this.velocity = 0
    this.dragDelta = 0
    this.dragTime = 0
    this.idle = false
  }

  dragMove(dx: number) {
    if (this.mode !== 'drag') return
    this.dragRaw -= dx
    const next = this.loop ? this.dragRaw : this.rubber(this.dragRaw)
    this.dragDelta += next - this.offset
    this.offset = next
  }

  dragEnd() {
    if (this.mode !== 'drag') return
    const outside = !this.loop && (this.offset < this.min || this.offset > this.max)
    if (this.instant || !this.inertia || outside) {
      this.settleTo(this.snap || outside ? this.nearest(this.offset) : this.offset, TWEEN_DURATION)
      return
    }
    const projected = this.offset + this.velocity * THROW_TIME
    this.settleTo(this.snap ? this.nearest(projected) : this.clamp(projected), TWEEN_DURATION)
  }

  scroll(delta: number) {
    if (this.mode === 'drag') return
    this.mode = 'scroll'
    this.velocity = 0
    this.sinceScroll = 0
    this.offset = this.clamp(this.offset + delta)
    this.idle = false
  }

  select(index: number) {
    if (this.mode === 'drag') return
    this.velocity = 0
    this.settleTo(this.occurrence(index, 0), TWEEN_DURATION)
  }

  step(direction: number) {
    if (this.mode === 'drag') return
    const count = this.points.length
    if (!count) return
    let index = this.activeIndex + direction
    if (this.loop) index = ((index % count) + count) % count
    else index = Math.min(Math.max(index, 0), count - 1)
    this.velocity = 0
    this.settleTo(this.occurrence(index, direction), TWEEN_DURATION)
  }

  tick(dt: number) {
    switch (this.mode) {
      case 'drag': {
        // Pointer events are slower than frames, sample per move
        this.dragTime += dt
        if (this.dragDelta !== 0 || this.dragTime > DRAG_SAMPLE) {
          const sampled = this.dragDelta / Math.max(this.dragTime, 0.001)
          this.velocity += (sampled - this.velocity) * 0.6
          this.dragDelta = 0
          this.dragTime = 0
        }
        break
      }
      case 'tween': {
        this.elapsed = Math.min(this.elapsed + dt, this.duration)
        const t = this.elapsed / this.duration
        const remaining = 1 - t
        const distance = this.target - this.from
        this.offset = this.from + distance * (1 - remaining * remaining * remaining)
        this.velocity = (3 * distance * remaining * remaining) / this.duration
        if (t >= 1) {
          this.offset = this.target
          this.velocity = 0
          this.mode = 'idle'
        }
        break
      }
      case 'scroll': {
        this.sinceScroll += dt
        if (this.sinceScroll > SCROLL_PAUSE) {
          if (this.snap) this.settleTo(this.nearest(this.offset), SCROLL_DURATION)
          else this.mode = 'idle'
        }
        break
      }
    }
    const wanted = this.instant
      ? 1
      : Math.max(SCALE_FLOOR, 1 - Math.abs(this.velocity) * SCALE_PER_SPEED)
    this.scale += (wanted - this.scale) * Math.min(1, dt * SCALE_SMOOTHING)
    if (Math.abs(wanted - this.scale) < 0.0005) this.scale = wanted
    this.idle = this.mode === 'idle' && this.scale === wanted
  }

  private settleTo(target: number, duration: number) {
    this.target = target
    if (this.instant || Math.abs(target - this.offset) < 0.5) {
      this.offset = target
      this.velocity = 0
      this.mode = 'idle'
    } else {
      this.from = this.offset
      this.elapsed = 0
      this.duration = duration
      this.mode = 'tween'
    }
    this.idle = false
  }

  private pointAt(index: number) {
    const last = Math.max(0, this.points.length - 1)
    return this.points[Math.min(Math.max(index, 0), last)] ?? 0
  }

  // Nearest copy of a point, or next one in a direction
  private occurrence(index: number, direction: number) {
    const point = this.pointAt(index)
    if (!this.loop || this.loopLength <= 0) return point
    const base = point + Math.floor((this.offset - point) / this.loopLength) * this.loopLength
    const candidates = [base - this.loopLength, base, base + this.loopLength]
    let best = base
    let bestDistance = Infinity
    for (const candidate of candidates) {
      const delta = candidate - this.offset
      if (direction > 0 && delta <= 0.5) continue
      if (direction < 0 && delta >= -0.5) continue
      const distance = Math.abs(delta)
      if (distance < bestDistance) {
        bestDistance = distance
        best = candidate
      }
    }
    return best
  }

  private nearestIndex(offset: number) {
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < this.points.length; i++) {
      const distance = Math.abs(this.occurrenceNear(this.points[i] ?? 0, offset) - offset)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    return best
  }

  private occurrenceNear(point: number, offset: number) {
    if (!this.loop || this.loopLength <= 0) return point
    const base = point + Math.floor((offset - point) / this.loopLength) * this.loopLength
    return offset - base > this.loopLength / 2 ? base + this.loopLength : base
  }

  private nearest(offset: number) {
    return this.occurrenceNear(this.pointAt(this.nearestIndex(offset)), offset)
  }

  private clamp(offset: number) {
    if (this.loop) return offset
    return Math.min(Math.max(offset, this.min), this.max)
  }

  private rubber(raw: number) {
    if (raw < this.min) return this.min - this.stretch(this.min - raw)
    if (raw > this.max) return this.max + this.stretch(raw - this.max)
    return raw
  }

  private stretch(distance: number) {
    return (RUBBER_LIMIT * distance) / (distance + RUBBER_LIMIT)
  }
}

// Near-linear ramp from the outer edge with a soft tail
function lensProfile(u: number) {
  if (u <= 0) return 1
  if (u >= 1) return 0
  return Math.pow(1 - u, 1.2) * (1 - u * u * u)
}

export function buildLensMaps(options: GlassLensOptions): GlassLensMaps {
  const { lens, outer, inner, top, cardHeight, strength, fringe, step } = options
  const sourceWidth = outer + lens + inner
  const sourceHeight = Math.round(top * 2 + cardHeight)
  const width = Math.max(2, Math.ceil(sourceWidth / step))
  const height = Math.max(2, Math.ceil(sourceHeight / step))
  const focus = top + cardHeight / 2 + FOCUS_Y * cardHeight
  const shearFocus = top + cardHeight / 2 + SHEAR_Y * cardHeight
  const pivot = lens / 2
  const fringeY = fringe * 0.75
  const field = (x: number, y: number): [number, number] => {
    const k = strength * lensProfile(x / lens)
    return [k * (pivot - x + SHEAR * (y - shearFocus)), k * (focus - y)]
  }

  let peak = 0
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const [dx, dy] = field(i * step - outer, j * step)
      peak = Math.max(peak, Math.abs(dx) + fringe, Math.abs(dy) + fringeY)
    }
  }
  const scale = Math.ceil(peak) * 2 + 4
  const shift = scale * (128 / 255 - 0.5)

  const taps = [1, 0, -1]
  const left = taps.map(() => new Uint8ClampedArray(width * height * 4))
  const right = taps.map(() => new Uint8ClampedArray(width * height * 4))
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const x = i * step - outer
      const [dx, dy] = field(x, j * step)
      const ramp = Math.min(1, Math.max(0, (1 - x / lens) / FRINGE_RAMP))
      const smear = Math.round(255 * Math.pow(lensProfile(x / lens), SMEAR_POWER))
      const at = (j * width + i) * 4
      for (let tap = 0; tap < 3; tap++) {
        const sign = taps[tap] ?? 0
        const tapX = dx + (sign * fringe * ramp) / 2
        const tapY = dy - (sign * fringeY * ramp) / 2
        const encodedY = Math.round(127.5 + (tapY / scale) * 255)
        const map = left[tap]
        const mirrored = right[tap]
        if (!map || !mirrored) continue
        map[at] = Math.round(127.5 + (tapX / scale) * 255)
        map[at + 1] = encodedY
        map[at + 2] = smear
        map[at + 3] = 255
        const mirror = (j * width + (width - 1 - i)) * 4
        mirrored[mirror] = Math.round(127.5 - (tapX / scale) * 255)
        mirrored[mirror + 1] = encodedY
        mirrored[mirror + 2] = smear
        mirrored[mirror + 3] = 255
      }
    }
  }
  return { width, height, left, right, scale, shift }
}
