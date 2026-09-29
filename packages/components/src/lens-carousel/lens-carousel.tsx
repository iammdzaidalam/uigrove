'use client'

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import { LensCarouselEngine, buildLensMaps } from './lens-carousel.engine'

export interface LensCarouselItem {
  title: string
  subtitle?: string
  image: string
  alt?: string
  // Width over height, defaults to cardWidth / cardHeight
  aspect?: number
}

export interface LensCarouselOptions {
  cardWidth: number
  cardHeight: number
  gap: number
  lensWidth: number
  glass: number
  fringe: number
  blur: number
  loop: boolean
  snap: boolean
  inertia: boolean
  showCaption: boolean
  initialIndex: number
  background: string
  color: string
}

export interface LensCarouselProps extends Partial<LensCarouselOptions> {
  items: LensCarouselItem[]
  onActiveChange?: (index: number) => void
  className?: string
  style?: CSSProperties
}

export const lensCarouselDefaults: LensCarouselOptions = {
  cardWidth: 260,
  cardHeight: 324,
  gap: 40,
  lensWidth: 250,
  glass: 0.36,
  fringe: 4,
  blur: 2,
  loop: true,
  snap: true,
  inertia: true,
  showCaption: true,
  initialIndex: 3,
  background: '#d4c5b6',
  color: '#000000',
}

const MAX_DT = 1 / 30
const DRAG_THRESHOLD = 4
const LENS_MAX_SHARE = 0.22
const LENS_ABOVE = 0.6
const MAP_STEP = 3
const EDGE_TRIM = 4
const CAPTION_GAP = 0.37
const KEEP_R = '1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0'
const KEEP_G = '0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0'
const KEEP_B = '0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0'
const MASK_B = '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0'
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface View {
  offset: number
  active: number
  scale: number
}

interface DragState {
  active: boolean
  x: number
  moved: number
  pressed: number
}

