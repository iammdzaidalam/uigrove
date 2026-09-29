'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { WheelCarouselEngine } from './wheel-carousel.engine'

export interface WheelCarouselItem {
  label: string
  image: string
  alt?: string
}

export interface WheelCarouselOptions {
  radius: number
  spacing: number
  visibleItems: number
  photoSide: 'left' | 'right'
  photoWidth: number
  photoAspect: '3/4' | '1/1' | '4/3'
  labelSize: number
  snap: boolean
  momentum: boolean
  scrollSpeed: number
  dragSpeed: number
  showMarker: boolean
  edgeFade: boolean
  crossfadeDuration: number
  initialIndex: number
}

export interface WheelCarouselProps extends Partial<WheelCarouselOptions> {
  items: WheelCarouselItem[]
  onActiveChange?: (index: number) => void
  className?: string
  style?: CSSProperties
}

export const wheelCarouselDefaults: WheelCarouselOptions = {
  radius: 320,
  spacing: 14,
  visibleItems: 7,
  photoSide: 'left',
  photoWidth: 260,
  photoAspect: '3/4',
  labelSize: 22,
  snap: true,
  momentum: true,
  scrollSpeed: 0.08,
  dragSpeed: 0.25,
  showMarker: true,
  edgeFade: true,
  crossfadeDuration: 400,
  initialIndex: 0,
}

const DEG = Math.PI / 180
const APEX_INSET = 28
const MARKER_INSET = 10
const DRAG_THRESHOLD = 4
const MAX_DT = 1 / 30
const EDGE_MASK = 'linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)'
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface WheelView {
  rotation: number
  active: number
  previous: number
}

interface DragState {
  active: boolean
  y: number
  moved: number
  pressed: number
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

export function WheelCarousel({
  items,
  radius = wheelCarouselDefaults.radius,
  spacing = wheelCarouselDefaults.spacing,
  visibleItems = wheelCarouselDefaults.visibleItems,
  photoSide = wheelCarouselDefaults.photoSide,
  photoWidth = wheelCarouselDefaults.photoWidth,
  photoAspect = wheelCarouselDefaults.photoAspect,
  labelSize = wheelCarouselDefaults.labelSize,
  snap = wheelCarouselDefaults.snap,
  momentum = wheelCarouselDefaults.momentum,
  scrollSpeed = wheelCarouselDefaults.scrollSpeed,
  dragSpeed = wheelCarouselDefaults.dragSpeed,
  showMarker = wheelCarouselDefaults.showMarker,
  edgeFade = wheelCarouselDefaults.edgeFade,
  crossfadeDuration = wheelCarouselDefaults.crossfadeDuration,
  initialIndex = wheelCarouselDefaults.initialIndex,
  onActiveChange,
  className,
  style,
}: WheelCarouselProps) {
  const id = useId()
  const count = items.length
  const reduced = useReducedMotion()
  const engineRef = useRef<WheelCarouselEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new WheelCarouselEngine(
      { count, spacing, snap, momentum, dragSpeed, scrollSpeed, instant: false },
      initialIndex,
    )
  }
  const engine = engineRef.current
  const [view, setView] = useState<WheelView>(() => ({
    rotation: engine.rotation,
    active: engine.activeIndex,
    previous: engine.activeIndex,
  }))
  const [stacked, setStacked] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<() => void>(() => {})
  const changeRef = useRef(onActiveChange)
  const dragRef = useRef<DragState>({ active: false, y: 0, moved: 0, pressed: -1 })

  const wake = useCallback(() => wakeRef.current(), [])

  const publish = useCallback(() => {
    const rotation = engine.rotation
    const active = engine.activeIndex
    setView((current) => {
      if (current.rotation === rotation && current.active === active) return current
      const previous = current.active === active ? current.previous : current.active
      return { rotation, active, previous }
    })
  }, [engine])

  useEffect(() => {
    changeRef.current = onActiveChange
  }, [onActiveChange])

  useEffect(() => {
    engine.setOptions({ count, spacing, snap, momentum, dragSpeed, scrollSpeed, instant: reduced })
    wake()
  }, [engine, wake, count, spacing, snap, momentum, dragSpeed, scrollSpeed, reduced])

