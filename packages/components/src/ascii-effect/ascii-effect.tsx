'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { AsciiEffectEngine, type AsciiEffectOptions } from './ascii-effect.engine'

export interface AsciiEffectProps extends Partial<Omit<AsciiEffectOptions, 'src'>> {
  src: string
  alt?: string
  className?: string
  style?: CSSProperties
}

export const asciiEffectDefaults: AsciiEffectOptions = {
  src: '',
  variant: 'flow',
  fit: 'contain',
  cellSize: 11,
  chars: ' .:-=+*#%@',
  color: '#ffffff',
  colorMode: 'mono',
  invert: false,
  contrast: 0.1,
  brightness: 0,
  posterize: 0,
  dither: 'none',
  speed: 1,
  mouseRadius: 150,
  mouseStrength: 0.5,
  glitchIntensity: 0.65,
  seed: 1,
  fontFamily: '',
  fontWeight: 500,
}

const VIDEO_PATTERN = /\.(mp4|webm|mov|ogv|m4v)(\?|#|$)/i

export function AsciiEffect({
  src,
  alt = '',
  variant = asciiEffectDefaults.variant,
  fit = asciiEffectDefaults.fit,
  cellSize = asciiEffectDefaults.cellSize,
  chars = asciiEffectDefaults.chars,
  color = asciiEffectDefaults.color,
  colorMode = asciiEffectDefaults.colorMode,
  invert = asciiEffectDefaults.invert,
  contrast = asciiEffectDefaults.contrast,
  brightness = asciiEffectDefaults.brightness,
  posterize = asciiEffectDefaults.posterize,
  dither = asciiEffectDefaults.dither,
  speed = asciiEffectDefaults.speed,
  mouseRadius = asciiEffectDefaults.mouseRadius,
  mouseStrength = asciiEffectDefaults.mouseStrength,
  glitchIntensity = asciiEffectDefaults.glitchIntensity,
  seed = asciiEffectDefaults.seed,
  fontFamily = asciiEffectDefaults.fontFamily,
  fontWeight = asciiEffectDefaults.fontWeight,
  className,
  style,
}: AsciiEffectProps) {
  const engineRef = useRef<AsciiEffectEngine | null>(null)
  if (!engineRef.current) engineRef.current = new AsciiEffectEngine(asciiEffectDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, { pointer: mouseStrength > 0 })

  useEffect(() => {
    const container = containerRef.current
    const family = fontFamily || (container ? getComputedStyle(container).fontFamily : '')
    engine.setOptions({
      src,
      variant,
      fit,
      cellSize,
      chars: chars || ' ',
      color,
      colorMode,
      invert,
      contrast,
      brightness,
      posterize,
      dither,
      speed,
      mouseRadius,
      mouseStrength,
      glitchIntensity,
      seed,
      fontFamily: family,
      fontWeight,
    })
    wake()
  }, [
    engine,
    wake,
    containerRef,
    src,
    variant,
    fit,
    cellSize,
    chars,
    color,
    colorMode,
    invert,
    contrast,
    brightness,
    posterize,
    dither,
    speed,
    mouseRadius,
    mouseStrength,
    glitchIntensity,
    seed,
    fontFamily,
    fontWeight,
  ])

  useEffect(() => {
    if (!src) {
      engine.setSource(null)
      wake()
      return
    }
    let cancelled = false
    if (VIDEO_PATTERN.test(src)) {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.muted = true
      video.loop = true
      video.playsInline = true
      video.preload = 'auto'
      video.src = src
      const onReady = () => {
        if (cancelled) return
        engine.setSource(video)
        video.play().catch(() => {})
        wake()
      }
      video.addEventListener('loadeddata', onReady)
      video.load()
      return () => {
        cancelled = true
        video.removeEventListener('loadeddata', onReady)
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    }
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      if (cancelled) return
      engine.setSource(image)
      wake()
    }
    image.onerror = () => {
      if (cancelled) return
      engine.setSource(null)
      wake()
    }
    image.src = src
    return () => {
      cancelled = true
    }
  }, [engine, wake, src])

  return (
    <div
      ref={containerRef}
      className={['uig-ascii-effect', 'pointer-events-none overflow-hidden font-mono', className]
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
