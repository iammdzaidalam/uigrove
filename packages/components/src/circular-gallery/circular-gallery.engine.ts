export interface CircularGalleryEngineOptions {
  count: number
  radius: number
  itemWidth: number
  itemHeight: number
  hover: boolean
  smoothing: number
  inertia: boolean
  snap: boolean
  autoplay: boolean
  autoplaySpeed: number
  instant: boolean
}

export interface CircularGalleryCardMotion {
  flip: number
  flipTarget: number
  swell: number
  swellTarget: number
  push: number
  pushTarget: number
}

type Mode = 'idle' | 'drag' | 'coast' | 'settle'

const DEG = Math.PI / 180
const FLY_IN = 2
const FRICTION = 3
const HANDOVER_SPEED = 1.2
const SPRING = 160
const DAMPING = 2 * Math.sqrt(SPRING)
const WHEEL_PAUSE = 0.12
const HOVER_LERP = 0.15
const FALLOFF = 250
const FLIP = 180
const SWELL = 0.3
const PUSH = 50
const TILT = 15
const TWIST = 5

function smoothstep(t: number) {
  return t * t * (3 - 2 * t)
}

function approach(current: number, target: number, k: number, epsilon: number) {
  const next = current + (target - current) * k
  return Math.abs(target - next) < epsilon ? target : next
}

function makeCard(): CircularGalleryCardMotion {
  return { flip: 0, flipTarget: 0, swell: 1, swellTarget: 1, push: 0, pushTarget: 0 }
}

export class CircularGalleryEngine {
  travel = 0
  travelTarget = 0
  offset = 0
  offsetTarget = 0
  velocity = 0
  pointerX = 0
  pointerY = 0
  pointerActive = false
  width = 0
  height = 0
  cards: CircularGalleryCardMotion[] = []
  tiltX = 0
  tiltY = 0
  twist = 0
  tiltXTarget = 0
  tiltYTarget = 0
  twistTarget = 0
  inside = false
  idle = true
  options: CircularGalleryEngineOptions
  private mode: Mode = 'idle'
  private dragSample = 0
  private sinceWheel = Infinity
  private wheelSnapPending = false
  private hoverDirty = true
  private hoverRotation = 0

  constructor(options: CircularGalleryEngineOptions) {
    this.options = options
    this.syncCards()
  }

  get spacing() {
    return 360 / Math.max(1, this.options.count)
  }

  // Wheel travel past the fly-in, in cards
  get ride() {
    return Math.max(0, this.travel - FLY_IN)
  }

  // Ring rotation in cards; the card at a whole number sits at twelve o'clock
  get rotation() {
    return this.ride + this.offset
  }

  // 0 at rest, 1 once the first two cards of wheel travel flew the camera in
  get zoom() {
    return smoothstep(Math.min(Math.max(this.travel / FLY_IN, 0), 1))
  }

  // Shrinks the resting ring into the viewport, never past 1:1
  get fitScale() {
    const o = this.options
    const span = 2 * o.radius + Math.hypot(o.itemWidth, o.itemHeight)
    if (!this.width || !this.height || !span) return 1
    return Math.max(0.01, Math.min(1, Math.min(this.width, this.height) / span))
  }

  get activeIndex() {
    const count = Math.max(1, this.options.count)
    return ((Math.round(this.rotation) % count) + count) % count
  }

  cardAngle(index: number) {
    return (index - this.rotation) * this.spacing
  }

  setOptions(next: Partial<CircularGalleryEngineOptions>) {
    this.options = { ...this.options, ...next }
    this.syncCards()
    this.hoverDirty = true
    this.idle = false
  }

  resize(width: number, height: number) {
    this.width = width
    this.height = height
    this.hoverDirty = true
    this.idle = false
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointerX = x
    this.pointerY = y
    this.pointerActive = active
    this.hoverDirty = true
    this.idle = false
  }

  wheel(deltaCards: number) {
    if (this.mode === 'drag') return
    if (this.mode !== 'idle') {
      this.mode = 'idle'
      this.velocity = 0
      this.offsetTarget = this.offset
    }
    this.travelTarget = Math.max(0, this.travelTarget + deltaCards)
    this.sinceWheel = 0
    this.wheelSnapPending = true
    this.idle = false
  }

  dragStart() {
    this.mode = 'drag'
    this.velocity = 0
    this.dragSample = 0
    this.idle = false
  }

  dragMove(deltaCards: number) {
    if (this.mode !== 'drag') return
    this.offset += deltaCards
    this.offsetTarget = this.offset
    this.dragSample += deltaCards
  }

  dragEnd() {
    if (this.mode !== 'drag') return
    if (this.options.instant || !this.options.inertia) {
      this.settleTo(this.options.snap ? this.nearest(this.offset) : this.offset)
      return
    }
    const projected = this.offset + this.velocity / FRICTION
    this.offsetTarget = this.options.snap ? this.nearest(projected) : projected
    this.mode = 'coast'
    this.idle = false
  }

  step(direction: number) {
    if (this.mode === 'drag') return
    this.velocity = 0
    this.mode = 'idle'
    this.offsetTarget = this.nearest(this.offsetTarget) + direction
    this.idle = false
  }

  // Keyboard zoom keeps the rotation so the same card stays in front
  toggleZoom() {
    if (this.mode === 'drag') return
    if (this.travelTarget >= 1) {
      this.offsetTarget += this.rideTarget
      this.travelTarget = 0
    } else {
      this.travelTarget = FLY_IN
    }
    this.wheelSnapPending = false
    this.idle = false
  }

