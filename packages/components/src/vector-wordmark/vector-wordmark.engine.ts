import type { DotCanvasEngine } from '../lib/dot-canvas'

export interface VectorWordmarkOptions {
  text: string
  path: string
  fontSize: number
  fontWeight: number
  fontFamily: string
  fitWidth: boolean
  color: string
  strokeWidth: number
  dash: number
  reach: number
  speed: number
  damping: number
  guides: boolean
  labels: boolean
  interaction: 'hover' | 'auto' | 'none'
  duration: number
  stagger: number
  intro: boolean
}

type Canvas = OffscreenCanvas | HTMLCanvasElement
type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

interface Glyph {
  left: number
  top: number
  width: number
  height: number
  round: boolean
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const TAU = Math.PI * 2
const PAD = 0.04
const ROUND = 'OCGQDSUBPR0689@oceabdgpqs'
const AUTO_PERIOD = 7
const LABEL_FONT = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
const ARG_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  T: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  A: 7,
  Z: 0,
}

function createCanvas(width: number, height: number): Canvas | null {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function context2d(canvas: Canvas) {
  return canvas.getContext('2d') as Context | null
}

function ease(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function clamp01(t: number) {
  return Math.min(Math.max(t, 0), 1)
}

// Bounding box of an SVG path from its points
function pathBox(d: string): Box | null {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g)
  if (!tokens) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  let command = 'M'
  let i = 0
  const include = (px: number, py: number) => {
    minX = Math.min(minX, px)
    minY = Math.min(minY, py)
    maxX = Math.max(maxX, px)
    maxY = Math.max(maxY, py)
  }
  while (i < tokens.length) {
    const token = tokens[i] ?? ''
    if (/[A-Za-z]/.test(token)) {
      command = token
      i++
      if (command.toUpperCase() === 'Z') {
        x = startX
        y = startY
        continue
      }
    }
    const upper = command.toUpperCase()
    const relative = command !== upper
    const count = ARG_COUNT[upper] ?? 0
    const args = tokens.slice(i, i + count).map(Number)
    if (args.length < count) break
    i += count
    const ox = relative ? x : 0
    const oy = relative ? y : 0
    if (upper === 'H') {
      x = ox + (args[0] ?? 0)
    } else if (upper === 'V') {
      y = oy + (args[0] ?? 0)
    } else if (upper === 'A') {
      x = ox + (args[5] ?? 0)
      y = oy + (args[6] ?? 0)
    } else {
      for (let k = 0; k + 1 < args.length; k += 2)
        include(ox + (args[k] ?? 0), oy + (args[k + 1] ?? 0))
      x = ox + (args[count - 2] ?? 0)
      y = oy + (args[count - 1] ?? 0)
    }
    include(x, y)
    if (upper === 'M') {
      startX = x
      startY = y
      command = relative ? 'l' : 'L'
    }
  }
  if (!Number.isFinite(minX)) return null
  return { x: minX, y: minY, w: Math.max(maxX - minX, 1), h: Math.max(maxY - minY, 1) }
}

export class VectorWordmarkEngine implements DotCanvasEngine {
  idle = false
  options: VectorWordmarkOptions
  private width = 0
  private height = 0
  private dpr = 1
  private glyphs: Glyph[] = []
  private fontPx = 0
  private originX = 0
  private baseline = 0
  private fill: Canvas | null = null
  private line: Canvas | null = null
  private cut: Canvas | null = null
  private layerKey = ''
  private pointerX = 0
  private pointerY = 0
  private pointerActive = false
  private revealX = 0
  private revealY = 0
  private revealVX = 0
  private revealVY = 0
  private open = 0
  private introTime = 0
  private introDone = false
  private time = 0

  constructor(options: VectorWordmarkOptions) {
    this.options = options
  }

  setOptions(options: VectorWordmarkOptions) {
    const restart = options.text !== this.options.text || options.path !== this.options.path
    this.options = options
    if (restart) {
      this.introTime = 0
      this.introDone = false
    }
    if (this.width > 0) this.build()
    this.idle = false
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
    this.layerKey = ''
    this.build()
    this.revealX = width / 2
    this.revealY = height / 2
    this.idle = false
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active && x >= 0 && y >= 0 && x <= this.width && y <= this.height
    this.idle = false
  }

  tick(dt: number) {
    const o = this.options
    this.time += dt
    if (!this.introDone) {
      if (!o.intro) this.introDone = true
      else {
        this.introTime += dt * 1000
        if (this.introTime >= this.introLength()) this.introDone = true
      }
      this.idle = false
      return
    }
    let active = false
    let targetX = this.revealX
    let targetY = this.revealY
    if (o.interaction === 'auto') {
      active = true
      const phase = (this.time * TAU) / AUTO_PERIOD
      targetX = this.width / 2 + this.width * 0.4 * Math.sin(phase)
      targetY = this.height / 2 + this.fontPx * 0.28 * Math.sin(phase * 2 + 1)
    } else if (o.interaction === 'hover' && this.pointerActive) {
      active = true
      targetX = this.pointerX
      targetY = this.pointerY
    }
    if (active && this.open < 0.01) {
      this.revealX = targetX
      this.revealY = targetY
      this.revealVX = 0
      this.revealVY = 0
    }
    if (active) {
      const omega = 4 + o.speed * 20
      const zeta = 0.3 + o.damping * 0.7
      const ax = omega * omega * (targetX - this.revealX) - 2 * zeta * omega * this.revealVX
      const ay = omega * omega * (targetY - this.revealY) - 2 * zeta * omega * this.revealVY
      this.revealVX += ax * dt
      this.revealVY += ay * dt
      this.revealX += this.revealVX * dt
      this.revealY += this.revealVY * dt
    }
    const openTarget = active ? 1 : 0
    this.open += (openTarget - this.open) * (1 - Math.exp(-(active ? 10 : 6) * dt))
    if (!active) {
      this.revealVX = 0
      this.revealVY = 0
      if (this.open < 0.01) this.open = 0
    }
    const settled =
      Math.abs(targetX - this.revealX) < 0.05 &&
      Math.abs(targetY - this.revealY) < 0.05 &&
      Math.hypot(this.revealVX, this.revealVY) < 0.5 &&
      Math.abs(openTarget - this.open) < 0.002
    if (settled) {
      this.open = openTarget
      this.revealVX = 0
      this.revealVY = 0
    }
    this.idle = settled && o.interaction !== 'auto'
  }

  draw(ctx: CanvasRenderingContext2D) {
    const fill = this.fill
    const line = this.line
    const cut = this.cut
    if (!fill || !line || !cut) return
    const { width, height, dpr } = this
    if (!this.introDone) {
      this.drawIntro(ctx, fill, line)
      return
    }
    ctx.drawImage(fill, 0, 0, width, height)
    const radius = this.options.reach * ease(this.open)
    if (radius < 1) return
    const x0 = Math.max(0, Math.floor(this.revealX - radius))
    const y0 = Math.max(0, Math.floor(this.revealY - radius))
    const x1 = Math.min(width, Math.ceil(this.revealX + radius))
    const y1 = Math.min(height, Math.ceil(this.revealY + radius))
    const w = x1 - x0
    const h = y1 - y0
    if (w <= 0 || h <= 0) return
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = this.mask(ctx, radius)
    ctx.fillRect(x0, y0, w, h)
    ctx.restore()
    const cutCtx = context2d(cut)
    if (!cutCtx) return
    cutCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    cutCtx.clearRect(x0, y0, w, h)
    cutCtx.drawImage(line, x0 * dpr, y0 * dpr, w * dpr, h * dpr, x0, y0, w, h)
    cutCtx.globalCompositeOperation = 'destination-in'
    cutCtx.fillStyle = this.mask(cutCtx, radius)
    cutCtx.fillRect(x0, y0, w, h)
    cutCtx.globalCompositeOperation = 'source-over'
    ctx.drawImage(cut, x0 * dpr, y0 * dpr, w * dpr, h * dpr, x0, y0, w, h)
    if (this.options.guides || this.options.labels) this.drawGuides(ctx, radius)
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    if (this.fill) ctx.drawImage(this.fill, 0, 0, this.width, this.height)
  }

  private introLength() {
    const { duration, stagger } = this.options
    return Math.max(0, this.glyphs.length - 1) * stagger + duration
  }

  private mask(ctx: Context, radius: number) {
    const gradient = ctx.createRadialGradient(
      this.revealX,
      this.revealY,
      0,
      this.revealX,
      this.revealY,
      radius,
    )
    gradient.addColorStop(0, 'rgba(0,0,0,1)')
    gradient.addColorStop(0.55, 'rgba(0,0,0,1)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    return gradient
  }

  private drawIntro(ctx: CanvasRenderingContext2D, fill: Canvas, line: Canvas) {
    const { duration, stagger, strokeWidth } = this.options
    const dpr = this.dpr
    const grow = strokeWidth * 2 + 2
    this.glyphs.forEach((glyph, i) => {
      const p = clamp01((this.introTime - i * stagger) / duration)
      if (p <= 0) return
      const outline = ease(clamp01(p / 0.6))
      const filled = ease(clamp01((p - 0.45) / 0.55))
      const x = glyph.left - grow
      const y = glyph.top - grow
      const w = glyph.width + grow * 2
      const h = glyph.height + grow * 2
      if (filled < 1) {
        const shown = w * outline
        ctx.globalAlpha = 1 - filled
        ctx.drawImage(line, x * dpr, y * dpr, shown * dpr, h * dpr, x, y, shown, h)
      }
      if (filled > 0) {
        ctx.globalAlpha = filled
        ctx.drawImage(fill, x * dpr, y * dpr, w * dpr, h * dpr, x, y, w, h)
      }
    })
    ctx.globalAlpha = 1
  }

  private drawGuides(ctx: CanvasRenderingContext2D, radius: number) {
    const { color, guides, labels } = this.options
    const size = this.fontPx * 0.3
    const unit = this.fontPx / 100
    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = 1
    ctx.font = LABEL_FONT
    ctx.textBaseline = 'alphabetic'
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.08em'
    this.glyphs.forEach((glyph, i) => {
      const cx = glyph.left + glyph.width / 2
      const cy = glyph.top + glyph.height / 2
      const distance = Math.hypot(cx - this.revealX, cy - this.revealY)
      const t = clamp01((distance - radius * 0.4) / (radius * 0.9))
      const alpha = ease(this.open) * (1 - t * t * (3 - 2 * t))
      if (alpha < 0.02) return
      const above = i % 2 === 0
      const ax = glyph.left + glyph.width * 0.35
      const bottom = glyph.top + glyph.height
      const boxY = above ? glyph.top - size : bottom
      ctx.globalAlpha = alpha * 0.55
      if (guides) {
        ctx.setLineDash([3, 4])
        ctx.beginPath()
        ctx.rect(ax + 0.5, boxY + 0.5, size, size)
        ctx.moveTo(ax + 0.5, above ? boxY : glyph.top)
        ctx.lineTo(ax + 0.5, above ? bottom : boxY + size)
        ctx.moveTo(ax + size, above ? boxY : boxY + size)
        ctx.lineTo(glyph.left, above ? bottom : glyph.top)
        if (glyph.round) {
          const r = Math.min(glyph.width, glyph.height) * 0.51
          ctx.moveTo(cx + r, cy)
          ctx.arc(cx, cy, r, 0, TAU)
        }
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = alpha * 0.8
        ctx.beginPath()
        const right = glyph.left + glyph.width
        ctx.rect(glyph.left - 2.5, glyph.top - 2.5, 5, 5)
        ctx.rect(right - 2.5, glyph.top - 2.5, 5, 5)
        ctx.rect(glyph.left - 2.5, bottom - 2.5, 5, 5)
        ctx.rect(right - 2.5, bottom - 2.5, 5, 5)
        ctx.stroke()
      }
      if (labels) {
        ctx.globalAlpha = alpha * 0.7
        const ux = Math.round((ax - this.originX) / unit)
        const uy = Math.round((this.baseline - (above ? boxY : boxY + size)) / unit)
        ctx.fillText(`${ux}, ${uy}`, ax + 5, boxY + 13)
      }
    })
    ctx.restore()
  }

  private build() {
    const o = this.options
    const key = [
      this.width,
      this.height,
      this.dpr,
      o.text,
      o.path,
      o.fontSize,
      o.fontWeight,
      o.fontFamily,
      o.fitWidth,
      o.color,
      o.strokeWidth,
      o.dash,
    ].join('|')
    if (key === this.layerKey) return
    this.layerKey = key
    const pw = Math.max(1, Math.round(this.width * this.dpr))
    const ph = Math.max(1, Math.round(this.height * this.dpr))
    this.fill = createCanvas(pw, ph)
    this.line = createCanvas(pw, ph)
    this.cut = createCanvas(pw, ph)
    const fillCtx = this.fill && context2d(this.fill)
    const lineCtx = this.line && context2d(this.line)
    if (!fillCtx || !lineCtx) return
    if (o.path) this.buildPath(fillCtx, lineCtx)
    else this.buildText(fillCtx, lineCtx)
  }

  private buildText(fillCtx: Context, lineCtx: Context) {
    const o = this.options
    const { width, height, dpr } = this
    const font = (px: number) => `${o.fontWeight} ${px}px ${o.fontFamily}`
    fillCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    fillCtx.font = font(o.fontSize)
    const measured = fillCtx.measureText(o.text).width || 1
    let px = o.fontSize
    if (o.fitWidth) px = Math.min((o.fontSize * width * (1 - PAD * 2)) / measured, height * 0.85)
    this.fontPx = px
    fillCtx.font = font(px)
    fillCtx.textBaseline = 'alphabetic'
    const total = fillCtx.measureText(o.text)
    const ascent = total.actualBoundingBoxAscent
    const descent = total.actualBoundingBoxDescent
    this.originX = (width - total.width) / 2
    this.baseline = height / 2 + (ascent - descent) / 2
    this.glyphs = []
    for (let i = 0; i < o.text.length; i++) {
      const char = o.text[i] ?? ''
      if (!char.trim()) continue
      const pen = this.originX + fillCtx.measureText(o.text.slice(0, i)).width
      const m = fillCtx.measureText(char)
      const left = pen - m.actualBoundingBoxLeft
      const top = this.baseline - m.actualBoundingBoxAscent
      this.glyphs.push({
        left,
        top,
        width: m.actualBoundingBoxLeft + m.actualBoundingBoxRight,
        height: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent,
        round: ROUND.includes(char),
      })
    }
    fillCtx.fillStyle = o.color
    fillCtx.fillText(o.text, this.originX, this.baseline)
    lineCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
    lineCtx.font = font(px)
    lineCtx.textBaseline = 'alphabetic'
    lineCtx.strokeStyle = o.color
    lineCtx.lineWidth = o.strokeWidth
    lineCtx.lineJoin = 'round'
    lineCtx.setLineDash(o.dash > 0 ? [o.strokeWidth, o.dash] : [])
    lineCtx.strokeText(o.text, this.originX, this.baseline)
  }

  private buildPath(fillCtx: Context, lineCtx: Context) {
    const o = this.options
    const { width, height, dpr } = this
    const box = pathBox(o.path)
    if (!box) return
    const path = new Path2D(o.path)
    const scale = o.fitWidth
      ? Math.min((width * (1 - PAD * 2)) / box.w, (height * 0.85) / box.h)
      : o.fontSize / box.h
    const tx = (width - box.w * scale) / 2 - box.x * scale
    const ty = (height - box.h * scale) / 2 - box.y * scale
    this.fontPx = box.h * scale
    this.originX = tx + box.x * scale
    this.baseline = ty + (box.y + box.h) * scale
    this.glyphs = [
      {
        left: this.originX,
        top: ty + box.y * scale,
        width: box.w * scale,
        height: box.h * scale,
        round: false,
      },
    ]
    fillCtx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * tx, dpr * ty)
    fillCtx.fillStyle = o.color
    fillCtx.fill(path)
    lineCtx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * tx, dpr * ty)
    lineCtx.strokeStyle = o.color
    lineCtx.lineWidth = o.strokeWidth / scale
    lineCtx.lineJoin = 'round'
    lineCtx.setLineDash(o.dash > 0 ? [o.strokeWidth / scale, o.dash / scale] : [])
    lineCtx.stroke(path)
  }
}
