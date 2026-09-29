import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface DotMatrixTextOptions {
  text: string
  fontSize: number
  fontWeight: number
  fontFamily: string
  dotSize: number
  gap: number
  color: string
  align: 'left' | 'center' | 'right'
  duration: number
  stagger: number
  scatter: number
  order: 'random' | 'left' | 'center'
  fitWidth: boolean
  interactive: boolean
  radius: number
  strength: number
  seed: number
  points?: ReadonlyArray<DotMatrixPoint>
  links?: ReadonlyArray<DotMatrixLink>
  linkWidth: number
  squareSize: number
  squareRadius: number
  shapes?: ReadonlyArray<string>
}

const TAU = Math.PI * 2

// Point indices plus an optional width overriding linkWidth
export type DotMatrixLink = readonly [number, number] | readonly [number, number, number]

// Shape 0 circle, 1 square, 2 diamond, 3+ indexes into shapes
export type DotMatrixPoint = readonly [number, number] | readonly [number, number, number]
const SETTLE = 0.02
const STIFFNESS = 220
const DAMPING = 18

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

function easeOutExpo(p: number) {
  return p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)
}

function createMeasureContext(width: number, height: number) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height).getContext('2d', { willReadFrequently: true })
  }
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas.getContext('2d', { willReadFrequently: true })
}

export class DotMatrixTextEngine implements DotCanvasEngine {
  idle = false
  options: DotMatrixTextOptions
  private width = 0
  private height = 0
  private count = 0
  private target = new Float32Array(0)
  private start = new Float32Array(0)
  private delay = new Float32Array(0)
  private offset = new Float32Array(0)
  private velocity = new Float32Array(0)
  private startedAt = 0
  private pos = new Float32Array(0)
  private radii = new Float32Array(0)
  private squares = new Uint8Array(0)
  private shapePaths: Path2D[] = []
  private shapeSource: ReadonlyArray<string> | undefined
  private assembled = false
  private pointerX = 0
  private pointerY = 0
  private pointerActive = false

  constructor(options: DotMatrixTextOptions) {
    this.options = options
  }

  setOptions(options: DotMatrixTextOptions) {
    const prev = this.options
    this.options = options
    const relayout =
      options.text !== prev.text ||
      options.fontSize !== prev.fontSize ||
      options.fontWeight !== prev.fontWeight ||
      options.fontFamily !== prev.fontFamily ||
      options.gap !== prev.gap ||
      options.align !== prev.align ||
      options.fitWidth !== prev.fitWidth ||
      options.scatter !== prev.scatter ||
      options.order !== prev.order ||
      options.stagger !== prev.stagger ||
      options.seed !== prev.seed ||
      options.points !== prev.points ||
      options.links !== prev.links
    if (relayout) this.layout()
    this.idle = false
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.layout()
  }

  replay() {
    this.startedAt = 0
    this.assembled = false
    this.idle = false
  }

  private layout() {
    this.count = 0
    if (this.width === 0 || this.height === 0) return
    this.squares = new Uint8Array(0)
    const sampled = this.options.points ? this.layoutPoints() : this.layoutText()
    if (!sampled) return
    const { points, x0, extent } = sampled
    const { scatter, order, stagger, seed } = this.options
    const count = points.length / 2
    const rand = mulberry32(seed)
    this.count = count
    this.target = Float32Array.from(points)
    this.start = new Float32Array(count * 2)
    this.delay = new Float32Array(count)
    this.offset = new Float32Array(count * 2)
    this.velocity = new Float32Array(count * 2)
    this.pos = new Float32Array(count * 2)
    this.radii = new Float32Array(count)
    const cx = this.width / 2
    for (let i = 0; i < count; i++) {
      const tx = this.target[i * 2]!
      const ty = this.target[i * 2 + 1]!
      const angle = rand() * TAU
      const dist = scatter * (0.35 + rand() * 0.65)
      this.start[i * 2] = tx + Math.cos(angle) * dist
      this.start[i * 2 + 1] = ty + Math.sin(angle) * dist
      const t =
        order === 'left'
          ? (tx - x0) / Math.max(1, extent)
          : order === 'center'
            ? Math.abs(tx - cx) / Math.max(1, extent / 2)
            : rand()
      this.delay[i] = Math.min(1, t) * stagger
    }
    this.replay()
  }