interface LensMapUrls {
  left: string[]
  right: string[]
  scale: number
  shift: number
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

function toDataUrl(data: Uint8ClampedArray<ArrayBuffer>, width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return ''
  context.putImageData(new ImageData(data, width, height), 0, 0)
  return canvas.toDataURL()
}

function LensFilter({
  id,
  width,
  height,
  maps,
  scale,
  blur,
}: {
  id: string
  width: number
  height: number
  maps: string[] | undefined
  scale: number
  blur: number
}) {
  const taps = ['r', 'g', 'b'] as const
  return (
    <filter
      id={id}
      filterUnits="userSpaceOnUse"
      primitiveUnits="userSpaceOnUse"
      x="0"
      y="0"
      width={width}
      height={height}
      colorInterpolationFilters="sRGB"
    >
      {taps.map((tap, i) => (
        <feImage
          key={tap}
          href={maps?.[i]}
          x="0"
          y="0"
          width={width}
          height={height}
          preserveAspectRatio="none"
          result={`m${tap}`}
        />
      ))}
      {taps.map((tap) => (
        <feDisplacementMap
          key={tap}
          in="SourceGraphic"
          in2={`m${tap}`}
          scale={maps ? scale : 0}
          xChannelSelector="R"
          yChannelSelector="G"
          result={`d${tap}`}
        />
      ))}
      <feColorMatrix in="dr" type="matrix" values={KEEP_R} result="r" />
      <feColorMatrix in="dg" type="matrix" values={KEEP_G} result="g" />
      <feColorMatrix in="db" type="matrix" values={KEEP_B} result="b" />
      <feComposite in="r" in2="g" operator="arithmetic" k2="1" k3="1" result="rg" />
      <feComposite in="rg" in2="b" operator="arithmetic" k2="1" k3="1" result="rgb" />
      <feColorMatrix in="mg" type="matrix" values={MASK_B} result="mask" />
      <feGaussianBlur in="rgb" stdDeviation={`${blur} ${blur * 0.4}`} result="soft" />
      <feComposite in="soft" in2="mask" operator="in" result="smear" />
      <feComposite in="smear" in2="rgb" operator="over" />
    </filter>
  )
}

export function LensCarousel({
  items,
  cardWidth = lensCarouselDefaults.cardWidth,
  cardHeight = lensCarouselDefaults.cardHeight,
  gap = lensCarouselDefaults.gap,
  lensWidth = lensCarouselDefaults.lensWidth,
  glass = lensCarouselDefaults.glass,
  fringe = lensCarouselDefaults.fringe,
  blur = lensCarouselDefaults.blur,
  loop = lensCarouselDefaults.loop,
  snap = lensCarouselDefaults.snap,
  inertia = lensCarouselDefaults.inertia,
  showCaption = lensCarouselDefaults.showCaption,
  initialIndex = lensCarouselDefaults.initialIndex,
  background = lensCarouselDefaults.background,
  color = lensCarouselDefaults.color,
  onActiveChange,
  className,
  style,
}: LensCarouselProps) {
  const id = useId()
  const filterId = `uig-lgc-${id.replace(/\W/g, '')}`
  const count = items.length
  const reduced = useReducedMotion()
  const [viewportWidth, setViewportWidth] = useState(0)
  const [maps, setMaps] = useState<LensMapUrls | null>(null)

  const widths = useMemo(
    () => items.map((item) => Math.round(item.aspect ? cardHeight * item.aspect : cardWidth)),
    [items, cardWidth, cardHeight],
  )
  const lefts = useMemo(() => {
    const out: number[] = []
    let x = 0
    for (const width of widths) {
      out.push(x)
      x += width + gap
    }
    return out
  }, [widths, gap])
  const loopLength = useMemo(
    () => widths.reduce((sum, width) => sum + width + gap, 0),
    [widths, gap],
  )
  const points = useMemo(
    () => widths.map((width, i) => (lefts[i] ?? 0) + width / 2),
    [widths, lefts],
  )

  const engineRef = useRef<LensCarouselEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new LensCarouselEngine(
      { points, loopLength, loop, snap, inertia, instant: false },
      initialIndex,
    )
  }
  const engine = engineRef.current
  const [view, setView] = useState<View>(() => ({
    offset: engine.offset,
    active: engine.activeIndex,
    scale: 1,
  }))
  const viewportRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<() => void>(() => {})
  const changeRef = useRef(onActiveChange)
  const dragRef = useRef<DragState>({ active: false, x: 0, moved: 0, pressed: -1 })

  const wake = useCallback(() => wakeRef.current(), [])

  const publish = useCallback(() => {
    const offset = engine.offset
    const active = engine.activeIndex
    const scale = Math.round(engine.scale * 1000) / 1000
    setView((current) =>
      current.offset === offset && current.active === active && current.scale === scale
        ? current
        : { offset, active, scale },
    )
  }, [engine])

  useEffect(() => {
    changeRef.current = onActiveChange
  }, [onActiveChange])

  useEffect(() => {
    engine.setOptions({ points, loopLength, loop, snap, inertia, instant: reduced })
    wake()
  }, [engine, wake, points, loopLength, loop, snap, inertia, reduced])

  useEffect(() => {
    engine.select(initialIndex)
    wake()
  }, [engine, wake, initialIndex])

  const lens = Math.max(0, Math.min(lensWidth, Math.floor(viewportWidth * LENS_MAX_SHARE)))
  const margin = Math.round(lens / 2)
  const above = Math.round(cardHeight * LENS_ABOVE)
  const sourceWidth = lens + margin * 2
  const sourceHeight = above * 2 + cardHeight

