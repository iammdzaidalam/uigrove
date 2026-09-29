'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { ImageWheel3DEngine, type ImageWheel3DMode } from './image-wheel-3d.engine'

export interface ImageWheel3DItem {
  image: string
  alt?: string
  title?: string
  href?: string
}

export type ImageWheel3DPreviewPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface ImageWheel3DOptions {
  mode: ImageWheel3DMode
  repeat: number
  padding: number
  cardWidth: number
  cardHeight: number
  cornerRadius: number
  tilt: number
  fov: number
  elevation: number
  autoRotateSpeed: number
  wheelSpeed: number
  dragSpeed: number
  smoothing: number
  hoverLift: number
  parallax: boolean
  preview: boolean
  previewWidth: number
  previewHeight: number
  previewPosition: ImageWheel3DPreviewPosition
  showTitle: boolean
}

export interface ImageWheel3DProps extends Partial<ImageWheel3DOptions> {
  items: ImageWheel3DItem[]
  className?: string
  style?: CSSProperties
}

export const imageWheel3DDefaults: ImageWheel3DOptions = {
  mode: 'scroll',
  repeat: 11,
  padding: 0.12,
  cardWidth: 120,
  cardHeight: 90,
  cornerRadius: 0.05,
  tilt: 16.04,
  fov: 75,
  elevation: 45,
  autoRotateSpeed: 12,
  wheelSpeed: 7.2,
  dragSpeed: 1,
  smoothing: 0.1,
  hoverLift: 20,
  parallax: true,
  preview: true,
  previewWidth: 240,
  previewHeight: 180,
  previewPosition: 'top-left',
  showTitle: true,
}

const MAX_DT = 1 / 30
const CLICK_SLOP = 5
const PREVIEW_INSET = 20
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const SIZE_VAR = '--uig-image-wheel-3d-w'
const HEIGHT_VAR = '--uig-image-wheel-3d-h'
const SHORT_VAR = '--uig-image-wheel-3d-s'

interface DragState {
  active: boolean
  id: number
  x: number
  y: number
  moved: boolean
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

function openLink(href: string | undefined) {
  if (href) window.open(href, '_blank', 'noopener,noreferrer')
}

export function ImageWheel3D({
  items,
  mode = imageWheel3DDefaults.mode,
  repeat = imageWheel3DDefaults.repeat,
  padding = imageWheel3DDefaults.padding,
  cardWidth = imageWheel3DDefaults.cardWidth,
  cardHeight = imageWheel3DDefaults.cardHeight,
  cornerRadius = imageWheel3DDefaults.cornerRadius,
  tilt = imageWheel3DDefaults.tilt,
  fov = imageWheel3DDefaults.fov,
  elevation = imageWheel3DDefaults.elevation,
  autoRotateSpeed = imageWheel3DDefaults.autoRotateSpeed,
  wheelSpeed = imageWheel3DDefaults.wheelSpeed,
  dragSpeed = imageWheel3DDefaults.dragSpeed,
  smoothing = imageWheel3DDefaults.smoothing,
  hoverLift = imageWheel3DDefaults.hoverLift,
  parallax = imageWheel3DDefaults.parallax,
  preview = imageWheel3DDefaults.preview,
  previewWidth = imageWheel3DDefaults.previewWidth,
  previewHeight = imageWheel3DDefaults.previewHeight,
  previewPosition = imageWheel3DDefaults.previewPosition,
  showTitle = imageWheel3DDefaults.showTitle,
  className,
  style,
}: ImageWheel3DProps) {
  const total = items.length
  const count = total * Math.max(1, Math.round(repeat))
  const reduced = useReducedMotion()
  const engineRef = useRef<ImageWheel3DEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new ImageWheel3DEngine({
      count,
      mode,
      cardWidth,
      cardHeight,
      padding,
      tilt,
      fov,
      elevation,
      autoRotateSpeed,
      wheelSpeed,
      dragSpeed,
      smoothing,
      hoverLift,
      parallax,
      instant: false,
    })
  }
  const engine = engineRef.current
  const [hovered, setHovered] = useState(-1)
  const [shown, setShown] = useState(-1)
  const [announcement, setAnnouncement] = useState('')
  const viewportRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<(HTMLImageElement | null)[]>([])
  const dragRef = useRef<DragState>({ active: false, id: -1, x: 0, y: 0, moved: false })
  const itemsRef = useRef(items)
  const modeRef = useRef(mode)
  const wakeRef = useRef<() => void>(() => {})