  private layoutPoints() {
    const { points, gap, align, dotSize } = this.options
    if (!points || points.length === 0) return null
    let cols = 0
    let rows = 0
    for (const [c, r] of points) {
      cols = Math.max(cols, c + 1)
      rows = Math.max(rows, r + 1)
    }
    const pad = dotSize / 2
    const w = (cols - 1) * gap + dotSize
    const h = (rows - 1) * gap + dotSize
    const x0 =
      (align === 'left' ? 0 : align === 'right' ? this.width - w : (this.width - w) / 2) + pad
    const y0 = (this.height - h) / 2 + pad
    const out: number[] = []
    for (const [c, r] of points) out.push(x0 + c * gap, y0 + r * gap)
    this.squares = Uint8Array.from(points, (point) => point[2] ?? 0)
    return { points: out, x0, extent: w }
  }

  private layoutText() {
    const { text, fontWeight, fontFamily, gap, align, fitWidth } = this.options
    let { fontSize } = this.options
    if (!text) return null

    const font = (size: number) => `${fontWeight} ${size}px ${fontFamily}`
    const probe = createMeasureContext(1, 1)
    if (!probe) return null
    probe.font = font(fontSize)
    let textWidth = probe.measureText(text).width
    if (fitWidth && textWidth > this.width) {
      fontSize = Math.max(8, (fontSize * this.width) / textWidth)
      probe.font = font(fontSize)
      textWidth = probe.measureText(text).width
    }

    const w = Math.ceil(textWidth) + gap * 2
    const h = Math.ceil(fontSize * 1.3)
    const ctx = createMeasureContext(w, h)
    if (!ctx) return null
    ctx.font = font(fontSize)
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(text, gap, h / 2)
    const data = ctx.getImageData(0, 0, w, h).data

    const x0 =
      align === 'left'
        ? 0
        : align === 'right'
          ? this.width - textWidth
          : (this.width - textWidth) / 2
    const y0 = (this.height - h) / 2
    const points: number[] = []
    for (let y = gap / 2; y < h; y += gap) {
      const row = Math.round(y) * w
      for (let x = gap / 2; x < w; x += gap) {
        const alpha = data[(row + Math.round(x)) * 4 + 3]!
        if (alpha > 128) points.push(x0 + x - gap, y0 + y)
      }
    }
    return { points, x0, extent: textWidth }
  }

  setPointer(x: number, y: number, active: boolean) {
    if (!this.options.interactive) return
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active
    this.idle = false
  }

