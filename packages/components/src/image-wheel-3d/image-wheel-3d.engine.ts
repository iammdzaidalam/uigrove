export type ImageWheel3DMode = 'scroll' | 'animate'

export interface ImageWheel3DEngineOptions {
  count: number
  mode: ImageWheel3DMode
  cardWidth: number
  cardHeight: number
  padding: number
  tilt: number
  fov: number
  elevation: number
  autoRotateSpeed: number
  wheelSpeed: number
  dragSpeed: number
  smoothing: number
  hoverLift: number
  parallax: boolean
  instant: boolean
}

const DEG = Math.PI / 180
const TAU = Math.PI * 2
const CAMERA_DISTANCE = Math.hypot(400, 400)
const RING_HEIGHT = 100
const PARALLAX_X = 30
const PARALLAX_Y = 100
const CAMERA_LERP = 0.08
const LIFT_LERP = 0.1
const WHEEL_GAP = 8
const RASTER = 1.5
const ANGLE_EPSILON = 1e-5
const UNIT_EPSILON = 0.01

function approach(current: number, target: number, k: number, epsilon: number) {
  const next = current + (target - current) * k
  return Math.abs(target - next) < epsilon ? target : next
}

// Per-frame lerp factor at 60Hz turned into a frame-rate independent one
function perFrame(factor: number, dt: number) {
  return 1 - Math.pow(1 - Math.min(Math.max(factor, 0), 1), dt * 60)
}

export class ImageWheel3DEngine {
  options: ImageWheel3DEngineOptions
  width = 0
  height = 0
  rotation = 0
  target = 0
  cameraX = 0
  cameraY = 0
  cameraZ = 0
  pointerX = 0
  pointerY = 0
  inside = false
  dragging = false
  hovered = -1
  idle = true
  focal = 1
  scale = 1
  radius = 1
  cardScale = 1
  layoutVersion = 0
  lifts: number[] = []
  dirty: number[] = []
  private view = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  private distance = CAMERA_DISTANCE
  private dragX = 0
  private dragY = 0
  private dragRotation = 0
  private swipe = 0
  private lastWheel = -Infinity

  constructor(options: ImageWheel3DEngineOptions) {
    this.options = options
    const base = this.cameraBase()
    this.cameraY = base.y
    this.cameraZ = base.z
    this.syncCards()
    this.layout()
  }

  get spacing() {
    return TAU / Math.max(1, this.options.count)
  }

  // Card whose face points straight at the viewer
  get frontIndex() {
    const count = Math.max(1, this.options.count)
    return ((Math.round(-this.rotation / this.spacing) % count) + count) % count
  }

  setOptions(next: Partial<ImageWheel3DEngineOptions>) {
    const previous = this.options
    this.options = { ...previous, ...next }
    if (this.options.mode !== previous.mode) this.target = this.rotation
    if (this.options.instant) {
      const base = this.cameraBase()
      this.cameraX = base.x
      this.cameraY = base.y
      this.cameraZ = base.z
    }
    this.syncCards()
    this.layout()
    this.idle = false
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.layout()
    this.idle = false
  }

  setPointer(x: number, y: number | null) {
    if (y === null || !this.width || !this.height) {
      this.inside = false
    } else {
      this.inside = true
      this.pointerX = (x / this.width) * 2 - 1
      this.pointerY = -((y / this.height) * 2 - 1)
    }
    this.idle = false
  }

  // Returns false when the event lands inside the throttle window
  wheel(deltaPx: number, time: number) {
    if (time - this.lastWheel < WHEEL_GAP) return false
    this.lastWheel = time
    this.target += (deltaPx / 100) * this.options.wheelSpeed * DEG
    this.idle = false
    return true
  }

  dragStart(x: number, y: number) {
    this.dragging = true
    this.dragX = x
    this.dragY = y
    this.swipe = 0
    this.dragRotation = this.options.mode === 'animate' ? this.rotation : this.target
    this.target = this.dragRotation
    this.idle = false
  }