  const wake = useCallback(() => wakeRef.current(), [])

  useEffect(() => {
    itemsRef.current = items
    modeRef.current = mode
  }, [items, mode])

  useEffect(() => {
    engine.setOptions({
      count,
      mode,
      cardWidth,
      cardHeight,
      padding,
      tilt,
      fov,
      elevation,
      autoRotateSpeed,
      wheelSpeed,
      dragSpeed,
      smoothing,
      hoverLift,
      parallax,
      instant: reduced,
    })
    wake()
  }, [
    engine,
    wake,
    count,
    mode,
    cardWidth,
    cardHeight,
    padding,
    tilt,
    fov,
    elevation,
    autoRotateSpeed,
    wheelSpeed,
    dragSpeed,
    smoothing,
    hoverLift,
    parallax,
    reduced,
  ])

  useEffect(() => {
    const viewport = viewportRef.current
    const stage = stageRef.current
    if (!viewport || !stage) return
    let visible = true
    let frame = 0
    let last = 0
    let layoutSeen = -1
    let hoverSeen = -1

    const render = () => {
      const nodes = cardsRef.current
      if (engine.layoutVersion !== layoutSeen) {
        layoutSeen = engine.layoutVersion
        const size = engine.cardSize()
        viewport.style.perspective = `${engine.focal}px`
        stage.style.setProperty(SIZE_VAR, `${size.width}px`)
        stage.style.setProperty(HEIGHT_VAR, `${size.height}px`)
        stage.style.setProperty(SHORT_VAR, `${size.short}px`)
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i]
          if (node) node.style.transform = engine.cardTransform(i)
        }
        stage.style.visibility = engine.width > 0 ? 'visible' : 'hidden'
      } else {
        for (const i of engine.dirty) {
          const node = nodes[i]
          if (node) node.style.transform = engine.cardTransform(i)
        }
      }
      stage.style.transform = engine.stageTransform()
      if (engine.hovered !== hoverSeen) {
        hoverSeen = engine.hovered
        setHovered(hoverSeen)
        if (hoverSeen >= 0) setShown(hoverSeen)
        const list = itemsRef.current
        const item = hoverSeen >= 0 ? list[hoverSeen % Math.max(1, list.length)] : undefined
        if (!dragRef.current.active) viewport.style.cursor = item?.href ? 'pointer' : ''
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
      if (frame || !visible || document.hidden) return
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
      if (modeRef.current !== 'scroll') return
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewport.clientHeight || 800 : 1
      if (engine.wheel(e.deltaY * unit, e.timeStamp)) start()
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })

