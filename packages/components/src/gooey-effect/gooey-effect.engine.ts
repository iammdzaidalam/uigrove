export interface GooeyEffectEngineOptions {
  inertia: boolean
  friction: number
  bounds: boolean
  instant: boolean
}

export interface GooeyBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

interface ItemState {
  x: number
  y: number
  vx: number
  vy: number
  dragging: boolean
  sampleX: number
  sampleY: number
  bounds: GooeyBounds | null
}

const STOP_SPEED = 6

export class GooeyEffectEngine {
  idle = true
  options: GooeyEffectEngineOptions
  private items = new Map<string, ItemState>()

  constructor(options: GooeyEffectEngineOptions) {
    this.options = options
  }

  setOptions(next: Partial<GooeyEffectEngineOptions>) {
    this.options = { ...this.options, ...next }
    if (!this.options.bounds) return
    for (const item of this.items.values()) this.clamp(item)
  }

  add(id: string) {
    if (!this.items.has(id)) {
      this.items.set(id, {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        dragging: false,
        sampleX: 0,
        sampleY: 0,
        bounds: null,
      })
    }
  }

  remove(id: string) {
    this.items.delete(id)
  }

  position(id: string) {
    const item = this.items.get(id)
    return item ? { x: item.x, y: item.y } : { x: 0, y: 0 }
  }

  forEach(callback: (id: string, x: number, y: number) => void) {
    for (const [id, item] of this.items) callback(id, item.x, item.y)
  }

  setBounds(id: string, bounds: GooeyBounds | null) {
    const item = this.items.get(id)
    if (!item) return
    item.bounds = bounds
    this.clamp(item)
  }

  dragStart(id: string) {
    const item = this.items.get(id)
    if (!item) return
    item.dragging = true
    item.vx = 0
    item.vy = 0
    item.sampleX = 0
    item.sampleY = 0
    this.idle = false
  }

  dragMove(id: string, dx: number, dy: number) {
    const item = this.items.get(id)
    if (!item || !item.dragging) return
    const previousX = item.x
    const previousY = item.y
    item.x += dx
    item.y += dy
    this.clamp(item)
    item.sampleX += item.x - previousX
    item.sampleY += item.y - previousY
  }

  dragEnd(id: string) {
    const item = this.items.get(id)
    if (!item || !item.dragging) return
    item.dragging = false
    if (this.options.instant || !this.options.inertia) {
      item.vx = 0
      item.vy = 0
    }
    this.idle = false
  }

  nudge(id: string, dx: number, dy: number) {
    const item = this.items.get(id)
    if (!item || item.dragging) return
    item.vx = 0
    item.vy = 0
    item.x += dx
    item.y += dy
    this.clamp(item)
    this.idle = false
  }

  tick(dt: number) {
    let moving = false
    const decay = Math.exp(-this.options.friction * dt)
    for (const item of this.items.values()) {
      if (item.dragging) {
        // Blend drag speed so release velocity is not one frame
        const step = Math.max(dt, 0.001)
        item.vx += (item.sampleX / step - item.vx) * 0.5
        item.vy += (item.sampleY / step - item.vy) * 0.5
        item.sampleX = 0
        item.sampleY = 0
        moving = true
        continue
      }
      if (Math.hypot(item.vx, item.vy) < STOP_SPEED) {
        item.vx = 0
        item.vy = 0
        continue
      }
      item.x += item.vx * dt
      item.y += item.vy * dt
      item.vx *= decay
      item.vy *= decay
      this.clamp(item)
      moving = true
    }
    this.idle = !moving
  }

  private clamp(item: ItemState) {
    const bounds = item.bounds
    if (!bounds || !this.options.bounds) return
    if (item.x < bounds.minX || item.x > bounds.maxX) {
      item.x = Math.min(Math.max(item.x, bounds.minX), bounds.maxX)
      item.vx = 0
    }
    if (item.y < bounds.minY || item.y > bounds.maxY) {
      item.y = Math.min(Math.max(item.y, bounds.minY), bounds.maxY)
      item.vy = 0
    }
  }
}
