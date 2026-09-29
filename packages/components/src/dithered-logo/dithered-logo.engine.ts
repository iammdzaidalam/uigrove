import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface DitheredLogoOptions {
  src: string
  gridSize: number
  scale: number
  dotScale: number
  invert: boolean
  cornerRadius: number
  threshold: number
  contrast: number
  gamma: number
  blur: number
  diffusion: number
  serpentine: boolean
  color: string
  opacity: number
  radius: number
  strength: number
  stiffness: number
  damping: number
  ripple: boolean
  rippleStrength: number
  interactive: boolean
}

interface Ripple {
  x: number
  y: number
  start: number
}

const TAU = Math.PI * 2
const SETTLE = 0.02
const RIPPLE_SPEED = 900
const RIPPLE_WIDTH = 60
const RIPPLE_LIFE = 1.1

const PROCESS_KEYS: (keyof DitheredLogoOptions)[] = [
  'gridSize',
  'invert',
  'cornerRadius',
  'threshold',
  'contrast',
  'gamma',
  'blur',
  'diffusion',
  'serpentine',
]

function createContext(width: number, height: number) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
  }
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.getContext('2d', { willReadFrequently: true })
}

function boxBlur(values: Float32Array, cols: number, rows: number, radius: number) {
  if (radius <= 0) return values
  const r = Math.round(radius)
  const tmp = new Float32Array(values.length)
  const size = r * 2 + 1
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(cols - 1, Math.max(0, x + k))
        sum += values[y * cols + xx]!
      }
      tmp[y * cols + x] = sum / size
    }
  }
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      let sum = 0
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(rows - 1, Math.max(0, y + k))
        sum += tmp[yy * cols + x]!
      }
      values[y * cols + x] = sum / size
    }
  }
  return values
}

export class DitheredLogoEngine implements DotCanvasEngine {
  idle = true
  options: DitheredLogoOptions
  private image: HTMLImageElement | null = null
  private width = 0
  private height = 0
  private cols = 0
  private rows = 0
  private cells: number[] = []
  private count = 0
  private rest = new Float32Array(0)
  private offset = new Float32Array(0)
  private velocity = new Float32Array(0)
  private dotRadius = 1
  private pointerX = 0
  private pointerY = 0
  private pointerActive = false
  private ripples: Ripple[] = []
  private now = 0

  constructor(options: DitheredLogoOptions) {
    this.options = options
  }

  setOptions(options: DitheredLogoOptions) {
    const prev = this.options
    this.options = options
    const reprocess = PROCESS_KEYS.some((key) => options[key] !== prev[key])
    const relayout = options.scale !== prev.scale || options.dotScale !== prev.dotScale
    if (reprocess) this.process()
    else if (relayout) this.layout()
    this.idle = false
  }

  setImage(image: HTMLImageElement | null) {
    this.image = image
    this.process()
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.layout()
  }

  private process() {
    this.cells = []
    const image = this.image
    if (!image || !image.naturalWidth) {
      this.layout()
      return
    }
    const {
      gridSize,
      invert,
      cornerRadius,
      threshold,
      contrast,
      gamma,
      blur,
      diffusion,
      serpentine,
    } = this.options
    const aspect = image.naturalWidth / image.naturalHeight
    const cols = aspect >= 1 ? gridSize : Math.max(1, Math.round(gridSize * aspect))
    const rows = aspect >= 1 ? Math.max(1, Math.round(gridSize / aspect)) : gridSize
    const ctx = createContext(cols, rows)
    if (!ctx) return
    ctx.clearRect(0, 0, cols, rows)
    ctx.drawImage(image, 0, 0, cols, rows)
    const data = ctx.getImageData(0, 0, cols, rows).data
    const values = new Float32Array(cols * rows)
    const gain = 1 + contrast * 2
    for (let i = 0; i < values.length; i++) {
      const o = i * 4
      const luma = (0.2126 * data[o]! + 0.7152 * data[o + 1]! + 0.0722 * data[o + 2]!) / 255
      let v = luma * (data[o + 3]! / 255)
      if (invert) v = 1 - v
      v = Math.min(1, Math.max(0, (v - 0.5) * gain + 0.5))
      v = Math.pow(v, 1 / Math.max(0.05, gamma))
      values[i] = v * 255
    }
    boxBlur(values, cols, rows, blur)

    if (invert) this.maskFrame(values, cols, rows, cornerRadius)

    const on: number[] = []
    for (let y = 0; y < rows; y++) {
      const reverse = serpentine && y % 2 === 1
      for (let step = 0; step < cols; step++) {
        const x = reverse ? cols - 1 - step : step
        const i = y * cols + x
        const old = values[i]!
        const bit = old >= threshold ? 1 : 0
        if (bit) on.push(x, y)
        const err = (old - bit * 255) * diffusion
        const dir = reverse ? -1 : 1
        const nx = x + dir
        const px = x - dir
        if (nx >= 0 && nx < cols) values[i + dir] = values[i + dir]! + (err * 7) / 16
        if (y + 1 < rows) {
          const below = i + cols
          if (px >= 0 && px < cols) values[below - dir] = values[below - dir]! + (err * 3) / 16
          values[below] = values[below]! + (err * 5) / 16
          if (nx >= 0 && nx < cols) values[below + dir] = values[below + dir]! + (err * 1) / 16
        }
      }
    }
    this.cols = cols
    this.rows = rows
    this.cells = on
    this.layout()
  }