  zoomOut() {
    if (this.mode === 'drag' || this.travelTarget === 0) return
    this.offsetTarget += this.rideTarget
    this.travelTarget = 0
    this.wheelSnapPending = false
    this.idle = false
  }

  tick(dt: number) {
    const o = this.options
    this.sinceWheel += dt
    if (this.wheelSnapPending && this.sinceWheel > WHEEL_PAUSE) {
      this.wheelSnapPending = false
      if (o.snap) {
        this.travelTarget =
          this.travelTarget < 1 ? 0 : Math.max(FLY_IN, Math.round(this.travelTarget))
      }
    }
    const playing = o.autoplay && !o.instant && !this.inside && this.mode === 'idle'
    if (playing) {
      this.offset += o.autoplaySpeed * dt
      this.offsetTarget = this.offset
    }
    const lerp = 0.16 - Math.min(Math.max(o.smoothing, 0), 1) * 0.12
    const k = o.instant ? 1 : 1 - Math.pow(1 - lerp, dt * 60)
    this.travel = approach(this.travel, this.travelTarget, k, 0.0005)
    switch (this.mode) {
      case 'drag': {
        const sampled = this.dragSample / Math.max(dt, 0.001)
        this.velocity += (sampled - this.velocity) * 0.5
        this.dragSample = 0
        break
      }
      case 'coast': {
        this.offset += this.velocity * dt
        this.velocity *= Math.exp(-FRICTION * dt)
        const passed =
          this.velocity > 0 ? this.offset >= this.offsetTarget : this.offset <= this.offsetTarget
        if (passed || Math.abs(this.velocity) < HANDOVER_SPEED) this.mode = 'settle'
        break
      }
      case 'settle': {
        const diff = this.offsetTarget - this.offset
        this.velocity += (SPRING * diff - DAMPING * this.velocity) * dt
        this.offset += this.velocity * dt
        if (Math.abs(diff) < 0.0005 && Math.abs(this.velocity) < 0.01) {
          this.offset = this.offsetTarget
          this.velocity = 0
          this.mode = 'idle'
        }
        break
      }
      default: {
        this.offset = approach(this.offset, this.offsetTarget, k, 0.0005)
      }
    }
    if (this.hoverDirty || this.rotation !== this.hoverRotation) this.aimHover()
    const hk = o.instant ? 1 : 1 - Math.pow(1 - HOVER_LERP, dt * 60)
    this.tiltX = approach(this.tiltX, this.tiltXTarget, hk, 0.01)
    this.tiltY = approach(this.tiltY, this.tiltYTarget, hk, 0.01)
    this.twist = approach(this.twist, this.twistTarget, hk, 0.01)
    let hoverSettled =
      this.tiltX === this.tiltXTarget &&
      this.tiltY === this.tiltYTarget &&
      this.twist === this.twistTarget
    for (const card of this.cards) {
      card.flip = approach(card.flip, card.flipTarget, hk, 0.01)
      card.swell = approach(card.swell, card.swellTarget, hk, 0.0005)
      card.push = approach(card.push, card.pushTarget, hk, 0.01)
      if (
        card.flip !== card.flipTarget ||
        card.swell !== card.swellTarget ||
        card.push !== card.pushTarget
      ) {
        hoverSettled = false
      }
    }
    this.idle =
      this.mode === 'idle' &&
      !playing &&
      !this.wheelSnapPending &&
      this.travel === this.travelTarget &&
      this.offset === this.offsetTarget &&
      hoverSettled
  }

  private get rideTarget() {
    return Math.max(0, this.travelTarget - FLY_IN)
  }

  private syncCards() {
    const count = Math.max(1, this.options.count)
    if (this.cards.length > count) this.cards.length = count
    while (this.cards.length < count) this.cards.push(makeCard())
  }

  // Targets are aimed only when the pointer or the ring moves
  private aimHover() {
    this.hoverDirty = false
    this.hoverRotation = this.rotation
    const o = this.options
    if (!this.pointerActive || !o.hover || o.instant) {
      this.tiltXTarget = 0
      this.tiltYTarget = 0
      this.twistTarget = 0
      for (const card of this.cards) {
        card.flipTarget = 0
        card.swellTarget = 1
        card.pushTarget = 0
      }
      return
    }
    const percentX = this.width ? this.pointerX / (this.width / 2) : 0
    const percentY = this.height ? this.pointerY / (this.height / 2) : 0
    this.tiltYTarget = percentX * TILT
    this.tiltXTarget = -percentY * TILT
    this.twistTarget = (percentX + percentY) * TWIST
    const fit = this.fitScale
    const x = this.pointerX / fit
    const y = this.pointerY / fit
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i]
      if (!card) continue
      const angle = this.cardAngle(i) * DEG
      const reach = o.radius + card.push
      const distance = Math.hypot(x - reach * Math.sin(angle), y + reach * Math.cos(angle))
      const force = Math.max(0, 1 - distance / FALLOFF)
      card.flipTarget = FLIP * force
      card.swellTarget = 1 + SWELL * force
      card.pushTarget = PUSH * force
    }
  }

  private settleTo(target: number) {
    this.offsetTarget = target
    if (this.options.instant) {
      this.offset = target
      this.velocity = 0
      this.mode = 'idle'
    } else {
      this.mode = 'settle'
    }
    this.idle = false
  }

  // Nearest offset that puts a card exactly at the front
  private nearest(offset: number) {
    return Math.round(this.rideTarget + offset) - this.rideTarget
  }
}
