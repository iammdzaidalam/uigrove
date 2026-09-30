'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { VectorWordmarkEngine, type VectorWordmarkOptions } from './vector-wordmark.engine'

export interface VectorWordmarkProps extends Partial<Omit<VectorWordmarkOptions, 'text'>> {
  text: string
  className?: string
  style?: CSSProperties
}

export const vectorWordmarkDefaults: VectorWordmarkOptions = {
  text: 'VECTOR',
  path: '',
  fontSize: 160,
  fontWeight: 800,
  fontFamily: '',
  fitWidth: true,
  color: '#ffffff',
  strokeWidth: 1.2,
  dash: 3,
  reach: 220,
  speed: 0.5,
  damping: 0.6,
  guides: true,
  labels: true,
  interaction: 'hover',
  duration: 900,
  stagger: 120,
  intro: true,
}

export function VectorWordmark({
  text,
  path = vectorWordmarkDefaults.path,
  fontSize = vectorWordmarkDefaults.fontSize,
  fontWeight = vectorWordmarkDefaults.fontWeight,
  fontFamily = vectorWordmarkDefaults.fontFamily,
  fitWidth = vectorWordmarkDefaults.fitWidth,
  color = vectorWordmarkDefaults.color,
  strokeWidth = vectorWordmarkDefaults.strokeWidth,
  dash = vectorWordmarkDefaults.dash,
  reach = vectorWordmarkDefaults.reach,
  speed = vectorWordmarkDefaults.speed,
  damping = vectorWordmarkDefaults.damping,
  guides = vectorWordmarkDefaults.guides,
  labels = vectorWordmarkDefaults.labels,
  interaction = vectorWordmarkDefaults.interaction,
  duration = vectorWordmarkDefaults.duration,
  stagger = vectorWordmarkDefaults.stagger,
  intro = vectorWordmarkDefaults.intro,
  className,
  style,
}: VectorWordmarkProps) {
  const engineRef = useRef<VectorWordmarkEngine | null>(null)
  if (!engineRef.current) engineRef.current = new VectorWordmarkEngine(vectorWordmarkDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, {
    pointer: interaction === 'hover',
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const family = fontFamily || getComputedStyle(container).fontFamily
    const options: VectorWordmarkOptions = {
      text,
      path,
      fontSize,
      fontWeight,
      fontFamily: family,
      fitWidth,
      color,
      strokeWidth,
      dash,
      reach,
      speed,
      damping,
      guides,
      labels,
      interaction,
      duration,
      stagger,
      intro,
    }
    engine.setOptions(options)
    wake()
    let cancelled = false
    document.fonts?.load(`${fontWeight} ${fontSize}px ${family}`).then(() => {
      if (cancelled) return
      engine.setOptions({ ...options })
      engine.resize(
        container.clientWidth,
        container.clientHeight,
        Math.min(window.devicePixelRatio || 1, 2),
      )
      wake()
    })
    return () => {
      cancelled = true
    }
  }, [
    engine,
    wake,
    containerRef,
    text,
    path,
    fontSize,
    fontWeight,
    fontFamily,
    fitWidth,
    color,
    strokeWidth,
    dash,
    reach,
    speed,
    damping,
    guides,
    labels,
    interaction,
    duration,
    stagger,
    intro,
  ])

  return (
    <div
      ref={containerRef}
      className={['uig-vector-wordmark', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      <canvas
        ref={canvasRef}
        className="uig-vector-wordmark__canvas block h-full w-full"
        aria-hidden="true"
        role="presentation"
      />
      <span className="uig-vector-wordmark__text sr-only">{text}</span>
    </div>
  )
}
