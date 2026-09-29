'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { DotMatrixTextEngine, type DotMatrixTextOptions } from './dot-matrix-text.engine'

export interface DotMatrixTextProps extends Partial<Omit<DotMatrixTextOptions, 'text'>> {
  text: string
  goo: number
  className?: string
  style?: CSSProperties
}

export const dotMatrixTextDefaults: DotMatrixTextOptions = {
  text: 'UIgrove',
  fontSize: 120,
  fontWeight: 600,
  fontFamily: '',
  dotSize: 4,
  gap: 7,
  color: '#ffffff',
  align: 'center',
  duration: 1400,
  stagger: 600,
  scatter: 160,
  order: 'random',
  fitWidth: true,
  interactive: true,
  radius: 80,
  strength: 14,
  seed: 3,
  linkWidth: 0.4,
  squareSize: 1,
  squareRadius: 0.25,
}

export function DotMatrixText({
  text,
  fontSize = dotMatrixTextDefaults.fontSize,
  fontWeight = dotMatrixTextDefaults.fontWeight,
  fontFamily = dotMatrixTextDefaults.fontFamily,
  dotSize = dotMatrixTextDefaults.dotSize,
  gap = dotMatrixTextDefaults.gap,
  color = dotMatrixTextDefaults.color,
  align = dotMatrixTextDefaults.align,
  duration = dotMatrixTextDefaults.duration,
  stagger = dotMatrixTextDefaults.stagger,
  scatter = dotMatrixTextDefaults.scatter,
  order = dotMatrixTextDefaults.order,
  fitWidth = dotMatrixTextDefaults.fitWidth,
  interactive = dotMatrixTextDefaults.interactive,
  radius = dotMatrixTextDefaults.radius,
  strength = dotMatrixTextDefaults.strength,
  seed = dotMatrixTextDefaults.seed,
  linkWidth = dotMatrixTextDefaults.linkWidth,
  squareSize = dotMatrixTextDefaults.squareSize,
  squareRadius = dotMatrixTextDefaults.squareRadius,
  points,
  links,
  shapes,
  goo = 0,
  className,
  style,
}: Partial<DotMatrixTextProps> & { text: string }) {
  const engineRef = useRef<DotMatrixTextEngine | null>(null)
  if (!engineRef.current) engineRef.current = new DotMatrixTextEngine(dotMatrixTextDefaults)
  const engine = engineRef.current
  const filterId = useId()
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, { pointer: interactive })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const family = fontFamily || getComputedStyle(container).fontFamily
    const options = {
      text,
      fontSize,
      fontWeight,
      fontFamily: family,
      dotSize,
      gap,
      color,
      align,
      duration,
      stagger,
      scatter,
      order,
      fitWidth,
      interactive,
      radius,
      strength,
      seed,
      linkWidth,
      squareSize,
      squareRadius,
      points,
      links,
      shapes,
    }
    engine.setOptions(options)
    wake()
    let cancelled = false
    document.fonts?.load(`${fontWeight} ${fontSize}px ${family}`).then(() => {
      if (cancelled) return
      engine.setOptions({ ...options, seed: seed })
      engine.resize(container.clientWidth, container.clientHeight)
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
    fontSize,
    fontWeight,
    fontFamily,
    dotSize,
    gap,
    color,
    align,
    duration,
    stagger,
    scatter,
    order,
    fitWidth,
    interactive,
    radius,
    strength,
    seed,
    linkWidth,
    squareSize,
    squareRadius,
    points,
    links,
    shapes,
  ])

  const blur = goo * dotSize * 0.6
  const slope = 12 + goo * 28
  const intercept = -slope * 0.5 + 0.5

  return (
    <div
      ref={containerRef}
      className={['uig-dot-matrix-text', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={{ height: Math.ceil(fontSize * 1.3), ...style }}
    >
      <span className="sr-only">{text}</span>
      {goo > 0 ? (
        <svg className="absolute size-0" aria-hidden="true">
          <defs>
            <filter id={filterId} colorInterpolationFilters="sRGB">
              <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
              <feColorMatrix
                in="blur"
                type="matrix"
                values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${slope} ${intercept}`}
              />
            </filter>
          </defs>
        </svg>
      ) : null}
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        aria-hidden="true"
        style={goo > 0 ? { filter: `url(#${filterId})` } : undefined}
      />
    </div>
  )
}