    const resize = new ResizeObserver(([entry]) => {
      const rect = entry?.contentRect
      engine.resize(rect?.width ?? 0, rect?.height ?? 0)
      engine.tick(0)
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

  const itemAt = (index: number) => (index >= 0 && total ? items[index % total] : undefined)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const x = e.nativeEvent.offsetX
    const y = e.nativeEvent.offsetY
    dragRef.current = { active: true, id: e.pointerId, x, y, moved: false }
    engine.setPointer(x, y)
    engine.dragStart(x, y)
    e.currentTarget.style.cursor = 'grabbing'
    wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const x = e.nativeEvent.offsetX
    const y = e.nativeEvent.offsetY
    engine.setPointer(x, y)
    const drag = dragRef.current
    if (drag.active && drag.id === e.pointerId) {
      if (Math.hypot(x - drag.x, y - drag.y) > CLICK_SLOP) drag.moved = true
      engine.dragMove(x, y, e.pointerType !== 'mouse')
    }
    wake()
  }

  const finishDrag = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag.active || drag.id !== e.pointerId) return
    drag.active = false
    engine.dragEnd()
    const target = e.currentTarget
    const x = e.nativeEvent.offsetX
    const y = e.nativeEvent.offsetY
    if (x < 0 || y < 0 || x > target.clientWidth || y > target.clientHeight) {
      engine.setPointer(x, null)
    }
    target.style.cursor = ''
    wake()
    return !drag.moved
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!finishDrag(e)) return
    openLink(itemAt(engine.pick(engine.pointerX, engine.pointerY))?.href)
  }

  const onPointerLeave = (e: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.active) return
    engine.setPointer(e.nativeEvent.offsetX, null)
    wake()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!count) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') engine.step(-1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') engine.step(1)
    else if (e.key === 'Enter') {
      openLink(itemAt(engine.frontIndex)?.href)
      return
    } else return
    e.preventDefault()
    const front = ((Math.round(-engine.target / engine.spacing) % count) + count) % count
    const item = itemAt(front)
    setAnnouncement(`${item?.title ?? item?.alt ?? 'Image'}, ${(front % total) + 1} of ${total}`)
    wake()
  }

  const cards = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const item = items[i % total]
        const copy = i >= total
        return (
          <img
            key={i}
            ref={(element) => {
              cardsRef.current[i] = element
            }}
            src={item?.image}
            alt={copy ? '' : (item?.alt ?? item?.title ?? '')}
            aria-hidden={copy || undefined}
            draggable={false}
            decoding="async"
            className="uig-image-wheel-3d__card absolute block max-w-none object-cover select-none"
            style={{
              width: `var(${SIZE_VAR})`,
              height: `var(${HEIGHT_VAR})`,
              left: `calc(var(${SIZE_VAR}) / -2)`,
              top: `calc(var(${HEIGHT_VAR}) / -2)`,
              borderRadius: `calc(var(${SHORT_VAR}) * ${cornerRadius})`,
            }}
          />
        )
      }),
    [items, total, count, cornerRadius],
  )

  const shownItem = itemAt(shown)
  const top = previewPosition.startsWith('top')
  const left = previewPosition.endsWith('left')

  return (
    <div
      className={['uig-image-wheel-3d', 'overflow-hidden', className].filter(Boolean).join(' ')}
      style={style}
    >
      <div
        ref={viewportRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="3D image wheel"
        tabIndex={0}
        className="uig-image-wheel-3d__viewport relative h-full w-full cursor-grab select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current"
        style={{ touchAction: mode === 'scroll' ? 'none' : 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={finishDrag}
        onLostPointerCapture={finishDrag}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <div
          ref={stageRef}
          className="uig-image-wheel-3d__stage pointer-events-none absolute top-1/2 left-1/2 h-0 w-0"
          style={{ transformStyle: 'preserve-3d', visibility: 'hidden' }}
        >
          {cards}
        </div>
        {preview && mode === 'scroll' && (
          <div
            aria-hidden="true"
            className="uig-image-wheel-3d__preview pointer-events-none absolute"
            style={{
              width: previewWidth,
              top: top ? PREVIEW_INSET : undefined,
              bottom: top ? undefined : PREVIEW_INSET,
              left: left ? PREVIEW_INSET : undefined,
              right: left ? undefined : PREVIEW_INSET,
              opacity: hovered >= 0 ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          >
            {shownItem && (
              <img
                src={shownItem.image}
                alt=""
                draggable={false}
                className="uig-image-wheel-3d__preview-image block w-full object-cover"
                style={{ height: previewHeight }}
              />
            )}
            {showTitle && shownItem?.title && (
              <div className="uig-image-wheel-3d__preview-title mt-2.5 text-[15px] leading-[1.3]">
                {shownItem.title}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="uig-image-wheel-3d__live sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  )
}
