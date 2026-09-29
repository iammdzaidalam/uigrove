import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface AsciiEffectOptions {
  src: string
  variant: 'image' | 'flow' | 'glitch'
  fit: 'contain' | 'cover'
  cellSize: number
  chars: string
  color: string
  colorMode: 'mono' | 'source'
  invert: boolean
  contrast: number
  brightness: number
  posterize: number
  dither: 'none' | 'floyd-steinberg' | 'bayer'
  speed: number
  mouseRadius: number
  mouseStrength: number
  glitchIntensity: number
  seed: number
  fontFamily: string
  fontWeight: number
}

type Source = HTMLImageElement | HTMLVideoElement
type Canvas = OffscreenCanvas | HTMLCanvasElement
type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

const CELL_ASPECT = 0.6
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createCanvas(width: number, height: number): Canvas | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function context2d(canvas: Canvas, readOften = false) {
  return canvas.getContext('2d', { willReadFrequently: readOften }) as Context | null
}

function sourceSize(source: Source) {
  if (source instanceof HTMLVideoElement) return [source.videoWidth, source.videoHeight] as const
  return [source.naturalWidth, source.naturalHeight] as const
}

export class AsciiEffectEngine implements DotCanvasEngine {
  idle = false
  options: AsciiEffectOptions
  private source: Source | null = null
  private width = 0
  private height = 0
  private dpr = 1
  private cols = 0
  private rows = 0
  private cellW = 6
  private cellH = 10
  private base = new Float32Array(0)
  private alpha = new Float32Array(0)
  private rgb = new Uint8ClampedArray(0)
  private work = new Float32Array(0)
  private index = new Int16Array(0)
  private sampler: Context | null = null
  private atlas: Canvas | null = null
  private atlasKey = ''
  private layer: Canvas | null = null
  private layerCtx: Context | null = null
  private layerKey = ''
  private pointerX = 0
  private pointerY = 0
  private pointerActive = false
  private time = 0
  private glitchAt = 0
  private glitchRows = new Float32Array(0)
  private glitchNoise = new Float32Array(0)
  private rand = mulberry32(1)
  private colSin = new Float32Array(0)
  private colCos = new Float32Array(0)

  constructor(options: AsciiEffectOptions) {
    this.options = options
  }

  setOptions(options: AsciiEffectOptions) {
    const prev = this.options
    this.options = options
    if (options.cellSize !== prev.cellSize) this.layout()
    else if (
      options.fit !== prev.fit ||
      options.invert !== prev.invert ||
      options.contrast !== prev.contrast ||
      options.brightness !== prev.brightness
    ) {
      this.sample()
    }
    if (options.seed !== prev.seed) this.rand = mulberry32(options.seed)
    if (options.variant !== prev.variant) {
      this.glitchRows.fill(0)
      this.glitchNoise.fill(0)
    }
    this.index.fill(-1)
    this.idle = false
  }

  setSource(source: Source | null) {
    this.source = source
    this.sample()
    this.index.fill(-1)
    this.idle = false
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
    this.layout()
  }

  private layout() {
    const size = Math.max(4, this.options.cellSize)
    this.cellH = size
    this.cellW = Math.round(size * CELL_ASPECT * 100) / 100
    this.cols = Math.max(1, Math.ceil(this.width / this.cellW))
    this.rows = Math.max(1, Math.ceil(this.height / this.cellH))
    const canvas = createCanvas(this.cols, this.rows)
    this.sampler = canvas ? context2d(canvas, true) : null
    const cells = this.cols * this.rows
    this.base = new Float32Array(cells)
    this.alpha = new Float32Array(cells)
    this.rgb = new Uint8ClampedArray(cells * 3)
    this.work = new Float32Array(cells)
    this.index = new Int16Array(cells).fill(-1)
    this.glitchRows = new Float32Array(this.rows)
    this.glitchNoise = new Float32Array(this.rows)
    this.colSin = new Float32Array(this.cols)
    this.colCos = new Float32Array(this.cols)
    for (let x = 0; x < this.cols; x++) {
      this.colSin[x] = Math.sin(x * 0.28)
      this.colCos[x] = Math.cos(x * 0.28)
    }
    this.atlasKey = ''
    this.layerKey = ''
    this.sample()
    this.idle = false
  }

