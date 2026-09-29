'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { SceneRevealEngine, sceneRevealFrame, type SceneRevealEasing } from './scene-reveal.engine'

export interface SceneRevealOptions {
  scrollLength: number
  startScale: number
  endScale: number
  radius: number
  edgeInset: number
  parallax: number
  dim: number
  easing: SceneRevealEasing
  smoothing: number
  viewportHeight: string
}

export interface SceneRevealProps extends Partial<SceneRevealOptions> {
  hero: ReactNode
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

export const sceneRevealDefaults: SceneRevealOptions = {
  scrollLength: 1400,
  startScale: 1,
  endScale: 1.25,
  radius: 320,
  edgeInset: 46,
  parallax: 48,
  dim: 0.6,
  easing: 'ease-in-out',
  smoothing: 0.14,
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

export function SceneReveal({
  hero,
  children,
  scrollLength = sceneRevealDefaults.scrollLength,
  startScale = sceneRevealDefaults.startScale,
  endScale = sceneRevealDefaults.endScale,
  radius = sceneRevealDefaults.radius,
  edgeInset = sceneRevealDefaults.edgeInset,
  parallax = sceneRevealDefaults.parallax,
  dim = sceneRevealDefaults.dim,
  easing = sceneRevealDefaults.easing,
  smoothing = sceneRevealDefaults.smoothing,
  viewportHeight = sceneRevealDefaults.viewportHeight,
  className,
  style,
}: SceneRevealProps) {
  const reduced = useReducedMotion()
  const engineRef = useRef<SceneRevealEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new SceneRevealEngine({
      startScale,
      endScale,
      radius,
      edgeInset,
      parallax,
      dim,
      easing,
      smoothing,
      instant: false,
    })
  }
  const engine = engineRef.current
  const [progress, setProgress] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<() => void>(() => {})

  const wake = useCallback(() => wakeRef.current(), [])

  const publish = useCallback(() => {
    const current = engine.current
    setProgress((previous) => (previous === current ? previous : current))
  }, [engine])

  useEffect(() => {
    engine.setOptions({ smoothing, instant: reduced })
    wake()
  }, [engine, wake, smoothing, reduced])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
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
      const top = root.getBoundingClientRect().top
      engine.setTarget(-top / scrollLength, first)
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
  }, [engine, publish, scrollLength])

  const f = sceneRevealFrame(progress, {
    startScale,
    endScale,
    radius,
    edgeInset,
    parallax,
    dim,
    easing,
  })
  const clip = `inset(calc(${f.insetY}% - ${f.bleed}px) calc(${f.insetX}% - ${f.bleed}px) round ${f.radius}px)`

  return (
    <div
      ref={rootRef}
      className={['uig-scene-reveal', 'relative w-full', className].filter(Boolean).join(' ')}
      style={{ height: `calc(${scrollLength}px + ${viewportHeight})`, ...style }}
    >
      <div
        className="uig-scene-reveal__stage sticky top-0 w-full overflow-hidden"
        style={{ height: viewportHeight }}
      >
        <div
          className="uig-scene-reveal__hero absolute inset-0"
          style={{
            transform: `translate3d(0, ${f.heroY}px, 0) scale(${f.heroScale})`,
            willChange: 'transform',
          }}
        >
          {hero}
        </div>
        <div
          aria-hidden="true"
          className="uig-scene-reveal__veil pointer-events-none absolute inset-0 bg-current"
          style={{ opacity: f.veil }}
        />
        <div
          className="uig-scene-reveal__window absolute inset-0 overflow-hidden"
          style={{ clipPath: clip, willChange: 'clip-path' }}
        >
          <div
            className="uig-scene-reveal__next absolute inset-0"
            style={{
              transform: `translate3d(0, ${f.nextY}px, 0) scale(${f.nextScale})`,
              willChange: 'transform',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