  useEffect(() => {
    engine.select(initialIndex)
    wake()
  }, [engine, wake, initialIndex])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? Infinity
      setStacked(width < photoWidth + 200)
    })
    observer.observe(root)
    return () => observer.disconnect()
  }, [photoWidth])

  useEffect(() => {
    const element = windowRef.current
    if (!element) return
    let visible = true
    let frame = 0
    let last = 0
    let lastActive = engine.activeIndex

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt)
      publish()
      if (engine.activeIndex !== lastActive) {
        lastActive = engine.activeIndex
        changeRef.current?.(lastActive)
      }
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
      const direction = Math.sign(e.deltaY)
      if (!direction || !engine.canScroll(direction)) return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
      engine.scroll(e.deltaY * unit)
      start()
    }
    element.addEventListener('wheel', onWheel, { passive: false })

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
      else stop()
    })
    intersection.observe(element)

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      element.removeEventListener('wheel', onWheel)
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wakeRef.current = () => {}
    }
  }, [engine, publish])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    const element = e.currentTarget
    element.focus({ preventScroll: true })
    element.setPointerCapture(e.pointerId)
    const target = e.target instanceof Element ? e.target.closest('[data-index]') : null
    const pressed = target ? Number(target.getAttribute('data-index')) : -1
    dragRef.current = { active: true, y: e.clientY, moved: 0, pressed }
    engine.dragStart()
    wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag.active) return
    const dy = e.clientY - drag.y
    drag.y = e.clientY
    drag.moved += Math.abs(dy)
    engine.dragMove(dy)
    wake()
  }

  const finishDrag = (select: boolean) => {
    const drag = dragRef.current
    if (!drag.active) return
    drag.active = false
    engine.dragEnd()
    if (select && drag.moved < DRAG_THRESHOLD && drag.pressed >= 0) engine.select(drag.pressed)
    wake()
  }

  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved < DRAG_THRESHOLD) return
    e.preventDefault()
    e.stopPropagation()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const active = engine.activeIndex
    let next: number
    if (e.key === 'ArrowUp') next = active - 1
    else if (e.key === 'ArrowDown') next = active + 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = count - 1
    else return
    e.preventDefault()
    engine.select(next)
    wake()
  }

  const onLeft = photoSide === 'left'
  const half = Math.min((spacing * visibleItems) / 2, 90)
  const windowHeight = Math.round(2 * radius * Math.sin(half * DEG) + labelSize * 1.6)
  const centerY = windowHeight / 2
  const fade = reduced ? 0 : crossfadeDuration
  const activeItem = items[view.active]

  return (
    <div
      ref={rootRef}
      className={['uig-wheel-carousel', 'flex items-center gap-8', className]
        .filter(Boolean)
        .join(' ')}
      style={{ flexDirection: stacked ? 'column' : onLeft ? 'row' : 'row-reverse', ...style }}
    >
      <div
        className="uig-wheel-carousel__photo relative shrink-0 overflow-hidden rounded-xl border border-current/10"
        style={{ width: photoWidth, maxWidth: '100%', aspectRatio: photoAspect }}
      >
        {items.map((item, index) => {
          const shown = index === view.active || index === view.previous
          return (
            <img
              key={`${item.image}-${index}`}
              src={item.image}
              alt={item.alt ?? item.label}
              draggable={false}
              aria-hidden={index !== view.active}
              className="uig-wheel-carousel__image absolute inset-0 h-full w-full object-cover"
              style={{
                opacity: shown ? 1 : 0,
                zIndex: index === view.active ? 2 : index === view.previous ? 1 : 0,
                transition: `opacity ${fade}ms ease-out`,
              }}
            />
          )
        })}
      </div>
      <div
        ref={windowRef}
        role="listbox"
        tabIndex={0}
        aria-label="Wheel carousel"
        aria-orientation="vertical"
        aria-activedescendant={`${id}-${view.active}`}
        className="uig-wheel-carousel__window relative w-full min-w-0 flex-1 cursor-grab touch-pan-x select-none rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current active:cursor-grabbing"
        style={{ height: windowHeight }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => finishDrag(true)}
        onPointerCancel={() => finishDrag(false)}
        onLostPointerCapture={() => finishDrag(false)}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
      >
        <div
          className="uig-wheel-carousel__arc absolute inset-0 overflow-hidden"
          style={{
            maskImage: edgeFade ? EDGE_MASK : undefined,
            WebkitMaskImage: edgeFade ? EDGE_MASK : undefined,
          }}
        >
          {items.map((item, index) => {
            const angle = index * spacing - view.rotation
            const distance = Math.abs(angle)
            const hidden = distance > half + spacing
            const rad = angle * DEG
            const y = centerY + radius * Math.sin(rad)
            const inset = APEX_INSET + radius * (1 - Math.cos(rad))
            const opacity = hidden ? 0 : 1 - 0.7 * Math.min(distance / half, 1)
            return (
              <button
                key={`${item.label}-${index}`}
                type="button"
                role="option"
                id={`${id}-${index}`}
                tabIndex={-1}
                data-index={index}
                aria-selected={index === view.active}
                onClick={() => {
                  engine.select(index)
                  wake()
                }}
                className="uig-wheel-carousel__label absolute top-0 left-0 block cursor-pointer leading-none font-medium tracking-tight whitespace-nowrap"
                style={{
                  left: onLeft ? 0 : 'auto',
                  right: onLeft ? 'auto' : 0,
                  fontSize: labelSize,
                  opacity,
                  visibility: hidden ? 'hidden' : undefined,
                  transform: `translate3d(${onLeft ? inset : -inset}px, ${y}px, 0) translateY(-50%)`,
                }}
              >
                {item.label}
              </button>
            )
          })}
        </div>
        {showMarker && (
          <span
            aria-hidden="true"
            className="uig-wheel-carousel__marker pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-current"
            style={{
              top: centerY,
              left: onLeft ? MARKER_INSET : 'auto',
              right: onLeft ? 'auto' : MARKER_INSET,
              transform: 'translateY(-50%)',
            }}
          />
        )}
      </div>
      <div className="uig-wheel-carousel__live sr-only" aria-live="polite">
        {activeItem?.label}
      </div>
    </div>
  )
}