  tick(dt: number, now: number) {
    if (!this.startedAt) this.startedAt = now
    const { duration, radius, strength, interactive } = this.options
    const { count, target, offset, velocity, delay } = this
    const elapsed = now - this.startedAt
    const usePointer = interactive && this.pointerActive
    const r2 = radius * radius
    let done = true
    let energy = 0

    for (let i = 0; i < count; i++) {
      const ix = i * 2
      const iy = ix + 1
      if (elapsed < delay[i]! + duration) done = false
      let tx = 0
      let ty = 0
      if (usePointer) {
        const dx = target[ix]! - this.pointerX
        const dy = target[iy]! - this.pointerY
        const d2 = dx * dx + dy * dy
        if (d2 < r2 && d2 > 0.0001) {
          const d = Math.sqrt(d2)
          const f = 1 - d / radius
          const push = (strength * f * f) / d
          tx = dx * push
          ty = dy * push
        }
      }
      const ox = offset[ix]!
      const oy = offset[iy]!
      let vx = velocity[ix]!
      let vy = velocity[iy]!
      vx += ((tx - ox) * STIFFNESS - vx * DAMPING) * dt
      vy += ((ty - oy) * STIFFNESS - vy * DAMPING) * dt
      const nx = ox + vx * dt
      const ny = oy + vy * dt
      offset[ix] = nx
      offset[iy] = ny
      velocity[ix] = vx
      velocity[iy] = vy
      energy += Math.abs(vx) + Math.abs(vy) + Math.abs(nx - tx) + Math.abs(ny - ty)
    }

    this.assembled = done
    this.idle = done && energy < SETTLE * Math.max(1, count)
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { dotSize, color, duration, links, linkWidth } = this.options
    const { count, target, start, offset, delay, pos, radii } = this
    const elapsed = this.startedAt ? performance.now() - this.startedAt : 0
    const r = dotSize / 2
    for (let i = 0; i < count; i++) {
      const ix = i * 2
      const iy = ix + 1
      const p = this.assembled ? 1 : Math.min(1, Math.max(0, (elapsed - delay[i]!) / duration))
      const e = easeOutExpo(p)
      pos[ix] = start[ix]! + (target[ix]! - start[ix]!) * e + offset[ix]!
      pos[iy] = start[iy]! + (target[iy]! - start[iy]!) * e + offset[iy]!
      radii[i] = r * (0.3 + 0.7 * e)
    }
    ctx.fillStyle = color
    ctx.strokeStyle = color
    ctx.lineCap = 'round'
    if (links && this.options.points) {
      for (const [a, b, width = linkWidth] of links) {
        if (a >= count || b >= count) continue
        ctx.lineWidth = Math.min(radii[a]!, radii[b]!) * 2 * width
        ctx.beginPath()
        ctx.moveTo(pos[a * 2]!, pos[a * 2 + 1]!)
        ctx.lineTo(pos[b * 2]!, pos[b * 2 + 1]!)
        ctx.stroke()
      }
    }
    const { squareSize, squareRadius } = this.options
    const squares = this.squares
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const x = pos[i * 2]!
      const y = pos[i * 2 + 1]!
      const rr = radii[i]!
      if (squares[i] === 1) {
        const half = rr * squareSize
        ctx.roundRect(x - half, y - half, half * 2, half * 2, half * 2 * squareRadius)
      } else if (squares[i] === 2) {
        // Four inward arcs fill the inside corner between squares
        const d = rr * squareSize
        ctx.moveTo(x, y - d)
        ctx.arc(x + d, y - d, d, Math.PI, Math.PI / 2, true)
        ctx.arc(x + d, y + d, d, Math.PI * 1.5, Math.PI, true)
        ctx.arc(x - d, y + d, d, 0, -Math.PI / 2, true)
        ctx.arc(x - d, y - d, d, Math.PI / 2, 0, true)
        ctx.closePath()
      } else if ((squares[i] ?? 0) < 3) {
        ctx.moveTo(x + rr, y)
        ctx.arc(x, y, rr, 0, TAU)
      }
    }
    ctx.fill()
    this.drawShapes(ctx, r)
  }

  // Custom shapes are unit paths scaled to the grid gap
  private drawShapes(ctx: CanvasRenderingContext2D, r: number) {
    const { shapes, gap } = this.options
    if (shapes !== this.shapeSource) {
      this.shapeSource = shapes
      this.shapePaths =
        shapes && typeof Path2D !== 'undefined' ? shapes.map((d) => new Path2D(d)) : []
    }
    if (this.shapePaths.length === 0) return
    const { count, pos, radii, squares } = this
    const base = ctx.getTransform()
    for (let i = 0; i < count; i++) {
      const shape = this.shapePaths[squares[i]! - 3]
      if (!shape) continue
      const scale = (gap * radii[i]!) / r
      ctx.translate(pos[i * 2]!, pos[i * 2 + 1]!)
      ctx.scale(scale, scale)
      ctx.fill(shape)
      ctx.setTransform(base)
    }
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    this.assembled = true
    this.offset.fill(0)
    this.velocity.fill(0)
    this.draw(ctx)
  }
}
