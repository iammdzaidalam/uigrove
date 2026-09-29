'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { CircularGalleryEngine } from './circular-gallery.engine'

export interface CircularGalleryItem {
  image: string
  title: string
  alt?: string
}

export interface CircularGalleryOptions {
  radius: number
  itemWidth: number
  itemHeight: number
  bend: number
  count: number
  zoom: number
  zoomOffset: number
  speed: number
  smoothing: number
  inertia: boolean
  snap: boolean
  hover: boolean
  autoplay: boolean
  autoplaySpeed: number
}

export interface CircularGalleryProps extends Partial<CircularGalleryOptions> {
  items: CircularGalleryItem[]
  onActiveChange?: (index: number) => void
  className?: string
  style?: CSSProperties
}

export const circularGalleryDefaults: CircularGalleryOptions = {
  radius: 224,
  itemWidth: 40,
  itemHeight: 45,
  bend: 1,
  count: 25,
  zoom: 5,
  zoomOffset: 0,
  speed: 0.5,
  smoothing: 1,
  inertia: true,
  snap: false,
  hover: true,
  autoplay: false,
  autoplaySpeed: 0.4,
}

const DEG = Math.PI / 180
const MAX_DT = 1 / 30
const CARD_PERSPECTIVE = 1000
const CARD_RADIUS = 4
const WHEEL_CLAMP = 400
const WHEEL_UNIT = 120
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface DragState {
  active: boolean
  x: number
  y: number
  angle: number
}

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  )
}