  private maskFrame(values: Float32Array, cols: number, rows: number, cornerRadius: number) {
    const r = Math.min(cols, rows) * Math.min(0.5, Math.max(0, cornerRadius))
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const dx = Math.max(r - x - 0.5, x + 0.5 - (cols - r), 0)
        const dy = Math.max(r - y - 0.5, y + 0.5 - (rows - r), 0)
        if (dx * dx + dy * dy > r * r) values[y * cols + x] = 0
      }
    }
  }

  private layout() {
    const { scale, dotScale } = this.options
    const count = this.cells.length / 2
    this.count = count
    this.rest = new Float32Array(count * 2)
    this.offset = new Float32Array(count * 2)
    this.velocity = new Float32Array(count * 2)
    if (!count || !this.width || !this.height) {
      this.idle = false
      return
    }
    const cell = (scale * Math.min(this.width, this.height)) / Math.max(this.cols, this.rows)
    const x0 = (this.width - this.cols * cell) / 2 + cell / 2
    const y0 = (this.height - this.rows * cell) / 2 + cell / 2
    this.dotRadius = cell * 0.36 * dotScale
    for (let i = 0; i < count; i++) {
      this.rest[i * 2] = x0 + this.cells[i * 2]! * cell
      this.rest[i * 2 + 1] = y0 + this.cells[i * 2 + 1]! * cell
    }
    this.idle = false
  }

  setPointer(x: number, y: number, active: boolean) {
    if (!this.options.interactive) return
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active
    this.idle = false
  }

  addRipple(x: number, y: number) {
    if (!this.options.ripple) return
    this.ripples.push({ x, y, start: this.now })
    this.idle = false
  }

  tick(dt: number, now: number) {
    this.now = now
    const { radius, strength, stiffness, damping, rippleStrength } = this.options
    const { rest, offset, velocity, count } = this
    const px = this.pointerX
    const py = this.pointerY
    const usePointer = this.pointerActive && this.options.interactive
    const r2 = radius * radius
    this.ripples = this.ripples.filter((rp) => (now - rp.start) / 1000 < RIPPLE_LIFE)
    const ripples = this.ripples
    let energy = 0

    for (let i = 0; i < count; i++) {
      const ix = i * 2
      const iy = ix + 1
      const rx = rest[ix]!
      const ry = rest[iy]!
      let tx = 0
      let ty = 0

      if (usePointer) {
        const dx = rx - px
        const dy = ry - py
        const d2 = dx * dx + dy * dy
        if (d2 < r2 && d2 > 0.0001) {
          const d = Math.sqrt(d2)
          const f = 1 - d / radius
          const push = (strength * f * f) / d
          tx += dx * push
          ty += dy * push
        }
      }

      for (let k = 0; k < ripples.length; k++) {
        const rp = ripples[k]!
        const age = (now - rp.start) / 1000
        const dx = rx - rp.x
        const dy = ry - rp.y
        const d = Math.sqrt(dx * dx + dy * dy)
        const g = (d - age * RIPPLE_SPEED) / RIPPLE_WIDTH
        if (g > 3 || g < -3 || d < 0.5) continue
        const amp = (rippleStrength * Math.exp(-g * g) * (1 - age / RIPPLE_LIFE)) / d
        tx += dx * amp
        ty += dy * amp
      }

      const ox = offset[ix]!
      const oy = offset[iy]!
      let vx = velocity[ix]!
      let vy = velocity[iy]!
      vx += ((tx - ox) * stiffness - vx * damping) * dt
      vy += ((ty - oy) * stiffness - vy * damping) * dt
      const nx = ox + vx * dt
      const ny = oy + vy * dt
      offset[ix] = nx
      offset[iy] = ny
      velocity[ix] = vx
      velocity[iy] = vy
      energy += Math.abs(vx) + Math.abs(vy) + Math.abs(nx - tx) + Math.abs(ny - ty)
    }

    this.idle = energy < SETTLE * Math.max(1, count) && ripples.length === 0
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { rest, offset, count, dotRadius } = this
    ctx.fillStyle = this.options.color
    ctx.globalAlpha = this.options.opacity
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const ix = i * 2
      const x = rest[ix]! + offset[ix]!
      const y = rest[ix + 1]! + offset[ix + 1]!
      ctx.moveTo(x + dotRadius, y)
      ctx.arc(x, y, dotRadius, 0, TAU)
    }
    ctx.fill()
    ctx.globalAlpha = 1
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    this.offset.fill(0)
    this.velocity.fill(0)
    this.draw(ctx)
  }
}
