'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from 'react'
import {
  ScrollSurfEngine,
  cardTransform,
  trackTransform,
  type ScrollSurfStep,
  type ScrollSurfTransform,
  type ScrollSurfVariant,
} from './scroll-surf.engine'

export interface ScrollSurfItem {
  id: string
  image: string
  title: string
  subtitle?: string
  href?: string
}

export interface ScrollSurfOptions {
  variant: ScrollSurfVariant
  perspective: number
  depth: number
  spread: number
  rise: number
  tilt: number
  cardWidth: number
  scrollPerItem: number
  scrollLength: number
  smoothing: number
  showTitles: boolean
  heading: string
  subheading: string
  hint: string
  background: string
  viewportHeight: string
}

export interface ScrollSurfProps extends Partial<ScrollSurfOptions> {
  items: ScrollSurfItem[]
  className?: string
  style?: CSSProperties
}

export const scrollSurfDefaults: ScrollSurfOptions = {
  variant: 'magnetic',
  perspective: 2000,
  depth: 288,
  spread: 240,
  rise: 84,
  tilt: -50,
  cardWidth: 300,
  scrollPerItem: 600,
  scrollLength: 50000,
  smoothing: 0.08,
  showTitles: true,
  heading: 'Field Journal',
  subheading: 'Archive 2026',
  hint: 'Scroll to surf',
  background: '#000000',
  viewportHeight: '100dvh',
}

const MAX_DT = 1 / 30
const AHEAD = 14
const CARD_ASPECT = 4 / 3
const HOVER_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribeMotion(onChange: () => void) {
  const list = window.matchMedia(MOTION_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  )
}

function scrollParentOf(node: HTMLElement): HTMLElement | Window {
  let el = node.parentElement
  while (el) {
    const { overflowY } = getComputedStyle(el)
    if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
      return el
    }
    el = el.parentElement
  }
  return window
}

function translate({ x, y, z }: ScrollSurfTransform) {
  return `translate3d(${x}px, ${y}px, ${z}px)`
}