  useEffect(() => {
    if (!lens) {
      setMaps(null)
      return
    }
    const built = buildLensMaps({
      lens,
      outer: margin,
      inner: margin,
      top: above,
      cardHeight,
      strength: glass,
      fringe,
      step: MAP_STEP,
    })
    const encode = (maps: Uint8ClampedArray<ArrayBuffer>[]) =>
      maps.map((data) => toDataUrl(data, built.width, built.height))
    setMaps({
      left: encode(built.left),
      right: encode(built.right),
      scale: built.scale,
      shift: built.shift,
    })
  }, [lens, margin, above, cardHeight, glass, fringe])

  useEffect(() => {
    const element = viewportRef.current
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
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0
      const direction = Math.sign(delta)
      if (!direction || !engine.canScroll(direction)) return
      e.preventDefault()
      engine.scroll(delta)
      publish()
      start()
    }
    element.addEventListener('wheel', onWheel, { passive: false })

    const resize = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? 0)
      setViewportWidth((current) => (current === width ? current : width))
    })
    resize.observe(element)

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
      resize.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wakeRef.current = () => {}
    }
  }, [engine, publish])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const target = e.target instanceof Element ? e.target.closest('[data-index]') : null
    const pressed = target ? Number(target.getAttribute('data-index')) : -1
    dragRef.current = { active: true, x: e.clientX, moved: 0, pressed }
    engine.dragStart()
    wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag.active) return
    const dx = e.clientX - drag.x
    drag.x = e.clientX
    drag.moved += Math.abs(dx)
    engine.dragMove(dx)
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
    if (e.key === 'ArrowLeft') engine.step(-1)
    else if (e.key === 'ArrowRight') engine.step(1)
    else if (e.key === 'Home') engine.select(0)
    else if (e.key === 'End') engine.select(count - 1)
    else return
    e.preventDefault()
    wake()
  }

  const looping = loop && loopLength > 0
  const phase = looping ? ((view.offset % loopLength) + loopLength) % loopLength : view.offset
  const reach = looping ? Math.ceil((viewportWidth / 2 + lens) / loopLength) : 0
  const shift = maps?.shift ?? 0
  const trackX = viewportWidth / 2 - phase - reach * loopLength
  const captionGap = Math.round(cardHeight * CAPTION_GAP)
  const fade = reduced ? 0 : 250
  const activeItem = items[view.active]
  const counter = `${String(view.active + 1).padStart(2, '0')}/${String(count).padStart(2, '0')}`
  const copies: number[] = []
  for (let copy = -reach; copy <= reach; copy++) copies.push(copy)

  const renderCards = (ghost: boolean) =>
    copies.flatMap((copy) =>
      items.map((item, index) => {
        const cardStyle = {
          width: widths[index],
          height: cardHeight,
          transform: `scale(${view.scale})`,
        }
        const key = `${copy}-${index}`
        const image = (
          <img
            src={item.image}
            alt={ghost || copy !== 0 ? '' : (item.alt ?? item.title)}
            draggable={false}
            className="uig-lens-carousel__image block h-full w-full object-cover"
          />
        )
        if (ghost) {
          return (
            <div
              key={key}
              className="uig-lens-carousel__ghost shrink-0 overflow-hidden"
              style={cardStyle}
            >
              {image}
            </div>
          )
        }
        return (
          <button
            key={key}
            type="button"
            role="option"
            id={copy === 0 ? `${id}-${index}` : undefined}
            tabIndex={-1}
            data-index={index}
            aria-selected={index === view.active}
            aria-hidden={copy !== 0 || undefined}
            onClick={() => {
              engine.select(index)
              wake()
            }}
            className="uig-lens-carousel__card block shrink-0 cursor-pointer overflow-hidden"
            style={cardStyle}
          >
            {image}
          </button>
        )
      }),
    )

  const renderLens = (side: 'left' | 'right') => {
    const left = side === 'left'
    const origin = left ? -margin : viewportWidth - lens - margin
    return (
      <div
        aria-hidden="true"
        className={`uig-lens-carousel__lens pointer-events-none absolute overflow-hidden ${left ? 'left-0' : 'right-0'}`}
        style={{ top: EDGE_TRIM - above, width: lens, height: sourceHeight - EDGE_TRIM * 2 }}
      >
        <div
          className="uig-lens-carousel__glass absolute"
          style={{
            top: -EDGE_TRIM,
            left: left ? -margin : undefined,
            right: left ? undefined : -margin,
            width: sourceWidth,
            height: sourceHeight,
            background,
            filter: `url(#${filterId}-${left ? 'l' : 'r'})`,
          }}
        >
          <div
            className="uig-lens-carousel__clone absolute left-0 flex"
            style={{
              top: above + shift,
              gap,
              transform: `translate3d(${trackX - origin + shift}px, 0, 0)`,
            }}
          >
            {renderCards(true)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={['uig-lens-carousel', 'overflow-hidden', className].filter(Boolean).join(' ')}
      style={{ background, color, ...style }}
    >
      <svg className="uig-lens-carousel__defs absolute h-0 w-0" aria-hidden="true">
        <LensFilter
          id={`${filterId}-l`}
          width={sourceWidth}
          height={sourceHeight}
          maps={maps?.left}
          scale={maps?.scale ?? 0}
          blur={blur}
        />
        <LensFilter
          id={`${filterId}-r`}
          width={sourceWidth}
          height={sourceHeight}
          maps={maps?.right}
          scale={maps?.scale ?? 0}
          blur={blur}
        />
      </svg>
      <div className="uig-lens-carousel__stage flex h-full w-full flex-col items-center justify-center">
        {showCaption && (
          <div
            aria-hidden="true"
            className="uig-lens-carousel__caption pointer-events-none grid text-center"
            style={{ marginBottom: captionGap }}
          >
            {items.map((item, index) => (
              <div
                key={`${item.title}-${index}`}
                className="uig-lens-carousel__entry col-start-1 row-start-1"
                style={{
                  opacity: index === view.active ? 1 : 0,
                  transition:
                    index === view.active
                      ? `opacity ${fade}ms ease-out ${fade / 2}ms`
                      : `opacity ${fade / 2}ms ease-out`,
                }}
              >
                <p className="uig-lens-carousel__title text-base leading-[1.15] font-medium">
                  {item.title}
                </p>
                {item.subtitle && (
                  <p className="uig-lens-carousel__subtitle text-base leading-[1.15] opacity-55">
                    {item.subtitle}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
        <div
          ref={viewportRef}
          role="listbox"
          tabIndex={0}
          aria-label="Carousel"
          aria-orientation="horizontal"
          aria-activedescendant={`${id}-${view.active}`}
          className="uig-lens-carousel__viewport relative w-full cursor-grab touch-pan-y select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current active:cursor-grabbing"
          style={{ height: cardHeight }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => finishDrag(true)}
          onPointerCancel={() => finishDrag(false)}
          onLostPointerCapture={() => finishDrag(false)}
          onClickCapture={onClickCapture}
          onKeyDown={onKeyDown}
        >
          <div
            className="uig-lens-carousel__window absolute inset-0"
            style={{ clipPath: `inset(0 ${lens}px)` }}
          >
            <div
              className="uig-lens-carousel__track absolute top-0 left-0 flex"
              style={{ gap, transform: `translate3d(${trackX}px, 0, 0)` }}
            >
              {renderCards(false)}
            </div>
          </div>
          {lens > 0 && renderLens('left')}
          {lens > 0 && renderLens('right')}
        </div>
        {showCaption && (
          <div
            className="uig-lens-carousel__footer flex justify-center"
            style={{ marginTop: captionGap }}
          >
            <span
              aria-hidden="true"
              className="uig-lens-carousel__counter rounded-md bg-current/10 px-4 py-2 text-base leading-[1.25] tabular-nums"
            >
              {counter}
            </span>
          </div>
        )}
      </div>
      <div className="uig-lens-carousel__live sr-only" aria-live="polite">
        {activeItem?.title}
      </div>
    </div>
  )
}
