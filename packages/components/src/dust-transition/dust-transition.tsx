'use client'

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { DustTransitionEngine, type DustTransitionFrame } from './dust-transition.engine'

export interface DustTransitionOptions {
  scrollLength: number
  dolly: number
  focusX: number
  focusY: number
  dust: number
  flare: number
  sparks: number
  smoothing: number
  background: string
  viewportHeight: string
}

export interface DustTransitionProps extends Partial<DustTransitionOptions> {
  // The opening scene, dollies in toward the focus as you scroll
  hero: ReactNode
  // Next scene, bursts through the focus as dust
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

export const dustTransitionDefaults: DustTransitionOptions = {
  scrollLength: 1200,
  dolly: 1.38,
  focusX: 0.5,
  focusY: 0.58,
  dust: 1,
  flare: 1,
  sparks: 1,
  smoothing: 0.14,
  background: '#09090c',
  viewportHeight: '100dvh',
}

export function DustTransition({
  hero,
  children,
  scrollLength = dustTransitionDefaults.scrollLength,
  dolly = dustTransitionDefaults.dolly,
  focusX = dustTransitionDefaults.focusX,
  focusY = dustTransitionDefaults.focusY,
  dust = dustTransitionDefaults.dust,
  flare = dustTransitionDefaults.flare,
  sparks = dustTransitionDefaults.sparks,
  smoothing = dustTransitionDefaults.smoothing,
  background = dustTransitionDefaults.background,
  viewportHeight = dustTransitionDefaults.viewportHeight,
  className,
  style,
}: DustTransitionProps) {
  const engineRef = useRef<DustTransitionEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new DustTransitionEngine({
      dolly,
      focusX,
      focusY,
      dust,
      flare,
      sparks,
      smoothing,
      instant: false,
    })
  }
  const engine = engineRef.current
  const { containerRef, canvasRef, reducedMotion, wake } = useDotCanvas(engine, {
    pointer: false,
    kind: 'webgl',
  })
  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    engine.setOptions({
      dolly,
      focusX,
      focusY,
      dust,
      flare,
      sparks,
      smoothing,
      instant: reducedMotion,
    })
    wake()
  }, [engine, wake, dolly, focusX, focusY, dust, flare, sparks, smoothing, reducedMotion])

  useEffect(() => {
    const apply = (frame: DustTransitionFrame) => {
      const heroEl = heroRef.current
      const windowEl = windowRef.current
      const nextEl = nextRef.current
      if (heroEl) heroEl.style.transform = `scale(${frame.heroScale})`
      if (nextEl) nextEl.style.transform = `scale(${frame.nextScale})`
      if (windowEl) windowEl.style.clipPath = frame.clip
    }
    engine.onFrame = apply
    apply(engine.frame)
    return () => {
      engine.onFrame = null
    }
  }, [engine])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let first = true

    const measure = () => {
      const top = root.getBoundingClientRect().top
      engine.setTarget(-top / scrollLength, first)
      first = false
      wake()
    }

    measure()
    window.addEventListener('scroll', measure, { passive: true, capture: true })
    const resize = new ResizeObserver(measure)
    resize.observe(root)

    return () => {
      window.removeEventListener('scroll', measure, { capture: true })
      resize.disconnect()
    }
  }, [engine, wake, scrollLength])

  const origin = `${focusX * 100}% ${focusY * 100}%`

  return (
    <div
      ref={rootRef}
      className={['uig-dust-transition', 'relative w-full', className].filter(Boolean).join(' ')}
      style={{ height: `calc(${scrollLength}px + ${viewportHeight})`, ...style }}
    >
      <div
        ref={containerRef}
        className="uig-dust-transition__stage sticky top-0 isolate w-full overflow-hidden"
        style={{ height: viewportHeight, backgroundColor: background }}
      >
        <div
          ref={heroRef}
          className="uig-dust-transition__hero absolute inset-0"
          style={{ transformOrigin: origin, willChange: 'transform' }}
        >
          {hero}
        </div>
        <div
          ref={windowRef}
          className="uig-dust-transition__window absolute inset-0"
          style={{ clipPath: 'inset(100%)', willChange: 'clip-path' }}
        >
          <div
            ref={nextRef}
            className="uig-dust-transition__next absolute inset-0"
            style={{ transformOrigin: origin, willChange: 'transform' }}
          >
            {children}
          </div>
        </div>
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          role="presentation"
          className="uig-dust-transition__light pointer-events-none absolute inset-0 block h-full w-full mix-blend-plus-lighter"
        />
      </div>
    </div>
  )
}