  private sample() {
    const { sampler, source, cols, rows } = this
    this.base.fill(0)
    this.alpha.fill(0)
    if (!sampler || !source) return
    const [sw, sh] = sourceSize(source)
    if (!sw || !sh) return
    const fit = this.options.fit === 'cover' ? Math.max : Math.min
    const scale = fit(this.width / sw, this.height / sh)
    const dw = (sw * scale) / this.cellW
    const dh = (sh * scale) / this.cellH
    sampler.clearRect(0, 0, cols, rows)
    sampler.drawImage(source, (cols - dw) / 2, (rows - dh) / 2, dw, dh)
    const data = sampler.getImageData(0, 0, cols, rows).data
    const { invert, contrast, brightness } = this.options
    const gain = 1 + contrast * 2
    for (let i = 0; i < cols * rows; i++) {
      const o = i * 4
      const r = data[o]!
      const g = data[o + 1]!
      const b = data[o + 2]!
      const a = data[o + 3]! / 255
      let v = ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * a
      v = (v - 0.5) * gain + 0.5 + brightness
      if (invert) v = 1 - v
      this.base[i] = v < 0 ? 0 : v > 1 ? 1 : v
      this.alpha[i] = a
      this.rgb[i * 3] = r
      this.rgb[i * 3 + 1] = g
      this.rgb[i * 3 + 2] = b
    }
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active
    this.idle = false
  }

  tick(dt: number, now: number) {
    const { variant, speed } = this.options
    this.time += dt * speed
    const live = this.source instanceof HTMLVideoElement && !this.source.paused
    if (live) this.sample()
    if (variant === 'glitch' && now - this.glitchAt > 90 / Math.max(0.1, speed)) {
      this.glitchAt = now
      this.rollGlitch()
    }
    const animated = variant !== 'image' && speed > 0
    this.idle = !animated && !live && !this.pointerActive
  }

  private rollGlitch() {
    const { glitchIntensity } = this.options
    const rand = this.rand
    this.glitchRows.fill(0)
    this.glitchNoise.fill(0)
    const bands = Math.round(1 + glitchIntensity * 5)
    for (let b = 0; b < bands; b++) {
      if (rand() > 0.35 + glitchIntensity * 0.5) continue
      const start = Math.floor(rand() * this.rows)
      const size = 1 + Math.floor(rand() * this.rows * 0.12 * glitchIntensity)
      const shift = Math.round((rand() - 0.5) * this.cols * 0.3 * glitchIntensity)
      const noise = rand() * glitchIntensity
      for (let r = start; r < Math.min(this.rows, start + size); r++) {
        this.glitchRows[r] = shift
        this.glitchNoise[r] = noise
      }
    }
  }

