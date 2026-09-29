'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { GooCarveButtonEngine, type GooCarveRest } from './goo-carve-button.engine'

export interface GooCarveButtonOptions {
  label: string
  href: string
  newTab: boolean
  fill: string
  textColor: string
  blobColor: string
  blobSize: number
  smoothing: number
  stretch: number
  radius: number
  paddingX: number
  paddingY: number
  fontSize: number
  fontWeight: number
  letterSpacing: number
  uppercase: boolean
  rest: GooCarveRest
  enterDuration: number
  leaveDuration: number
}

export interface GooCarveButtonProps extends Partial<GooCarveButtonOptions> {
  // Optional icon rendered before the label
  icon?: ReactNode
  onClick?: (event: MouseEvent<HTMLElement>) => void
  className?: string
  style?: CSSProperties
}

export const gooCarveButtonDefaults: GooCarveButtonOptions = {
  label: 'LIQUID CARVE',
  href: '',
  newTab: false,
  fill: '#f5f5f7',
  textColor: '#09090c',
  blobColor: '#09090c',
  blobSize: 100,
  smoothing: 0.5,
  stretch: 0.5,
  radius: 22,
  paddingX: 64,
  paddingY: 40,
  fontSize: 40,
  fontWeight: 600,
  letterSpacing: 0,
  uppercase: false,
  rest: 'visible',
  enterDuration: 350,
  leaveDuration: 300,
}

const MAX_DT = 1 / 30
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const GOO_MATRIX = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 19 -9'

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

