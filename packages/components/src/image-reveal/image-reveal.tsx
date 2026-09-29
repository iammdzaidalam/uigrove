'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import { ImageRevealEngine, revealLayer } from './image-reveal.engine'

export interface ImageRevealItem {
  image: string
  alt?: string
}

export interface ImageRevealOptions {
  scrollPerItem: number
  stageSize: string
  startInset: number
  grain: number
  showProgress: boolean
  label: string
  smoothing: number
  viewportHeight: string
}

export interface ImageRevealProps extends Partial<ImageRevealOptions> {
  items: ImageRevealItem[]
  className?: string
  style?: CSSProperties
}

export const imageRevealDefaults: ImageRevealOptions = {
  scrollPerItem: 1600,
  stageSize: '576px',
  startInset: 0,
  grain: 0.35,
  showProgress: true,
  label: 'Scroll down to reveal the images',
  smoothing: 0.15,
  viewportHeight: '100dvh',
}

const MAX_DT = 1 / 30
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

function pct(fraction: number) {
  return `${(fraction * 100).toFixed(3)}%`
}

export function ImageReveal({
  items,
  scrollPerItem = imageRevealDefaults.scrollPerItem,
  stageSize = imageRevealDefaults.stageSize,
  startInset = imageRevealDefaults.startInset,
  grain = imageRevealDefaults.grain,
  showProgress = imageRevealDefaults.showProgress,
  label = imageRevealDefaults.label,
  smoothing = imageRevealDefaults.smoothing,
  viewportHeight = imageRevealDefaults.viewportHeight,
  className,
  style,
}: ImageRevealProps) {
  const count = items.length
  const reduced = useReducedMotion()
  const grainId = useId()
  const engineRef = useRef<ImageRevealEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new ImageRevealEngine({ count, smoothing, startInset, instant: false })
  }
  const engine = engineRef.current
  const [progress, setProgress] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<() => void>(() => {})

  const wake = useCallback(() => wakeRef.current(), [])

  const publish = useCallback(() => {
    const current = engine.current
    setProgress((previous) => (previous === current ? previous : current))
  }, [engine])

  useEffect(() => {
    engine.setOptions({ count, smoothing, startInset, instant: reduced })
    wake()
  }, [engine, wake, count, smoothing, startInset, reduced])

  useEffect(() => {
    const root = rootRef.current
    const track = trackRef.current
    if (!root || !track) return
    let visible = true
    let frame = 0
    let last = 0
    let first = true

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt)
      publish()
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
      const top = track.getBoundingClientRect().top
      engine.setTarget(-top / scrollPerItem, first)
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
  }, [engine, publish, scrollPerItem])

  const active = Math.min(Math.max(Math.floor(progress), 0), Math.max(0, count - 1))
  const activeItem = items[active]
  const itemProgress = count === 0 ? 0 : progress >= count ? 1 : progress - Math.floor(progress)
  const grainOpacity = Math.min(Math.max(grain, 0), 1)

  return (
    <div
      ref={rootRef}
      className={['uig-image-reveal', 'relative w-full', className].filter(Boolean).join(' ')}
      style={style}
    >
      {label && (
        <div className="uig-image-reveal__header flex flex-col items-center pt-20 pb-4">
          <p className="uig-image-reveal__label max-w-[14ch] text-center text-xs leading-tight tracking-[0.08em] uppercase opacity-40">
            {label}
          </p>
          <span
            aria-hidden="true"
            className="uig-image-reveal__line block h-16 w-px bg-current opacity-30"
          />
        </div>
      )}
      <div
        ref={trackRef}
        className="uig-image-reveal__track relative w-full"
        style={{ height: `calc(${count * scrollPerItem}px + ${viewportHeight})` }}
      >
        <div
          className="uig-image-reveal__viewport sticky top-0 flex w-full items-center justify-center overflow-hidden"
          style={{ height: viewportHeight, containerType: 'size' }}
        >
          <div
            className="uig-image-reveal__stage relative aspect-square"
            style={{ height: `min(${stageSize}, 80cqh, 92cqw)` }}
          >
            {grainOpacity > 0 && (
              <svg className="uig-image-reveal__defs absolute h-0 w-0" aria-hidden="true">
                <filter id={grainId}>
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.9"
                    numOctaves="2"
                    stitchTiles="stitch"
                  />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
              </svg>
            )}
            {items.map((item, index) => {
              const layer = revealLayer(progress - index, startInset)
              const layerStyle: CSSProperties = {
                visibility: layer.visible ? 'visible' : 'hidden',
                clipPath: `inset(${pct(layer.clipTop)} ${pct(layer.clipSide)} 0 ${pct(layer.clipSide)})`,
                transform: `scale(${layer.scale.toFixed(4)})`,
                filter: `brightness(${layer.brightness.toFixed(3)}) contrast(${layer.contrast.toFixed(3)})`,
                willChange: 'transform',
              }
              return (
                <div
                  key={index}
                  className="uig-image-reveal__layer absolute inset-0 overflow-hidden"
                  style={layerStyle}
                >
                  <img
                    src={item.image}
                    alt={item.alt ?? ''}
                    draggable={false}
                    className="uig-image-reveal__image absolute inset-0 h-full w-full object-cover"
                  />
                  {grainOpacity > 0 && (
                    <svg
                      className="uig-image-reveal__grain pointer-events-none absolute inset-0 h-full w-full"
                      style={{ opacity: grainOpacity, mixBlendMode: 'overlay' }}
                      aria-hidden="true"
                    >
                      <rect width="100%" height="100%" filter={`url(#${grainId})`} />
                    </svg>
                  )}
                </div>
              )
            })}
          </div>
          {showProgress && (
            <div
              aria-hidden="true"
              className="uig-image-reveal__progress absolute top-1/2 right-12 h-[120px] w-[2px] -translate-y-1/2"
            >
              <div className="uig-image-reveal__rail absolute inset-0 bg-current opacity-15" />
              <div
                className="uig-image-reveal__fill absolute inset-0 origin-top bg-current"
                style={{ transform: `scaleY(${itemProgress.toFixed(4)})` }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="uig-image-reveal__live sr-only" aria-live="polite">
        {count > 0 ? activeItem?.alt || `Image ${active + 1} of ${count}` : ''}
      </div>
    </div>
  )
}
