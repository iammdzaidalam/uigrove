import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface DotGridOptions {
  dotSize: number
  gap: number
  color: string
  opacity: number
  shape: 'circle' | 'square'
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
const RIPPLE_WIDTH = 70
const RIPPLE_LIFE = 1.1

export class DotGridEngine implements DotCanvasEngine {
  idle = true
  options: DotGridOptions
  private width = 0
  private height = 0
  private count = 0
  private rest = new Float32Array(0)
  private offset = new Float32Array(0)
  private velocity = new Float32Array(0)
  private pointerX = 0
  private pointerY = 0
  private pointerActive = false
  private pointerMoved = false
  private ripples: Ripple[] = []
  private now = 0

  constructor(options: DotGridOptions) {
    this.options = options
  }

  setOptions(options: DotGridOptions) {
    const rebuild = options.gap !== this.options.gap || options.dotSize !== this.options.dotSize
    this.options = options
    if (rebuild) this.layout()
    this.idle = false
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.layout()
  }

  private layout() {
    const { gap, dotSize } = this.options
    const cols = Math.max(1, Math.floor((this.width - dotSize) / gap) + 1)
    const rows = Math.max(1, Math.floor((this.height - dotSize) / gap) + 1)
    const startX = (this.width - (cols - 1) * gap) / 2
    const startY = (this.height - (rows - 1) * gap) / 2
    this.count = cols * rows
    this.rest = new Float32Array(this.count * 2)
    this.offset = new Float32Array(this.count * 2)
    this.velocity = new Float32Array(this.count * 2)
    let i = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.rest[i++] = startX + c * gap
        this.rest[i++] = startY + r * gap
      }
    }
    this.idle = false
  }

  setPointer(x: number, y: number, active: boolean) {
    if (!this.options.interactive) return
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active
    this.pointerMoved = true
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
        const ring = age * RIPPLE_SPEED
        const g = (d - ring) / RIPPLE_WIDTH
        if (g > 3 || g < -3 || d < 0.5) continue
        const fade = 1 - age / RIPPLE_LIFE
        const amp = (rippleStrength * Math.exp(-g * g) * fade) / d
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

    this.pointerMoved = false
    this.idle = energy < SETTLE * count && ripples.length === 0
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { dotSize, color, opacity, shape } = this.options
    const { rest, offset, count } = this
    const half = dotSize / 2
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
    ctx.beginPath()
    if (shape === 'square') {
      for (let i = 0; i < count; i++) {
        const ix = i * 2
        ctx.rect(
          rest[ix]! + offset[ix]! - half,
          rest[ix + 1]! + offset[ix + 1]! - half,
          dotSize,
          dotSize,
        )
      }
    } else {
      for (let i = 0; i < count; i++) {
        const ix = i * 2
        const x = rest[ix]! + offset[ix]!
        const y = rest[ix + 1]! + offset[ix + 1]!
        ctx.moveTo(x + half, y)
        ctx.arc(x, y, half, 0, TAU)
      }
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