export function GooCarveButton({
  label = gooCarveButtonDefaults.label,
  href = gooCarveButtonDefaults.href,
  newTab = gooCarveButtonDefaults.newTab,
  fill = gooCarveButtonDefaults.fill,
  textColor = gooCarveButtonDefaults.textColor,
  blobColor = gooCarveButtonDefaults.blobColor,
  blobSize = gooCarveButtonDefaults.blobSize,
  smoothing = gooCarveButtonDefaults.smoothing,
  stretch = gooCarveButtonDefaults.stretch,
  radius = gooCarveButtonDefaults.radius,
  paddingX = gooCarveButtonDefaults.paddingX,
  paddingY = gooCarveButtonDefaults.paddingY,
  fontSize = gooCarveButtonDefaults.fontSize,
  fontWeight = gooCarveButtonDefaults.fontWeight,
  letterSpacing = gooCarveButtonDefaults.letterSpacing,
  uppercase = gooCarveButtonDefaults.uppercase,
  rest = gooCarveButtonDefaults.rest,
  enterDuration = gooCarveButtonDefaults.enterDuration,
  leaveDuration = gooCarveButtonDefaults.leaveDuration,
  icon,
  onClick,
  className,
  style,
}: GooCarveButtonProps) {
  const id = useId()
  const gooId = `${id}goo`
  const maskId = `${id}mask`
  const reduced = useReducedMotion()
  const engineRef = useRef<GooCarveButtonEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new GooCarveButtonEngine({
      radius: blobSize / 2,
      smoothing,
      stretch,
      rest,
      enterDuration,
      leaveDuration,
      instant: false,
    })
  }
  const engine = engineRef.current
  const [initialRadius] = useState(() => (rest === 'visible' ? blobSize / 2 : 0))
  const rootRef = useRef<HTMLElement | null>(null)
  const blobRef = useRef<SVGGElement>(null)
  const circleRef = useRef<SVGCircleElement>(null)
  const hoverRef = useRef(false)
  const focusRef = useRef(false)
  const wakeRef = useRef<() => void>(() => {})

  const wake = useCallback(() => wakeRef.current(), [])
  const setRoot = useCallback((element: HTMLElement | null) => {
    rootRef.current = element
  }, [])

  useEffect(() => {
    engine.setOptions({
      radius: blobSize / 2,
      smoothing,
      stretch,
      rest,
      enterDuration,
      leaveDuration,
      instant: reduced,
    })
    wake()
  }, [engine, wake, blobSize, smoothing, stretch, rest, enterDuration, leaveDuration, reduced])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let visible = true
    let frame = 0
    let last = 0
    // Wake ticks reuse the last measured frame interval
    let interval = 1 / 60

    const apply = () => {
      const blob = engine.blob()
      const inverse = 1 / blob.scale
      blobRef.current?.setAttribute(
        'transform',
        `translate(${blob.x.toFixed(2)} ${blob.y.toFixed(2)}) rotate(${blob.angle.toFixed(2)}) scale(${blob.scale.toFixed(4)} ${inverse.toFixed(4)})`,
      )
      circleRef.current?.setAttribute('r', blob.r.toFixed(2))
    }

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      if (last) interval = Math.min((now - last) / 1000, MAX_DT)
      const dt = interval
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

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
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
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wakeRef.current = () => {}
    }
  }, [engine])

  const localPoint = (target: HTMLElement, clientX: number, clientY: number) => {
    const rect = target.getBoundingClientRect()
    engine.resize(rect.width, rect.height)
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  const onPointerEnter = (e: PointerEvent<HTMLElement>) => {
    hoverRef.current = true
    const point = localPoint(e.currentTarget, e.clientX, e.clientY)
    engine.setPointer(point.x, point.y)
    wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (!hoverRef.current) return
    const point = localPoint(e.currentTarget, e.clientX, e.clientY)
    engine.setPointer(point.x, point.y)
    wake()
  }

  const onPointerLeave = () => {
    hoverRef.current = false
    if (!focusRef.current) engine.setPointer(null)
    wake()
  }

  const onFocus = (e: FocusEvent<HTMLElement>) => {
    // Keyboard focus reveals a centred carve when rest is hidden
    if (rest !== 'hidden' || !e.currentTarget.matches(':focus-visible')) return
    focusRef.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    engine.resize(rect.width, rect.height)
    if (!hoverRef.current) engine.setPointer(rect.width / 2, rect.height / 2)
    wake()
  }

  const onBlur = () => {
    if (!focusRef.current) return
    focusRef.current = false
    if (!hoverRef.current) engine.setPointer(null)
    wake()
  }

  const blur = Math.min(12, Math.max(2, blobSize * 0.08))

  const shared = {
    ref: setRoot,
    className: [
      'uig-goo-carve-button',
      'relative inline-flex cursor-pointer select-none appearance-none items-center justify-center border-0 bg-transparent no-underline focus-visible:outline-2 focus-visible:outline-offset-4',
      className,
    ]
      .filter(Boolean)
      .join(' '),
    style: {
      padding: `${paddingY}px ${paddingX}px`,
      borderRadius: radius,
      color: textColor,
      outlineColor: fill,
      fontFamily: 'inherit',
      fontSize,
      fontWeight,
      lineHeight: 1.5,
      letterSpacing: `${letterSpacing}em`,
      textTransform: uppercase ? ('uppercase' as const) : undefined,
      ...style,
    },
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
    onFocus,
    onBlur,
    onClick,
  }

  const content = (
    <>
      <svg
        aria-hidden="true"
        className="uig-goo-carve-button__surface pointer-events-none absolute inset-0 overflow-visible"
        width="100%"
        height="100%"
      >
        <defs>
          <filter id={gooId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
            <feColorMatrix in="blur" type="matrix" values={GOO_MATRIX} />
          </filter>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="#fff" />
            <svg x="50%" y="50%" width="100%" height="100%" overflow="visible">
              <g ref={blobRef}>
                <circle ref={circleRef} r={initialRadius} fill="#000" />
              </g>
            </svg>
          </mask>
        </defs>
        <g filter={`url(#${gooId})`}>
          <rect width="100%" height="100%" rx={radius} ry={radius} fill={blobColor} />
        </g>
        <g filter={`url(#${gooId})`}>
          <rect
            width="100%"
            height="100%"
            rx={radius}
            ry={radius}
            fill={fill}
            mask={`url(#${maskId})`}
          />
        </g>
      </svg>
      <span className="uig-goo-carve-button__label relative z-10 inline-flex items-center gap-3 whitespace-nowrap">
        {icon ? (
          <span className="uig-goo-carve-button__icon inline-flex shrink-0" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {label}
      </span>
    </>
  )

  if (href) {
    return (
      <a
        {...shared}
        href={href}
        target={newTab ? '_blank' : undefined}
        rel={newTab ? 'noopener noreferrer' : undefined}
      >
        {content}
      </a>
    )
  }
  return (
    <button {...shared} type="button">
      {content}
    </button>
  )
}
