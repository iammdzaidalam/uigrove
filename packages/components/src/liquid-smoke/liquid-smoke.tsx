'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { LiquidSmokeEngine, type LiquidSmokeOptions } from './liquid-smoke.engine'

export interface LiquidSmokeProps extends Partial<LiquidSmokeOptions> {
  className?: string
  style?: CSSProperties
}

export const liquidSmokeDefaults: LiquidSmokeOptions = {
  color: '#f5f5f7',
  background: '#09090c',
  intensity: 0.7,
  scale: 2.2,
  speed: 0.35,
  height: 0.7,
  warp: 2.4,
  grain: 0.25,
  seed: 3,
}

export function LiquidSmoke({
  color = liquidSmokeDefaults.color,
  background = liquidSmokeDefaults.background,
  intensity = liquidSmokeDefaults.intensity,
  scale = liquidSmokeDefaults.scale,
  speed = liquidSmokeDefaults.speed,
  height = liquidSmokeDefaults.height,
  warp = liquidSmokeDefaults.warp,
  grain = liquidSmokeDefaults.grain,
  seed = liquidSmokeDefaults.seed,
  className,
  style,
}: LiquidSmokeProps) {
  const engineRef = useRef<LiquidSmokeEngine | null>(null)
  if (!engineRef.current) engineRef.current = new LiquidSmokeEngine(liquidSmokeDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, {
    pointer: false,
    kind: 'webgl',
    maxDpr: 1,
  })

  useEffect(() => {
    engine.setOptions({ color, background, intensity, scale, speed, height, warp, grain, seed })
    wake()
  }, [engine, wake, color, background, intensity, scale, speed, height, warp, grain, seed])

  return (
    <div
      ref={containerRef}
      className={['uig-liquid-smoke', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={{ background, ...style }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
