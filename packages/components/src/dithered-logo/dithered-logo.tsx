'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { DitheredLogoEngine, type DitheredLogoOptions } from './dithered-logo.engine'

export interface DitheredLogoProps extends Partial<Omit<DitheredLogoOptions, 'src'>> {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
}

export const ditheredLogoDefaults: DitheredLogoOptions = {
  src: '',
  gridSize: 140,
  scale: 0.7,
  dotScale: 1,
  invert: false,
  cornerRadius: 0.2,
  threshold: 128,
  contrast: 0,
  gamma: 1,
  blur: 1,
  diffusion: 1,
  serpentine: true,
  color: '#ffffff',
  opacity: 1,
  radius: 120,
  strength: 22,
  stiffness: 160,
  damping: 16,
  ripple: true,
  rippleStrength: 16,
  interactive: true,
}

export function DitheredLogo({
  src,
  alt = '',
  gridSize = ditheredLogoDefaults.gridSize,
  scale = ditheredLogoDefaults.scale,
  dotScale = ditheredLogoDefaults.dotScale,
  invert = ditheredLogoDefaults.invert,
  cornerRadius = ditheredLogoDefaults.cornerRadius,
  threshold = ditheredLogoDefaults.threshold,
  contrast = ditheredLogoDefaults.contrast,
  gamma = ditheredLogoDefaults.gamma,
  blur = ditheredLogoDefaults.blur,
  diffusion = ditheredLogoDefaults.diffusion,
  serpentine = ditheredLogoDefaults.serpentine,
  color = ditheredLogoDefaults.color,
  opacity = ditheredLogoDefaults.opacity,
  radius = ditheredLogoDefaults.radius,
  strength = ditheredLogoDefaults.strength,
  stiffness = ditheredLogoDefaults.stiffness,
  damping = ditheredLogoDefaults.damping,
  ripple = ditheredLogoDefaults.ripple,
  rippleStrength = ditheredLogoDefaults.rippleStrength,
  interactive = ditheredLogoDefaults.interactive,
  className,
  style,
}: DitheredLogoProps) {
  const engineRef = useRef<DitheredLogoEngine | null>(null)
  if (!engineRef.current) engineRef.current = new DitheredLogoEngine(ditheredLogoDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, { pointer: interactive })

  useEffect(() => {
    engine.setOptions({
      src,
      gridSize,
      scale,
      dotScale,
      invert,
      cornerRadius,
      threshold,
      contrast,
      gamma,
      blur,
      diffusion,
      serpentine,
      color,
      opacity,
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
    src,
    gridSize,
    scale,
    dotScale,
    invert,
    cornerRadius,
    threshold,
    contrast,
    gamma,
    blur,
    diffusion,
    serpentine,
    color,
    opacity,
    radius,
    strength,
    stiffness,
    damping,
    ripple,
    rippleStrength,
    interactive,
  ])

  useEffect(() => {
    if (!src) {
      engine.setImage(null)
      wake()
      return
    }
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    let cancelled = false
    image.onload = () => {
      if (cancelled) return
      engine.setImage(image)
      wake()
    }
    image.onerror = () => {
      if (cancelled) return
      engine.setImage(null)
      wake()
    }
    image.src = src
    return () => {
      cancelled = true
    }
  }, [engine, wake, src])

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
      className={['uig-dithered-logo', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
