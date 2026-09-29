'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { DotGridEngine, type DotGridOptions } from './dot-grid.engine'

export interface DotGridProps extends Partial<DotGridOptions> {
  className?: string
  style?: CSSProperties
}

export const dotGridDefaults: DotGridOptions = {
  dotSize: 2,
  gap: 24,
  color: '#ffffff',
  opacity: 0.35,
  shape: 'circle',
  radius: 140,
  strength: 28,
  stiffness: 160,
  damping: 16,
  ripple: true,
  rippleStrength: 18,
  interactive: true,
}

export function DotGrid({
  dotSize = dotGridDefaults.dotSize,
  gap = dotGridDefaults.gap,
  color = dotGridDefaults.color,
  opacity = dotGridDefaults.opacity,
  shape = dotGridDefaults.shape,
  radius = dotGridDefaults.radius,
  strength = dotGridDefaults.strength,
  stiffness = dotGridDefaults.stiffness,
  damping = dotGridDefaults.damping,
  ripple = dotGridDefaults.ripple,
  rippleStrength = dotGridDefaults.rippleStrength,
  interactive = dotGridDefaults.interactive,
  className,
  style,
}: DotGridProps) {
  const engineRef = useRef<DotGridEngine | null>(null)
  if (!engineRef.current) engineRef.current = new DotGridEngine(dotGridDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, { pointer: interactive })

  useEffect(() => {
    engine.setOptions({
      dotSize,
      gap,
      color,
      opacity,
      shape,
      radius,
      strength,
      stiffness,
      damping,
      ripple,
      rippleStrength,
      interactive,
    })
    wake()
  }, [
    engine,
    wake,
    dotSize,
    gap,
    color,
    opacity,
    shape,
    radius,
    strength,
    stiffness,
    damping,
    ripple,
    rippleStrength,
    interactive,
  ])

  useEffect(() => {
    if (!ripple || !interactive) return
    const container = containerRef.current
    if (!container) return
    const onDown = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect()
      engine.addRipple(e.clientX - rect.left, e.clientY - rect.top)
      wake()
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    return () => window.removeEventListener('pointerdown', onDown)
  }, [engine, wake, ripple, interactive, containerRef])

  return (
    <div
      ref={containerRef}
      className={['uig-dot-grid', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
