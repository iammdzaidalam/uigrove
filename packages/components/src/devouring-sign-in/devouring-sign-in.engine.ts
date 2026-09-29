export interface DevouringSignInEngineOptions {
  speed: number
  // Jitter and shrink passes per 60fps frame
  passes: number
}

export interface DevouringPixels {
  data: Uint8ClampedArray
  width: number
  height: number
}

const FRAME = 1 / 60
const SHRINK_PER_PASS = 0.05
const MAX_PASSES = 6

export class DevouringSignInEngine {
  speed: number
  passes: number
  width = 0
  height = 0
  count = 0
  front = 0
  minX = 0
  done = true
  private ox = new Float32Array(0)
  private x = new Float32Array(0)
  private y = new Float32Array(0)
  private size = new Float32Array(0)
  private head = 0
  private tail = 0
  private carry = 0

  constructor(options: DevouringSignInEngineOptions) {
    this.speed = options.speed
    this.passes = options.passes
  }

  setOptions(next: Partial<DevouringSignInEngineOptions>) {
    if (next.speed !== undefined) this.speed = next.speed
    if (next.passes !== undefined) this.passes = next.passes
  }

  // Every covered pixel becomes a particle, sampled right to left
  load(pixels: DevouringPixels) {
    const { data, width, height } = pixels
    const ox = new Float32Array(width * height)
    const y = new Float32Array(width * height)
    let count = 0
    let minX = width
    for (let px = width - 1; px >= 0; px--) {
      for (let py = 0; py < height; py++) {
        if ((data[(py * width + px) * 4 + 3] ?? 0) === 0) continue
        ox[count] = px
        y[count] = py
        count++
        if (px < minX) minX = px
      }
    }
    this.width = width
    this.height = height
    this.count = count
    this.ox = ox.subarray(0, count)
    this.x = Float32Array.from(this.ox)
    this.y = y.subarray(0, count)
    this.size = new Float32Array(count).fill(1)
    this.head = 0
    this.tail = 0
    this.carry = 0
    this.minX = count ? minX : 0
    this.front = count ? (ox[0] ?? 0) + 1 : 0
    this.done = count === 0
  }

  tick(dt: number) {
    if (this.done) return
    this.front -= this.speed * dt
    while (this.tail < this.count && (this.ox[this.tail] ?? 0) >= this.front) this.tail++
    this.carry += (this.passes * dt) / FRAME
    const steps = Math.min(MAX_PASSES, Math.floor(this.carry))
    this.carry -= steps
    for (let pass = 0; pass < steps; pass++) {
      for (let i = this.head; i < this.tail; i++) {
        const size = this.size[i] ?? 0
        if (size <= 0) continue
        this.x[i] = (this.x[i] ?? 0) + (Math.random() > 0.5 ? 1 : -1)
        this.y[i] = (this.y[i] ?? 0) + (Math.random() > 0.5 ? 1 : -1)
        this.size[i] = size - SHRINK_PER_PASS * Math.random()
      }
    }
    while (this.head < this.tail && (this.size[this.head] ?? 0) <= 0) this.head++
    if (this.front < this.minX - 1 && this.head >= this.tail) this.done = true
  }

  // Text left of the front stays, only dust repaints
  draw(ctx: CanvasRenderingContext2D) {
    const from = Math.max(0, Math.floor(this.front))
    ctx.clearRect(from, 0, this.width - from, this.height)
    for (let i = this.head; i < this.tail; i++) {
      const size = this.size[i] ?? 0
      const x = this.x[i] ?? 0
      if (size <= 0 || x <= from) continue
      ctx.fillRect(x - 0.5, (this.y[i] ?? 0) - 0.5, size + 1, size + 1)
    }
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, this.width, this.height)
  }
}
