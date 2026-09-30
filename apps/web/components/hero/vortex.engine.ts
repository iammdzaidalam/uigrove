export interface VortexOptions {
  turns: number
  camera: number
  velocity: number
  fade: number
  spread: number
  attenuation: number
  spacing: number
  tilt: number
  // Above 1 packs inner rings tighter and opens the outer ones
  power: number
  // Extra speed per 1000px/s of scroll, eased and capped
  scrollBoost: number
  maxBoost: number
  // Horizontal and vertical stretch of the spiral
  ellipse: readonly [number, number]
}

export const vortexDefaults: VortexOptions = {
  turns: 6,
  camera: 2500,
  velocity: 0.07,
  fade: 8,
  spread: 0.95,
  attenuation: 0.35,
  spacing: 300,
  tilt: 9,
  power: 1.7,
  scrollBoost: 8,
  maxBoost: 12,
  ellipse: [1.28, 0.84],
}

const TAU = Math.PI * 2
const SAMPLES = 8192
const LUT = 2048
export const STRIDE = 8
// Card scale classes, cycled so neighbours differ
const SIZES = [0.78, 1, 0.9]

interface Path {
  x: Float32Array
  y: Float32Array
  length: number
}

const wrap = (v: number) => ((v % 100) + 100) % 100

// Archimedean spiral resampled so cards travel at even arc speed
function spiral(turns: number, radius: number, power: number): Path {
  const px = new Float64Array(SAMPLES + 1)
  const py = new Float64Array(SAMPLES + 1)
  const dist = new Float64Array(SAMPLES + 1)
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES
    const a = t * turns * TAU
    const r = radius * (1 - t) ** power
    px[i] = r * Math.cos(a)
    py[i] = r * Math.sin(a)
    if (i > 0) dist[i] = dist[i - 1]! + Math.hypot(px[i]! - px[i - 1]!, py[i]! - py[i - 1]!)
  }
  const length = dist[SAMPLES]!
  const x = new Float32Array(LUT + 1)
  const y = new Float32Array(LUT + 1)
  let j = 0
  for (let k = 0; k <= LUT; k++) {
    const target = (k / LUT) * length
    while (j < SAMPLES - 1 && dist[j + 1]! < target) j++
    const span = dist[j + 1]! - dist[j]!
    const f = span > 0 ? (target - dist[j]!) / span : 0
    x[k] = px[j]! + (px[j + 1]! - px[j]!) * f
    y[k] = py[j]! + (py[j + 1]! - py[j]!) * f
  }
  return { x, y, length }
}

export class VortexEngine {
  private options: VortexOptions
  private path: Path
  private spriteCount = 0
  private count: number
  private phase = 0
  private time = 0
  private scroll = 0
  private boost = 1
  private width = 0
  private height = 0
  private dpr = 1
  private originY = 0.5
  private clearX = 0
  private clearY = 0

  constructor(options: Partial<VortexOptions> = {}) {
    this.options = { ...vortexDefaults, ...options }
    this.path = spiral(this.options.turns, this.options.camera * 0.75, this.options.power)
    this.count = Math.max(10, Math.ceil(this.path.length / this.options.spacing))
  }

  setSpriteCount(count: number) {
    this.spriteCount = count
  }

  // Vertical centre of the spiral as a fraction of height
  setOrigin(y: number) {
    this.originY = y
  }

  // Half size of the content box cards fade out behind
  setClear(halfWidth: number, halfHeight: number) {
    this.clearX = halfWidth
    this.clearY = halfHeight
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
  }

  setScrollVelocity(pxPerSecond: number) {
    this.scroll = Math.max(this.scroll, Math.abs(pxPerSecond))
  }

  tick(dt: number) {
    const { velocity, scrollBoost, maxBoost } = this.options
    this.time += dt * 1000
    const target = 1 + Math.min(maxBoost, (this.scroll / 1000) * scrollBoost)
    this.boost += (target - this.boost) * (1 - Math.exp(-dt * 4))
    this.scroll *= Math.exp(-dt * 5)
    this.phase = wrap(this.phase + velocity * this.boost * dt)
  }

  // Writes x, y, cos, sin, alpha, sprite, scale, phase per card, in device px
  layout(out: Float32Array) {
    const { width, height, dpr, count, path, options } = this
    const sprites = this.spriteCount
    if (sprites === 0) return 0
    // Square stage, at least 2000px, a bit wider than the viewport
    const side = Math.max(2000, width * 1.2)
    const scale = (side / options.camera) * dpr
    const cx = (width * dpr) / 2
    const cy = height * dpr * this.originY
    const outer = options.camera * 0.75
    const pad = 200 * scale
    let n = 0
    for (let i = 0; i < count && (n + 1) * STRIDE <= out.length; i++) {
      const s = wrap(this.phase + (i / count - 0.5) * 100)
      // Interpolate between samples so cards glide instead of stepping
      const f = (s / 100) * LUT
      const k = Math.min(LUT - 1, Math.floor(f))
      const t = f - k
      let x = path.x[k]! + (path.x[k + 1]! - path.x[k]!) * t
      let y = path.y[k]! + (path.y[k + 1]! - path.y[k]!) * t
      const d = Math.hypot(x, y)
      if (options.spread !== 1 && d > 0) {
        const f = (outer * (d / outer) ** (1 / options.spread)) / d
        x *= f
        y *= f
      }
      let alpha =
        s < options.fade ? s / options.fade : s > 100 - options.fade ? (100 - s) / options.fade : 1
      const size = Math.min(Math.hypot(x, y) / outer, 1) ** options.attenuation
      const sx = cx + x * options.ellipse[0] * scale
      const sy = cy + y * options.ellipse[1] * scale
      if (this.clearX > 0) {
        const ex = (sx - cx) / (this.clearX * dpr)
        const ey = (sy - cy) / (this.clearY * dpr)
        const e = Math.min(1, Math.max(0, (Math.hypot(ex, ey) - 0.9) / 0.35))
        alpha *= e * e * (3 - 2 * e)
      }
      if (alpha < 0.01) continue
      if (sx < -pad || sx > width * dpr + pad || sy < -pad || sy > height * dpr + pad) continue
      // A fixed gentle tilt per card; spinning with the path feels queasy
      const a = (Math.sin(i * 2.399) * options.tilt * Math.PI) / 180
      const o = n * STRIDE
      out[o] = sx
      out[o + 1] = sy
      out[o + 2] = Math.cos(a) * size * scale
      out[o + 3] = Math.sin(a) * size * scale
      out[o + 4] = alpha
      // Scrambled so neighbouring turns rarely repeat a preview
      out[o + 5] = (i * 7 + Math.floor(i / sprites) * 5) % sprites
      out[o + 6] = SIZES[i % SIZES.length]!
      out[o + 7] = (i * 0.618) % 1
      n++
    }
    return n
  }

  get cards() {
    return this.count
  }
}