  dragMove(x: number, y: number, swipe: boolean) {
    if (!this.dragging) return
    const o = this.options
    const turn = ((x - this.dragX) / Math.max(1, this.width)) * TAU * o.dragSpeed
    if (swipe && o.mode === 'scroll') {
      this.swipe += ((this.dragY - y) / 100) * o.wheelSpeed * DEG
      this.dragY = y
    }
    this.target = this.dragRotation + turn + this.swipe
    if (o.mode === 'animate') this.rotation = this.target
    this.idle = false
  }

  dragEnd() {
    this.dragging = false
    this.idle = false
  }

  step(direction: number) {
    this.target += direction * this.spacing
    this.idle = false
  }

  tick(dt: number) {
    const o = this.options
    this.dirty.length = 0
    const spinning = o.mode === 'animate' && !o.instant && !this.dragging && o.autoRotateSpeed !== 0
    if (spinning) {
      const delta = -o.autoRotateSpeed * DEG * dt
      this.rotation += delta
      this.target += delta
    }
    const ks = o.instant ? 1 : perFrame(o.smoothing, dt)
    this.rotation = approach(this.rotation, this.target, ks, ANGLE_EPSILON)

    const aim = this.cameraAim()
    const kc = o.instant ? 1 : perFrame(CAMERA_LERP, dt)
    this.cameraX = approach(this.cameraX, aim.x, kc, UNIT_EPSILON)
    this.cameraY = approach(this.cameraY, aim.y, kc, UNIT_EPSILON)
    this.cameraZ = approach(this.cameraZ, aim.z, kc, UNIT_EPSILON)
    this.updateView()

    this.hovered = o.mode === 'scroll' && this.inside ? this.pick(this.pointerX, this.pointerY) : -1
    const kl = o.instant ? 1 : perFrame(LIFT_LERP, dt)
    let lifting = false
    for (let i = 0; i < this.lifts.length; i++) {
      const current = this.lifts[i] ?? 0
      const goal = i === this.hovered ? o.hoverLift : 0
      if (current === goal) continue
      this.lifts[i] = approach(current, goal, kl, UNIT_EPSILON)
      this.dirty.push(i)
      lifting = true
    }

    this.idle =
      !spinning &&
      !this.dragging &&
      !lifting &&
      this.rotation === this.target &&
      this.cameraX === aim.x &&
      this.cameraY === aim.y &&
      this.cameraZ === aim.z
  }

  // Ray from the camera through the pointer, nearest card wins
  pick(ndcX: number, ndcY: number) {
    const o = this.options
    const half = Math.tan((o.fov * DEG) / 2)
    const aspect = this.height ? this.width / this.height : 1
    const dx = ndcX * half * aspect
    const dy = ndcY * half
    const m = this.view
    const [m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1] = m
    const halfW = (o.cardWidth * this.cardScale) / 2
    const halfH = (o.cardHeight * this.cardScale) / 2
    const count = this.lifts.length
    let best = -1
    let bestT = Infinity
    for (let i = 0; i < count; i++) {
      const angle = i * this.spacing
      const s = Math.sin(angle)
      const c = Math.cos(angle)
      const gx = this.radius * s
      const gy = RING_HEIGHT + (this.lifts[i] ?? 0)
      const gz = this.radius * c
      const cx = m00 * gx + m01 * gy + m02 * gz
      const cy = m10 * gx + m11 * gy + m12 * gz
      const cz = m20 * gx + m21 * gy + m22 * gz - this.distance
      const nx = m00 * c - m02 * s
      const ny = m10 * c - m12 * s
      const nz = m20 * c - m22 * s
      const denom = nx * dx + ny * dy - nz
      if (Math.abs(denom) < 1e-9) continue
      const t = (nx * cx + ny * cy + nz * cz) / denom
      if (t <= 0 || t >= bestT) continue
      const px = dx * t - cx
      const py = dy * t - cy
      const pz = -t - cz
      const across = -(
        px * (m00 * s + m02 * c) +
        py * (m10 * s + m12 * c) +
        pz * (m20 * s + m22 * c)
      )
      const up = px * m01 + py * m11 + pz * m21
      if (Math.abs(across) <= halfW && Math.abs(up) <= halfH) {
        best = i
        bestT = t
      }
    }
    return best
  }

