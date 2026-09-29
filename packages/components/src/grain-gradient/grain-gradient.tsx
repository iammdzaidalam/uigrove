'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { GrainGradientEngine, type GrainGradientOptions } from './grain-gradient.engine'

export interface GrainGradientProps extends Partial<GrainGradientOptions> {
  className?: string
  style?: CSSProperties
}

export const grainGradientDefaults: GrainGradientOptions = {
  colorLight: '#e4e4e8',
  colorMid: '#6f6f78',
  colorDark: '#09090c',
  angle: 0,
  position: -0.25,
  curve: 0.48,
  softness: 0.18,
  scale: 1,
  grain: 0.32,
  grainSize: 1,
  seed: 1,
  speed: 1,
}

export function GrainGradient({
  colorLight = grainGradientDefaults.colorLight,
  colorMid = grainGradientDefaults.colorMid,
  colorDark = grainGradientDefaults.colorDark,
  angle = grainGradientDefaults.angle,
  position = grainGradientDefaults.position,
  curve = grainGradientDefaults.curve,
  softness = grainGradientDefaults.softness,
  scale = grainGradientDefaults.scale,
  grain = grainGradientDefaults.grain,
  grainSize = grainGradientDefaults.grainSize,
  seed = grainGradientDefaults.seed,
  speed = grainGradientDefaults.speed,
  className,
  style,
}: GrainGradientProps) {
  const engineRef = useRef<GrainGradientEngine | null>(null)
  if (!engineRef.current) engineRef.current = new GrainGradientEngine(grainGradientDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, { pointer: false, kind: 'webgl' })

  useEffect(() => {
    engine.setOptions({
      colorLight,
      colorMid,
      colorDark,
      angle,
      position,
      curve,
      softness,
      scale,
      grain,
      grainSize,
      seed,
      speed,
    })
    wake()
  }, [
    engine,
    wake,
    colorLight,
    colorMid,
    colorDark,
    angle,
    position,
    curve,
    softness,
    scale,
    grain,
    grainSize,
    seed,
    speed,
  ])

  const fallback = `linear-gradient(${90 + angle}deg, ${colorDark} 0%, ${colorMid} 55%, ${colorLight} 100%)`

  return (
    <div
      ref={containerRef}
      className={['uig-grain-gradient', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={{ background: fallback, ...style }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
