export interface InkBleedCharRect {
  x: number
  y: number
  w: number
  h: number
  space: boolean
}

export interface InkBleedBlobState {
  x: number
  y: number
  r: number
  scale: number
}

export interface InkBleedEngineOptions {
  radius: number
  smoothing: number
  blobs: number
  intensity: number
}

interface Blob {
  x: number
  y: number
  vx: number
  vy: number
  scale: number
}

const GROW_TAU = 0.11
const SHRINK_TAU = 0.03
const TRAIL_RADIUS = 0.72
const TRAIL_OMEGA = 0.8
const SETTLE = 0.05

// Closed-form critically damped spring, stable for any dt
function spring(
  pos: number,
  vel: number,
  target: number,
  omega: number,
  dt: number,
): [number, number] {
  const a = pos - target
  const b = vel + omega * a
  const decay = Math.exp(-omega * dt)
  return [target + (a + b * dt) * decay, (b - omega * (a + b * dt)) * decay]
}

export class InkBleedEngine {
  private options: InkBleedEngineOptions
  private rects: InkBleedCharRect[] = []
  private pointer: { x: number; y: number } | null = null
  private target: { x: number; y: number } | null = null
  private ink: Blob[] = []
  private settled = true

  hovered = -1
  blobs: InkBleedBlobState[] = []

  constructor(options: InkBleedEngineOptions) {
    this.options = { ...options }
    this.syncBlobs()
  }

  get idle() {
    return this.settled
  }

  setOptions(options: Partial<InkBleedEngineOptions>) {
    this.options = { ...this.options, ...options }
    this.syncBlobs()
    this.settled = false
  }

  setChars(rects: InkBleedCharRect[]) {
    this.rects = rects
    this.settled = false
  }

  setPointer(x: number, y: number | null) {
    if (y === null) {
      this.pointer = null
    } else {
      this.pointer = { x, y }
      this.target = { x, y }
      // Hidden ink snaps so it grows under the cursor
      const lead = this.ink[0]
      if (lead && lead.scale < 0.01) {
        for (const blob of this.ink) {
          blob.x = x
          blob.y = y
          blob.vx = 0
          blob.vy = 0
        }
      }
    }
    this.settled = false
  }

  tick(dt: number) {
    if (this.settled) return
    const { radius, smoothing, intensity } = this.options
    const omega = 3 + (1 - Math.min(1, Math.max(0, smoothing))) * 47
    this.hovered = this.findHovered()
    const visible = intensity > 0 && this.hovered >= 0 ? 1 : 0
    let moving = false

    for (let i = 0; i < this.ink.length; i++) {
      const blob = this.ink[i]
      const state = this.blobs[i]
      const prev = this.ink[i - 1]
      if (!blob || !state) continue
      const goal = i === 0 ? this.target : prev ? { x: prev.x, y: prev.y } : null
      if (goal && blob.scale === 0 && visible === 0) {
        // Nothing to see, so park the ink instead of springing it
        blob.x = goal.x
        blob.y = goal.y
        blob.vx = 0
        blob.vy = 0
      } else if (goal) {
        const w = omega * Math.pow(TRAIL_OMEGA, i)
        ;[blob.x, blob.vx] = spring(blob.x, blob.vx, goal.x, w, dt)
        ;[blob.y, blob.vy] = spring(blob.y, blob.vy, goal.y, w, dt)
        if (
          Math.abs(blob.x - goal.x) > SETTLE ||
          Math.abs(blob.y - goal.y) > SETTLE ||
          Math.abs(blob.vx) > SETTLE ||
          Math.abs(blob.vy) > SETTLE
        ) {
          moving = true
        }
      }
      const tau = visible > blob.scale ? GROW_TAU : SHRINK_TAU
      blob.scale += (visible - blob.scale) * (1 - Math.exp(-dt / tau))
      if (Math.abs(visible - blob.scale) > 0.002) moving = true
      else blob.scale = visible
      state.x = blob.x
      state.y = blob.y
      state.r = radius * Math.pow(TRAIL_RADIUS, i)
      state.scale = blob.scale
    }

    this.settled = !moving
  }

  private findHovered() {
    const p = this.pointer
    if (!p) return -1
    return this.rects.findIndex(
      (r) => !r.space && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h,
    )
  }

  private syncBlobs() {
    const count = Math.max(1, Math.round(this.options.blobs))
    while (this.ink.length < count) {
      const prev = this.ink[this.ink.length - 1]
      this.ink.push({ x: prev?.x ?? 0, y: prev?.y ?? 0, vx: 0, vy: 0, scale: 0 })
    }
    this.ink.length = count
    this.blobs = this.ink.map((blob, i) => ({
      x: blob.x,
      y: blob.y,
      r: this.options.radius * Math.pow(TRAIL_RADIUS, i),
      scale: blob.scale,
    }))
  }
}
