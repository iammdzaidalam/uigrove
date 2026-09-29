'use client'

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { InkBleedEngine, type InkBleedCharRect } from './ink-bleed.engine'

export type InkBleedTag = 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'span'

export interface InkBleedOptions {
  text: string
  intensity: number
  fontSize: number
  fontWeight: number
  letterSpacing: number
  lineHeight: number
  tag: InkBleedTag
  color: string
  radius: number
  smoothing: number
  blobs: number
}

export interface InkBleedProps extends Partial<InkBleedOptions> {
  className?: string
  style?: CSSProperties
}

export const inkBleedDefaults: InkBleedOptions = {
  text: 'ui grove',
  intensity: 50,
  fontSize: 120,
  fontWeight: 700,
  letterSpacing: -0.03,
  lineHeight: 1,
  tag: 'div',
  color: '#ffffff',
  radius: 32,
  smoothing: 0.85,
  blobs: 1,
}

const MAX_DT = 1 / 30
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

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

export function InkBleed({
  text = inkBleedDefaults.text,
  intensity = inkBleedDefaults.intensity,
  fontSize = inkBleedDefaults.fontSize,
  fontWeight = inkBleedDefaults.fontWeight,
  letterSpacing = inkBleedDefaults.letterSpacing,
  lineHeight = inkBleedDefaults.lineHeight,
  tag = inkBleedDefaults.tag,
  color = inkBleedDefaults.color,
  radius = inkBleedDefaults.radius,
  smoothing = inkBleedDefaults.smoothing,
  blobs = inkBleedDefaults.blobs,
  className,
  style,
}: InkBleedProps) {
  const filterId = useId()
  const reduced = useReducedMotion()
  const engineRef = useRef<InkBleedEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new InkBleedEngine({ radius, smoothing, blobs, intensity })
  }
  const engine = engineRef.current
  const stageRef = useRef<HTMLSpanElement>(null)
  const wakeRef = useRef<() => void>(() => {})
  const active = !reduced && intensity > 0
  const chars = Array.from(text)
  const blobCount = Math.max(1, Math.round(blobs))

  useEffect(() => {
    engine.setOptions({ radius, smoothing, blobs, intensity })
    wakeRef.current()
  }, [engine, radius, smoothing, blobs, intensity])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage || !active) return
    let visible = true
    let frame = 0
    let last = 0
    const charEls = Array.from(stage.querySelectorAll<HTMLElement>('[data-char]'))
    const blobEls = Array.from(stage.querySelectorAll<HTMLElement>('[data-blob]'))

    const measure = () => {
      const outer = stage.getBoundingClientRect()
      const rects: InkBleedCharRect[] = charEls.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: r.left - outer.left,
          y: r.top - outer.top,
          w: r.width,
          h: r.height,
          space: el.dataset.char === ' ',
        }
      })
      engine.setChars(rects)
    }

    const apply = () => {
      engine.blobs.forEach((blob, i) => {
        const el = blobEls[i]
        if (!el) return
        const size = `${blob.r * 2}px`
        if (el.style.width !== size) {
          el.style.width = size
          el.style.height = size
        }
        el.style.transform = `translate3d(${blob.x - blob.r}px, ${blob.y - blob.r}px, 0) scale(${blob.scale})`
      })
    }

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt)
      apply()
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
    measure()
    let cancelled = false
    document.fonts?.ready.then(() => {
      if (cancelled) return
      measure()
      start()
    })

    const resize = new ResizeObserver(() => {
      measure()
      start()
    })
    resize.observe(stage)

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
      else stop()
    })
    intersection.observe(stage)

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      stop()
      resize.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wakeRef.current = () => {}
    }
  }, [engine, active, text, fontSize, fontWeight, letterSpacing, lineHeight, blobCount])

  const onPointerMove = (e: PointerEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    engine.setPointer(e.clientX - rect.left, e.clientY - rect.top)
    wakeRef.current()
  }

  const onPointerLeave = () => {
    engine.setPointer(0, null)
    wakeRef.current()
  }

  // Wider blur needs a lower cutoff or thin strokes erode away
  const blur = Math.max(1.5, (Math.min(100, Math.max(0, intensity)) / 100) * 10)
  const cutoff = 0.47 - Math.max(0, blur - 5) * 0.04
  // Steeper alpha ramp keeps edges crisp as the blur widens
  const slope = 19 + Math.max(0, blur - 5) * 7
  const Tag = tag
  const rootStyle: CSSProperties = {
    fontSize,
    fontWeight,
    letterSpacing: `${letterSpacing}em`,
    lineHeight,
    color,
    ...style,
  }

  return (
    <Tag
      className={['uig-ink-bleed', 'select-none', className].filter(Boolean).join(' ')}
      style={rootStyle}
    >
      <span className="uig-ink-bleed__label sr-only">{text}</span>
      {active ? (
        <>
          <svg className="uig-ink-bleed__defs absolute size-0" aria-hidden="true">
            <defs>
              <filter
                id={filterId}
                x="-20%"
                y="-20%"
                width="140%"
                height="140%"
                colorInterpolationFilters="sRGB"
              >
                <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${slope} ${(-slope * cutoff).toFixed(2)}`}
                />
              </filter>
            </defs>
          </svg>
          <span
            ref={stageRef}
            className="uig-ink-bleed__stage relative inline-block align-top whitespace-pre-wrap"
            style={{ filter: `url(#${filterId})` }}
            aria-hidden="true"
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
          >
            {chars.map((char, i) => (
              <span
                key={i}
                data-char={char}
                className="uig-ink-bleed__char inline-block will-change-transform"
              >
                {char === ' ' ? ' ' : char}
              </span>
            ))}
            {Array.from({ length: blobCount }, (_, i) => (
              <span
                key={i}
                data-blob=""
                className="uig-ink-bleed__blob pointer-events-none absolute top-0 left-0 rounded-full will-change-transform"
                style={{ background: 'currentColor', transform: 'scale(0)' }}
              />
            ))}
          </span>
        </>
      ) : (
        <span className="uig-ink-bleed__stage inline-block align-top" aria-hidden="true">
          {text}
        </span>
      )}
    </Tag>
  )
}
