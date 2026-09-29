'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { FilmGrainEngine, type FilmGrainOptions } from './film-grain.engine'

export interface FilmGrainProps extends Partial<FilmGrainOptions> {
  className?: string
  style?: CSSProperties
}

export const filmGrainDefaults: FilmGrainOptions = {
  intensity: 0.5,
  size: 1,
  speed: 1,
  blend: 'overlay',
  monochrome: true,
  fps: 24,
}

export function FilmGrain({
  intensity = filmGrainDefaults.intensity,
  size = filmGrainDefaults.size,
  speed = filmGrainDefaults.speed,
  blend = filmGrainDefaults.blend,
  monochrome = filmGrainDefaults.monochrome,
  fps = filmGrainDefaults.fps,
  className,
  style,
}: FilmGrainProps) {
  const engineRef = useRef<FilmGrainEngine | null>(null)
  if (!engineRef.current) engineRef.current = new FilmGrainEngine(filmGrainDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, { pointer: false, kind: 'webgl' })

  useEffect(() => {
    engine.setOptions({ intensity, size, speed, blend, monochrome, fps })
    wake()
  }, [engine, wake, intensity, size, speed, blend, monochrome, fps])

  return (
    <div
      ref={containerRef}
      className={['uig-film-grain', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="uig-film-grain__canvas block h-full w-full"
        style={{ mixBlendMode: blend }}
      />
    </div>
  )
}