function wrapAngle(angle: number) {
  return ((((angle + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI
}

export function CircularGallery({
  items,
  radius = circularGalleryDefaults.radius,
  itemWidth = circularGalleryDefaults.itemWidth,
  itemHeight = circularGalleryDefaults.itemHeight,
  bend = circularGalleryDefaults.bend,
  count = circularGalleryDefaults.count,
  zoom = circularGalleryDefaults.zoom,
  zoomOffset = circularGalleryDefaults.zoomOffset,
  speed = circularGalleryDefaults.speed,
  smoothing = circularGalleryDefaults.smoothing,
  inertia = circularGalleryDefaults.inertia,
  snap = circularGalleryDefaults.snap,
  hover = circularGalleryDefaults.hover,
  autoplay = circularGalleryDefaults.autoplay,
  autoplaySpeed = circularGalleryDefaults.autoplaySpeed,
  onActiveChange,
  className,
  style,
}: CircularGalleryProps) {
  const cards = Math.max(3, Math.round(count))
  const reduced = useReducedMotion()
  const engineRef = useRef<CircularGalleryEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new CircularGalleryEngine({
      count: cards,
      radius,
      itemWidth,
      itemHeight,
      hover,
      smoothing,
      inertia,
      snap,
      autoplay,
      autoplaySpeed,
      instant: false,
    })
  }
  const engine = engineRef.current
  const [active, setActive] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const captionRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const layoutRef = useRef({ bend, zoom, zoomOffset })
  const speedRef = useRef(speed)
  const dragRef = useRef<DragState>({ active: false, x: 0, y: 0, angle: 0 })
  const wakeRef = useRef<() => void>(() => {})
  const changeRef = useRef(onActiveChange)

  const wake = useCallback(() => wakeRef.current(), [])

  useEffect(() => {
    changeRef.current = onActiveChange
  }, [onActiveChange])

  useEffect(() => {
    engine.setOptions({
      count: cards,
      radius,
      itemWidth,
      itemHeight,
      hover,
      smoothing,
      inertia,
      snap,
      autoplay,
      autoplaySpeed,
      instant: reduced,
    })
    wake()
  }, [
    engine,
    wake,
    cards,
    radius,
    itemWidth,
    itemHeight,
    hover,
    smoothing,
    inertia,
    snap,
    autoplay,
    autoplaySpeed,
    reduced,
  ])

  useEffect(() => {
    layoutRef.current = { bend, zoom, zoomOffset }
    speedRef.current = speed
    engine.idle = false
    wake()
  }, [engine, wake, bend, zoom, zoomOffset, speed])

  useEffect(() => {
    const viewport = viewportRef.current
    const stage = stageRef.current
    const ring = ringRef.current
    if (!viewport || !stage || !ring) return
    let visible = true
    let frame = 0
    let last = 0
    let lastActive = engine.activeIndex

    const render = () => {
      const layout = layoutRef.current
      const zoomT = engine.zoom
      // Hover fades out as the camera flies in
      const weight = 1 - zoomT
      const fit = engine.fitScale
      const ringSize = engine.options.radius * layout.zoom
      const translate = zoomT * (ringSize * fit + layout.zoomOffset)
      const scale = (fit * (1 + (layout.zoom - 1) * zoomT)) / layout.zoom
      stage.style.transform = `rotate(${engine.twist * weight}deg) rotateX(${engine.tiltX * weight}deg) rotateY(${engine.tiltY * weight}deg)`
      ring.style.transform = `translate3d(0, ${translate}px, 0) scale(${scale})`
      const perspective = CARD_PERSPECTIVE * layout.zoom
      const nodes = cardsRef.current
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const motion = engine.cards[i]
        if (!node || !motion) continue
        const angle = engine.cardAngle(i)
        const push = motion.push * weight * layout.zoom
        const flip = motion.flip * weight
        const swell = 1 + (motion.swell - 1) * weight
        node.style.transform = `perspective(${perspective}px) rotate(${angle}deg) translate3d(0, ${-(ringSize + push)}px, 0) rotate(${-angle * (1 - layout.bend)}deg) rotateY(${flip}deg) scale(${swell})`
      }
      const caption = captionRef.current
      if (caption) caption.style.opacity = String(Math.min(Math.max((zoomT - 0.6) / 0.4, 0), 1))
      if (engine.activeIndex !== lastActive) {
        lastActive = engine.activeIndex
        setActive(lastActive)
        changeRef.current?.(lastActive)
      }
    }

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt)
      render()
      if (!engine.idle) frame = requestAnimationFrame(loop)
      else last = 0
    }

    const start = () => {
      if (frame || !visible) return
      last = 0
      frame = requestAnimationFrame(loop)
    }

    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }

    wakeRef.current = start

    const onWheel = (e: WheelEvent) => {
      // At rest an upward wheel goes back to the page
      if (e.deltaY < 0 && engine.travelTarget <= 0) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientHeight || 800 : 1
      const px = Math.min(Math.max(e.deltaY * unit, -WHEEL_CLAMP), WHEEL_CLAMP)
      engine.wheel((px * speedRef.current) / WHEEL_UNIT)
      start()
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })

    const resize = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect
      engine.resize(rect?.width ?? 0, rect?.height ?? 0)
      render()
      start()
    })
    resize.observe(viewport)

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
      else stop()
    })
    intersection.observe(viewport)

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      viewport.removeEventListener('wheel', onWheel)
      resize.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wakeRef.current = () => {}
    }
  }, [engine])

  const pointerAngle = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left - rect.width / 2
    const y = e.clientY - rect.top - rect.height / 2
    return { x, y, angle: Math.atan2(x, -y), distance: Math.hypot(x, y) }
  }

  // Touch gets no flip: it would fire once and stick
  const trackPointer = (e: PointerEvent<HTMLDivElement>) => {
    const { x, y } = pointerAngle(e)
    engine.setPointer(x, y, e.pointerType !== 'touch')
    wake()
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const point = pointerAngle(e)
    dragRef.current = { active: true, x: point.x, y: point.y, angle: point.angle }
    engine.dragStart()
    trackPointer(e)
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    trackPointer(e)
    const drag = dragRef.current
    if (!drag.active) return
    const point = pointerAngle(e)
    const layout = layoutRef.current
    const ringPx = engine.options.radius * engine.fitScale * (1 + (layout.zoom - 1) * engine.zoom)
    let delta: number
    if (engine.zoom < 0.5 && point.distance > ringPx * 0.25) {
      // Around the ring the pointer angle drives the rotation directly
      delta = -wrapAngle(point.angle - drag.angle) / (engine.spacing * DEG)
    } else {
      delta = -(point.x - drag.x) / ((Math.PI * 2 * ringPx) / cards)
    }
    dragRef.current = { active: true, x: point.x, y: point.y, angle: point.angle }
    engine.dragMove(delta)
    wake()
  }

  const finishDrag = () => {
    const drag = dragRef.current
    if (!drag.active) return
    drag.active = false
    engine.dragEnd()
    wake()
  }

  const onPointerLeave = () => {
    engine.setPointer(0, 0, false)
    engine.inside = false
    wake()
  }

  const onPointerEnter = () => {
    engine.inside = true
    wake()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') engine.step(1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') engine.step(-1)
    else if (e.key === 'Enter' || e.key === ' ') engine.toggleZoom()
    else if (e.key === 'Escape') engine.zoomOut()
    else return
    e.preventDefault()
    wake()
  }

  const cardWidth = itemWidth * zoom
  const cardHeight = itemHeight * zoom
  const spacing = 360 / cards
  const slots = Array.from({ length: cards }, (_, i) => items[i % Math.max(1, items.length)])
  const activeItem = items[active % Math.max(1, items.length)]

  return (
    <div
      className={['uig-circular-gallery', 'overflow-hidden', className].filter(Boolean).join(' ')}
      style={style}
    >
      <div
        ref={viewportRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Circular gallery"
        tabIndex={0}
        className="uig-circular-gallery__viewport relative h-full w-full cursor-grab touch-none select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={onPointerEnter}
        onBlur={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <div
          ref={stageRef}
          className="uig-circular-gallery__stage absolute top-1/2 left-1/2 h-0 w-0 will-change-transform"
        >
          <div
            ref={ringRef}
            className="uig-circular-gallery__ring absolute h-0 w-0 will-change-transform"
          >
            {slots.map((item, i) => (
              <div
                key={i}
                ref={(element) => {
                  cardsRef.current[i] = element
                }}
                aria-hidden={i !== active}
                className="uig-circular-gallery__card absolute overflow-hidden will-change-transform"
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  left: -cardWidth / 2,
                  top: -cardHeight / 2,
                  borderRadius: CARD_RADIUS * zoom,
                  transform: `perspective(${CARD_PERSPECTIVE * zoom}px) rotate(${i * spacing}deg) translate3d(0, ${-radius * zoom}px, 0)`,
                }}
              >
                {item && (
                  <img
                    src={item.image}
                    alt={item.alt ?? item.title}
                    draggable={false}
                    className="uig-circular-gallery__image block h-full w-full object-cover"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div
          ref={captionRef}
          aria-hidden="true"
          className="uig-circular-gallery__caption pointer-events-none absolute inset-x-0 bottom-6 text-center text-sm font-medium tracking-tight"
          style={{ opacity: 0 }}
        >
          {activeItem?.title}
        </div>
      </div>
      <div className="uig-circular-gallery__live sr-only" aria-live="polite">
        {activeItem?.title}
      </div>
    </div>
  )
}
