'use client'

import { useEffect, useId, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { GooeyDotsEngine, type GooeyDotsOptions } from './gooey-dots.engine'

export interface GooeyDotsProps extends Partial<GooeyDotsOptions> {
  goo: number
  className?: string
  style?: CSSProperties
}

export const gooeyDotsDefaults: GooeyDotsOptions & { goo: number } = {
  count: 24,
  size: 28,
  sizeVariance: 0.4,
  color: '#ffffff',
  speed: 1,
  wander: 60,
  cursorRadius: 220,
  cursorMode: 'attract',
  cursorStrength: 260,
  seed: 7,
  goo: 0.6,
}

export function GooeyDots({
  count = gooeyDotsDefaults.count,
  size = gooeyDotsDefaults.size,
  sizeVariance = gooeyDotsDefaults.sizeVariance,
  color = gooeyDotsDefaults.color,
  speed = gooeyDotsDefaults.speed,
  wander = gooeyDotsDefaults.wander,
  cursorRadius = gooeyDotsDefaults.cursorRadius,
  cursorMode = gooeyDotsDefaults.cursorMode,
  cursorStrength = gooeyDotsDefaults.cursorStrength,
  seed = gooeyDotsDefaults.seed,
  goo = gooeyDotsDefaults.goo,
  className,
  style,
}: Partial<GooeyDotsProps>) {
  const engineRef = useRef<GooeyDotsEngine | null>(null)
  if (!engineRef.current) engineRef.current = new GooeyDotsEngine(gooeyDotsDefaults)
  const engine = engineRef.current
  const filterId = useId()
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, { pointer: cursorMode !== 'none' })

  useEffect(() => {
    engine.setOptions({
      count,
      size,
      sizeVariance,
      color,
      speed,
      wander,
      cursorRadius,
      cursorMode,
      cursorStrength,
      seed,
    })
    wake()
  }, [
    engine,
    wake,
    count,
    size,
    sizeVariance,
    color,
    speed,
    wander,
    cursorRadius,
    cursorMode,
    cursorStrength,
    seed,
  ])

  const blur = Math.max(0, goo) * size * 0.55
  const slope = 12 + goo * 28
  const intercept = -slope * 0.5 + 0.5

  return (
    <div
      ref={containerRef}
      className={['uig-gooey-dots', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden="true"
    >
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
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={goo > 0 ? { filter: `url(#${filterId})` } : undefined}
      />
    </div>
  )
}