export function ScrollSurf({
  items,
  variant = scrollSurfDefaults.variant,
  perspective = scrollSurfDefaults.perspective,
  depth = scrollSurfDefaults.depth,
  spread = scrollSurfDefaults.spread,
  rise = scrollSurfDefaults.rise,
  tilt = scrollSurfDefaults.tilt,
  cardWidth = scrollSurfDefaults.cardWidth,
  scrollPerItem = scrollSurfDefaults.scrollPerItem,
  scrollLength = scrollSurfDefaults.scrollLength,
  smoothing = scrollSurfDefaults.smoothing,
  showTitles = scrollSurfDefaults.showTitles,
  heading = scrollSurfDefaults.heading,
  subheading = scrollSurfDefaults.subheading,
  hint = scrollSurfDefaults.hint,
  background = scrollSurfDefaults.background,
  viewportHeight = scrollSurfDefaults.viewportHeight,
  className,
  style,
}: ScrollSurfProps) {
  const count = items.length
  // Enough copies that the track never runs out ahead
  const copies = count ? Math.ceil(AHEAD / count) + 1 : 1
  const reduced = useReducedMotion()
  const hoverEnabled = variant !== 'simple' && !reduced
  const step: ScrollSurfStep = { x: spread, y: -rise, z: -depth }
  const engineRef = useRef<ScrollSurfEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new ScrollSurfEngine({
      count,
      copies,
      scrollPerItem,
      step,
      variant,
      smoothing,
      instant: false,
    })
  }
  const engine = engineRef.current
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const paintedHoverRef = useRef(false)
  const wakeRef = useRef<() => void>(() => {})
  const wake = useCallback(() => wakeRef.current(), [])

  const cardCss = (index: number) => {
    const { x, y, z } = cardTransform(index, engine.step)
    const { scale, lift } = engine.cardState(index)
    return `translate3d(${x}px, ${y + lift}px, ${z}px) rotateY(${tilt}deg) scale(${scale})`
  }

  const paint = () => {
    const track = trackRef.current
    if (track) track.style.transform = translate(engine.trackTransform())
    if (engine.hoverActive || paintedHoverRef.current) {
      cardRefs.current.forEach((el, index) => {
        if (el) el.style.transform = cardCss(index)
      })
    }
    paintedHoverRef.current = engine.hoverActive
    setActive(engine.activeIndex)
  }
  const paintRef = useRef(paint)
  useEffect(() => {
    paintRef.current = paint
  })

  useEffect(() => {
    engine.setOptions({
      count,
      copies,
      scrollPerItem,
      step: { x: spread, y: -rise, z: -depth },
      variant: hoverEnabled ? variant : 'simple',
      smoothing,
      instant: reduced,
    })
    wake()
  }, [
    engine,
    wake,
    count,
    copies,
    scrollPerItem,
    spread,
    rise,
    depth,
    variant,
    hoverEnabled,
    smoothing,
    reduced,
  ])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let visible = true
    let frame = 0
    let last = 0
    let first = true

    const measureCenters = () => {
      cardRefs.current.forEach((el, index) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        engine.setCardCenter(index, rect.left + rect.width / 2, rect.top + rect.height / 2)
      })
    }

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      if (engine.pointer) measureCenters()
      engine.tick(dt)
      paintRef.current()
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

    const measure = () => {
      engine.setTarget(-root.getBoundingClientRect().top, first)
      first = false
      start()
    }

    wakeRef.current = start
    measure()

    window.addEventListener('scroll', measure, { passive: true, capture: true })
    const resize = new ResizeObserver(measure)
    resize.observe(root)

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) measure()
      else stop()
    })
    intersection.observe(root)

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      window.removeEventListener('scroll', measure, { capture: true })
      resize.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wakeRef.current = () => {}
    }
  }, [engine])

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!hoverEnabled || e.pointerType !== 'mouse') return
    engine.setPointer(e.clientX, e.clientY)
    wake()
  }

  const onPointerLeave = () => {
    engine.setPointer(0, null)
    wake()
  }

  const onCardFocus = (e: FocusEvent<HTMLElement>, index: number) => {
    const root = rootRef.current
    if (!root || !count || !e.currentTarget.matches(':focus-visible')) return
    const current = -root.getBoundingClientRect().top
    const loop = count * scrollPerItem
    const ahead = (((index * scrollPerItem - current) % loop) + loop) % loop
    const back = ahead - loop
    const top = ahead > loop / 2 && current + back >= 0 ? back : ahead
    scrollParentOf(root).scrollBy({ top, behavior: reduced ? 'auto' : 'smooth' })
  }

  const activeItem = items[active]
  const cardHeight = Math.round(cardWidth * CARD_ASPECT)
  const fade = reduced ? 0 : 300
  const cards = Array.from({ length: count * copies }, (_, index) => {
    const item = items[index % count]
    const copy = Math.floor(index / count)
    if (!item) return null
    const cardStyle: CSSProperties = {
      width: cardWidth,
      height: cardHeight,
      transform: cardCss(index),
      transformStyle: 'preserve-3d',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    }
    const shared = {
      style: cardStyle,
      ref: (el: HTMLElement | null) => {
        cardRefs.current[index] = el
      },
      tabIndex: copy === 0 ? 0 : -1,
      'aria-hidden': copy > 0 ? true : undefined,
      'aria-current': copy === 0 && index === active ? ('true' as const) : undefined,
      onPointerEnter: () => setHovered(index),
      onPointerLeave: () => setHovered((h) => (h === index ? null : h)),
      onFocus: (e: FocusEvent<HTMLElement>) => onCardFocus(e, index % count),
    }
    const content = (
      <>
        <span
          className="uig-scroll-surf__frame block h-full w-full"
          style={{
            filter: `brightness(${hovered === index ? 1 : 0.75})`,
            transition: `filter ${fade}ms ${HOVER_EASE}`,
          }}
        >
          <img
            src={item.image}
            alt={item.title}
            draggable={false}
            className="uig-scroll-surf__image block h-full w-full object-cover"
          />
        </span>
        <span
          aria-hidden="true"
          className="uig-scroll-surf__shade pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to top right, rgba(0, 0, 0, 0.2), transparent)',
          }}
        />
      </>
    )
    return item.href ? (
      <a
        key={`${item.id}-${copy}`}
        href={item.href}
        className="uig-scroll-surf__card absolute overflow-hidden bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
        {...shared}
      >
        {content}
      </a>
    ) : (
      <div
        key={`${item.id}-${copy}`}
        className="uig-scroll-surf__card absolute overflow-hidden bg-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
        {...shared}
      >
        {content}
      </div>
    )
  })

  return (
    <div
      ref={rootRef}
      className={['uig-scroll-surf', 'relative w-full', className].filter(Boolean).join(' ')}
      style={{ height: scrollLength, ...style }}
    >
      <div
        className="uig-scroll-surf__viewport sticky top-0 w-full overflow-clip text-white"
        style={{ height: viewportHeight, background }}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {showTitles && (
          <div
            className="uig-scroll-surf__heading pointer-events-none absolute z-50 mix-blend-difference"
            style={{ top: '3cqw', left: '3cqw' }}
          >
            {heading && (
              <p
                className="uig-scroll-surf__title font-bold leading-[0.9] tracking-tighter uppercase"
                style={{ fontSize: 'clamp(2rem, 6cqw, 5rem)', marginLeft: '4cqw' }}
              >
                {heading}
              </p>
            )}
            {subheading && (
              <p
                className="uig-scroll-surf__title font-bold leading-[0.9] tracking-tighter uppercase"
                style={{ fontSize: 'clamp(2rem, 6cqw, 5rem)' }}
              >
                {subheading}
                <span className="uig-scroll-surf__count relative top-[0.6em] ml-2 align-top font-mono text-[0.4em] tabular-nums">
                  ({count})
                </span>
              </p>
            )}
          </div>
        )}
        {showTitles && hint && (
          <div
            className="uig-scroll-surf__hint pointer-events-none absolute z-50 font-mono text-xs tracking-wider uppercase opacity-70"
            style={{ bottom: '3cqw', right: '3cqw' }}
          >
            {hint}
          </div>
        )}
        <div
          className="uig-scroll-surf__scene absolute inset-0 flex items-center justify-center"
          style={{ perspective, perspectiveOrigin: '10% 10%' }}
        >
          <div
            ref={trackRef}
            className="uig-scroll-surf__track relative h-0 w-0"
            style={{
              transformStyle: 'preserve-3d',
              transform: translate(trackTransform(engine.progress, step)),
            }}
          >
            {cards}
          </div>
        </div>
      </div>
      <div className="uig-scroll-surf__live sr-only" aria-live="polite">
        {activeItem?.title}
        {activeItem?.subtitle ? `, ${activeItem.subtitle}` : ''}
      </div>
    </div>
  )
}