  stageTransform() {
    const [m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1] =
      this.view
    const z = this.focal - this.scale * this.distance
    // Row and column one negated to flip y into CSS
    return `matrix3d(${m00},${-m10},${m20},0,${-m01},${m11},${-m21},0,${m02},${-m12},${m22},0,0,0,${z},1)`
  }

  cardTransform(index: number) {
    const angle = index * this.spacing
    const s = this.scale
    const x = this.radius * Math.sin(angle) * s
    const y = -(RING_HEIGHT + (this.lifts[index] ?? 0)) * s
    const z = this.radius * Math.cos(angle) * s
    return `translate3d(${x}px,${y}px,${z}px) rotateY(${angle + Math.PI / 2}rad)`
  }

  cardSize() {
    const o = this.options
    const k = this.cardScale * this.scale
    return {
      width: o.cardWidth * k,
      height: o.cardHeight * k,
      short: Math.min(o.cardWidth, o.cardHeight) * k,
    }
  }

  private layout() {
    const o = this.options
    const width = Math.max(1, this.width)
    const height = Math.max(1, this.height)
    const half = Math.tan((o.fov * DEG) / 2)
    const visibleHeight = 2 * CAMERA_DISTANCE * half
    const fit = Math.min((visibleHeight * width) / height, visibleHeight)
    this.focal = height / 2 / half
    this.scale = (this.focal / CAMERA_DISTANCE) * RASTER
    this.radius = Math.max(1, (fit / 2) * (1 - 2 * o.padding))
    this.cardScale = Math.min(width / height, 1)
    this.layoutVersion++
    this.updateView()
  }

  private syncCards() {
    const count = Math.max(0, Math.round(this.options.count))
    if (this.lifts.length > count) this.lifts.length = count
    while (this.lifts.length < count) this.lifts.push(0)
    if (this.hovered >= count) this.hovered = -1
  }

  private cameraBase() {
    const elevation = this.options.elevation * DEG
    return {
      x: 0,
      y: CAMERA_DISTANCE * Math.sin(elevation),
      z: CAMERA_DISTANCE * Math.cos(elevation),
    }
  }

  private cameraAim() {
    const base = this.cameraBase()
    if (!this.options.parallax || this.options.instant) return base
    return {
      x: -this.pointerX * PARALLAX_X,
      y: base.y + this.pointerY * PARALLAX_Y,
      z: base.z + Math.abs(this.pointerX) * PARALLAX_X,
    }
  }

  // View rotation of the camera times the tilted, spun ring
  private updateView() {
    const px = this.cameraX
    const py = this.cameraY
    const pz = this.cameraZ
    const distance = Math.hypot(px, py, pz) || 1
    const zx = px / distance
    const zy = py / distance
    const zz = pz / distance
    const side = Math.hypot(zz, zx) || 1
    const xx = zz / side
    const xz = -zx / side
    const yx = zy * xz
    const yy = zz * xx - zx * xz
    const yz = -zy * xx
    const tilt = -this.options.tilt * DEG
    const ca = Math.cos(tilt)
    const sa = Math.sin(tilt)
    const cb = Math.cos(this.rotation)
    const sb = Math.sin(this.rotation)
    const g00 = cb
    const g02 = sb
    const g10 = sa * sb
    const g11 = ca
    const g12 = -sa * cb
    const g20 = -ca * sb
    const g21 = sa
    const g22 = ca * cb
    this.distance = distance
    this.view = [
      xx * g00 + xz * g20,
      xz * g21,
      xx * g02 + xz * g22,
      yx * g00 + yy * g10 + yz * g20,
      yy * g11 + yz * g21,
      yx * g02 + yy * g12 + yz * g22,
      zx * g00 + zy * g10 + zz * g20,
      zy * g11 + zz * g21,
      zx * g02 + zy * g12 + zz * g22,
    ]
  }
}