  private compute() {
    const { variant, chars, dither, posterize, mouseRadius, mouseStrength } = this.options
    const { cols, rows, base, alpha, work, cellW, cellH, colSin, colCos } = this
    const levels = Math.max(2, chars.length)
    const t = this.time
    const usePointer = this.pointerActive && mouseRadius > 0 && mouseStrength > 0
    const px = this.pointerX
    const py = this.pointerY
    const r2 = mouseRadius * mouseRadius
    const flow = variant === 'flow'
    const glitch = variant === 'glitch'
    const posterSteps = posterize >= 2 ? posterize - 1 : 0

    for (let y = 0; y < rows; y++) {
      const shift = glitch ? this.glitchRows[y]! : 0
      const noise = glitch ? this.glitchNoise[y]! : 0
      const cy = (y + 0.5) * cellH
      const rowPhase = y * 0.18 - t * 2.4
      const rowSin = Math.sin(rowPhase) * 0.16
      const rowCos = Math.cos(rowPhase) * 0.16
      const rowWave = Math.sin(y * 0.4 + t * 1.1) * 0.06
      const rowOffset = y * cols
      const pointerRow = usePointer && Math.abs(cy - py) < mouseRadius
      for (let x = 0; x < cols; x++) {
        let sx = x
        if (shift) sx = (((x - shift) % cols) + cols) % cols
        let v = base[rowOffset + sx]!
        if (flow && alpha[rowOffset + sx]! > 0.02) {
          v += colSin[x]! * rowCos + colCos[x]! * rowSin + rowWave
        }
        if (noise && this.rand() < noise * 0.5) v = this.rand()
        if (pointerRow) {
          const dx = (x + 0.5) * cellW - px
          const dy = cy - py
          const d2 = dx * dx + dy * dy
          if (d2 < r2) {
            const d = Math.sqrt(d2)
            const f = 1 - d / mouseRadius
            v += Math.sin(d * 0.12 - t * 5) * f * mouseStrength * 0.6 + f * mouseStrength * 0.25
          }
        }
        if (posterSteps) v = Math.round(v * posterSteps) / posterSteps
        work[rowOffset + x] = v < 0 ? 0 : v > 1 ? 1 : v
      }
    }

    if (dither === 'bayer') {
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x
          const threshold = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16 - 0.5
          const v = work[i]! + threshold / levels
          work[i] = v < 0 ? 0 : v > 1 ? 1 : v
        }
      }
    } else if (dither === 'floyd-steinberg') {
      const step = 1 / (levels - 1)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x
          const old = work[i]!
          const q = Math.round(old / step) * step
          const err = old - q
          work[i] = q
          if (x + 1 < cols) work[i + 1] = work[i + 1]! + (err * 7) / 16
          if (y + 1 < rows) {
            if (x > 0) work[i + cols - 1] = work[i + cols - 1]! + (err * 3) / 16
            work[i + cols] = work[i + cols]! + (err * 5) / 16
            if (x + 1 < cols) work[i + cols + 1] = work[i + cols + 1]! + (err * 1) / 16
          }
        }
      }
    }
  }

  private ensureAtlas() {
    const { chars, color, fontFamily, fontWeight } = this.options
    const key = [chars, color, fontFamily, fontWeight, this.cellH, this.dpr].join('|')
    if (this.atlas && this.atlasKey === key) return this.atlas
    const dpr = this.dpr
    const w = Math.ceil(this.cellW * dpr)
    const h = Math.ceil(this.cellH * dpr)
    const atlas = createCanvas(Math.max(1, w * chars.length), h)
    const ctx = atlas ? context2d(atlas) : null
    if (!atlas || !ctx) return null
    ctx.clearRect(0, 0, atlas.width, atlas.height)
    ctx.fillStyle = color
    ctx.font = `${fontWeight} ${this.cellH * dpr * 0.95}px ${fontFamily || 'monospace'}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i]!, w * i + w / 2, h / 2)
    }
    this.atlas = atlas
    this.atlasKey = key
    this.index.fill(-1)
    return atlas
  }

  private ensureLayer() {
    const key = [this.width, this.height, this.dpr, this.options.colorMode].join('|')
    if (this.layer && this.layerCtx && this.layerKey === key) return this.layerCtx
    const w = Math.max(1, Math.round(this.width * this.dpr))
    const h = Math.max(1, Math.round(this.height * this.dpr))
    const layer = createCanvas(w, h)
    const ctx = layer ? context2d(layer) : null
    if (!layer || !ctx) return null
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    this.layer = layer
    this.layerCtx = ctx
    this.layerKey = key
    this.index.fill(-1)
    return ctx
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.source) return
    const layer = this.ensureLayer()
    const atlas = this.options.colorMode === 'mono' ? this.ensureAtlas() : null
    if (!layer || !this.layer) return
    this.compute()
    this.paint(layer, atlas)
    ctx.drawImage(this.layer, 0, 0, this.width, this.height)
  }

  // Only cells whose glyph changed are repainted
  private paint(layer: Context, atlas: Canvas | null) {
    const { chars, colorMode, fontFamily, fontWeight } = this.options
    const { cols, rows, work, index, cellW, cellH, dpr } = this
    const levels = chars.length
    if (levels === 0) return
    const sw = Math.ceil(cellW * dpr)
    const sh = Math.ceil(cellH * dpr)
    const source = colorMode === 'source'
    if (source) {
      layer.font = `${fontWeight} ${cellH * 0.95}px ${fontFamily || 'monospace'}`
      layer.textAlign = 'center'
      layer.textBaseline = 'middle'
    }
    for (let y = 0; y < rows; y++) {
      const row = y * cols
      const py = y * cellH
      for (let x = 0; x < cols; x++) {
        const i = row + x
        let next = Math.floor(work[i]! * levels)
        if (next >= levels) next = levels - 1
        if (next === index[i]) continue
        index[i] = next
        const px = x * cellW
        layer.clearRect(px, py, cellW, cellH)
        const ch = chars[next]!
        if (ch === ' ') continue
        if (source) {
          layer.fillStyle = `rgb(${this.rgb[i * 3]} ${this.rgb[i * 3 + 1]} ${this.rgb[i * 3 + 2]})`
          layer.fillText(ch, px + cellW / 2, py + cellH / 2)
        } else if (atlas) {
          layer.drawImage(atlas, next * sw, 0, sw, sh, px, py, cellW, cellH)
        }
      }
    }
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    this.pointerActive = false
    this.glitchRows.fill(0)
    this.glitchNoise.fill(0)
    this.draw(ctx)
  }
}
