import type { DotCanvasEngine } from '../lib/dot-canvas'
import { isLand } from './land'

export interface DotGlobeMarker {
  lat: number
  lng: number
  label: string
}

export interface DotGlobeOptions {
  dotSize: number
  dotSpacing: number
  rotationSpeed: number
  drag: boolean
  color: string
  landOpacity: number
  oceanOpacity: number
  backOpacity: number
  atmosphere: boolean
  tilt: number
  markerSize: number
}

export interface GlobeHover {
  index: number
  x: number
  y: number
}

type Mode = 'auto' | 'drag' | 'coast'

const TAU = Math.PI * 2
const DEG = Math.PI / 180
const MAX_PITCH = 75 * DEG
const FRICTION = 3
const BLEND = 4
const REST = 0.0004
const HOVER_RADIUS = 18
const PADDING = 0.06
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export class DotGlobeEngine implements DotCanvasEngine {
  idle = false
  options: DotGlobeOptions
  markers: DotGlobeMarker[] = []
  hover: GlobeHover | null = null
  onHover: ((hover: GlobeHover | null) => void) | null = null
  yaw = 0
  pitch = 0
  private width = 0
  private height = 0
  private radius = 0
  private count = 0
  private unit = new Float32Array(0)
  private land = new Uint8Array(0)
  private screen = new Float32Array(0)
  private markerScreen = new Float32Array(0)
  private mode: Mode = 'auto'
  private yawVelocity = 0
  private pitchVelocity = 0
  private dragYaw = 0
  private dragPitch = 0
  private pointerX = 0
  private pointerY = 0
  private pointerActive = false
  private built = ''

  constructor(options: DotGlobeOptions) {
    this.options = options
    this.pitch = options.tilt * DEG
  }

  setOptions(options: DotGlobeOptions) {
    const previousTilt = this.options.tilt
    this.options = options
    if (options.tilt !== previousTilt && this.mode !== 'drag') this.pitch = options.tilt * DEG
    this.build()
    this.idle = false
  }

  setMarkers(markers: DotGlobeMarker[]) {
    this.markers = markers
    this.markerScreen = new Float32Array(markers.length * 3)
    this.idle = false
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.radius = (Math.min(width, height) / 2) * (1 - PADDING)
    this.idle = false
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active
    this.idle = false
  }

  dragStart() {
    if (!this.options.drag) return
    this.mode = 'drag'
    this.yawVelocity = 0
    this.pitchVelocity = 0
    this.dragYaw = 0
    this.dragPitch = 0
    this.idle = false
  }

  dragMove(dx: number, dy: number) {
    if (this.mode !== 'drag') return
    const scale = 1 / Math.max(40, this.radius)
    const yaw = dx * scale
    const pitch = dy * scale
    this.yaw += yaw
    this.pitch = clamp(this.pitch + pitch, -MAX_PITCH, MAX_PITCH)
    this.dragYaw += yaw
    this.dragPitch += pitch
  }

  dragEnd(instant = false) {
    if (this.mode !== 'drag') return
    this.mode = instant ? 'auto' : 'coast'
    if (instant) {
      this.yawVelocity = 0
      this.pitchVelocity = 0
    }
    this.idle = false
  }

  tick(dt: number) {
    const auto = this.hover ? 0 : this.options.rotationSpeed * DEG
    switch (this.mode) {
      case 'drag': {
        this.yawVelocity += (this.dragYaw / Math.max(dt, 0.001) - this.yawVelocity) * 0.5
        this.pitchVelocity += (this.dragPitch / Math.max(dt, 0.001) - this.pitchVelocity) * 0.5
        this.dragYaw = 0
        this.dragPitch = 0
        break
      }
      case 'coast': {
        this.yaw += this.yawVelocity * dt
        this.pitch = clamp(this.pitch + this.pitchVelocity * dt, -MAX_PITCH, MAX_PITCH)
        const decay = Math.exp(-FRICTION * dt)
        this.yawVelocity *= decay
        this.pitchVelocity *= decay
        if (
          Math.abs(this.yawVelocity) < Math.abs(auto) + 0.02 &&
          Math.abs(this.pitchVelocity) < 0.02
        ) {
          this.mode = 'auto'
        }
        break
      }
      case 'auto': {
        this.yawVelocity += (auto - this.yawVelocity) * (1 - Math.exp(-BLEND * dt))
        this.yaw += this.yawVelocity * dt
        break
      }
    }
    if (this.yaw > TAU || this.yaw < -TAU) this.yaw %= TAU
    this.project()
    this.updateHover()
    this.idle = this.mode === 'auto' && auto === 0 && Math.abs(this.yawVelocity) < REST
  }

  draw(ctx: CanvasRenderingContext2D) {
    const { dotSize, color, landOpacity, oceanOpacity, backOpacity, atmosphere, markerSize } =
      this.options
    const { screen, land, count, markerScreen, markers } = this
    const cx = this.width / 2
    const cy = this.height / 2
    const r = this.radius
    const half = dotSize / 2
    ctx.fillStyle = color
    ctx.strokeStyle = color

    if (atmosphere) {
      ctx.globalAlpha = 0.28
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, r + 6, 0, TAU)
      ctx.stroke()
      ctx.globalAlpha = 0.04
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, TAU)
      ctx.fill()
    }

    const passes: [boolean, boolean, number][] = [
      [false, false, oceanOpacity * backOpacity],
      [false, true, landOpacity * backOpacity],
      [true, false, oceanOpacity],
      [true, true, landOpacity],
    ]
    for (const [front, isLandPass, alpha] of passes) {
      if (alpha <= 0.002) continue
      ctx.globalAlpha = alpha
      ctx.beginPath()
      for (let i = 0; i < count; i++) {
        if ((land[i] === 1) !== isLandPass) continue
        const z = screen[i * 3 + 2]!
        if (z > 0 !== front) continue
        const x = screen[i * 3]!
        const y = screen[i * 3 + 1]!
        const size = front ? half : half * 0.7
        ctx.moveTo(x + size, y)
        ctx.arc(x, y, size, 0, TAU)
      }
      ctx.fill()
    }

    for (let i = 0; i < markers.length; i++) {
      const z = markerScreen[i * 3 + 2]!
      if (z <= -0.05) continue
      const x = markerScreen[i * 3]!
      const y = markerScreen[i * 3 + 1]!
      const hovered = this.hover?.index === i
      const fade = clamp((z + 0.05) / 0.25, 0, 1)
      ctx.globalAlpha = fade
      ctx.beginPath()
      ctx.arc(x, y, markerSize, 0, TAU)
      ctx.fill()
      ctx.globalAlpha = fade * (hovered ? 0.9 : 0.45)
      ctx.lineWidth = hovered ? 1.5 : 1
      ctx.beginPath()
      ctx.arc(x, y, markerSize * (hovered ? 2.6 : 2), 0, TAU)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  drawStatic(ctx: CanvasRenderingContext2D) {
    this.project()
    this.draw(ctx)
  }

  private build() {
    const spacing = Math.max(1, this.options.dotSpacing)
    const key = `${spacing}`
    if (this.built === key) return
    this.built = key
    // Fibonacci sphere spreads dots evenly without latitude rings
    const total = Math.max(64, Math.round(41253 / (spacing * spacing)))
    const points = new Float32Array(total * 3)
    const flags = new Uint8Array(total)
    for (let i = 0; i < total; i++) {
      const y = 1 - (2 * (i + 0.5)) / total
      const ring = Math.sqrt(1 - y * y)
      const phi = i * GOLDEN
      const x = ring * Math.sin(phi)
      const z = ring * Math.cos(phi)
      points[i * 3] = x
      points[i * 3 + 1] = y
      points[i * 3 + 2] = z
      const lat = Math.asin(y) / DEG
      const lng = Math.atan2(x, z) / DEG
      flags[i] = isLand(lat, lng) ? 1 : 0
    }
    this.count = total
    this.unit = points
    this.land = flags
    this.screen = new Float32Array(total * 3)
  }

  private project() {
    const { unit, screen, count } = this
    const cx = this.width / 2
    const cy = this.height / 2
    const r = this.radius
    const cosY = Math.cos(this.yaw)
    const sinY = Math.sin(this.yaw)
    const cosP = Math.cos(this.pitch)
    const sinP = Math.sin(this.pitch)
    for (let i = 0; i < count; i++) {
      const x0 = unit[i * 3]!
      const y0 = unit[i * 3 + 1]!
      const z0 = unit[i * 3 + 2]!
      const x = x0 * cosY + z0 * sinY
      const z = z0 * cosY - x0 * sinY
      const y = y0 * cosP - z * sinP
      const depth = y0 * sinP + z * cosP
      screen[i * 3] = cx + x * r
      screen[i * 3 + 1] = cy - y * r
      screen[i * 3 + 2] = depth
    }
    const markerScreen = this.markerScreen
    for (let i = 0; i < this.markers.length; i++) {
      const marker = this.markers[i]!
      const cosLat = Math.cos(marker.lat * DEG)
      const x0 = cosLat * Math.sin(marker.lng * DEG)
      const y0 = Math.sin(marker.lat * DEG)
      const z0 = cosLat * Math.cos(marker.lng * DEG)
      const x = x0 * cosY + z0 * sinY
      const z = z0 * cosY - x0 * sinY
      const y = y0 * cosP - z * sinP
      const depth = y0 * sinP + z * cosP
      markerScreen[i * 3] = cx + x * r
      markerScreen[i * 3 + 1] = cy - y * r
      markerScreen[i * 3 + 2] = depth
    }
  }

  private updateHover() {
    let next: GlobeHover | null = null
    if (this.pointerActive && this.mode !== 'drag') {
      let best = HOVER_RADIUS * HOVER_RADIUS
      for (let i = 0; i < this.markers.length; i++) {
        if (this.markerScreen[i * 3 + 2]! <= 0) continue
        const x = this.markerScreen[i * 3]!
        const y = this.markerScreen[i * 3 + 1]!
        const dx = x - this.pointerX
        const dy = y - this.pointerY
        const d2 = dx * dx + dy * dy
        if (d2 < best) {
          best = d2
          next = { index: i, x, y }
        }
      }
    }
    const changed =
      (next === null) !== (this.hover === null) ||
      (next !== null && this.hover !== null && next.index !== this.hover.index)
    if (changed) {
      this.hover = next
      this.onHover?.(next)
    } else if (next && this.hover) {
      this.hover = next
    }
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
