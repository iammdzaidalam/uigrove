'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import { TextTunnelEngine, type TextTunnelOptions } from './text-tunnel.engine'

export interface TextTunnelProps extends Partial<TextTunnelOptions> {
  className?: string
  style?: CSSProperties
}

export const textTunnelDefaults: TextTunnelOptions = {
  text: 'Into the\nGrove',
  fontFamily: '"Instrument Serif", Georgia, serif',
  fontSize: 98,
  fontWeight: 400,
  fontStyle: 'normal',
  letterSpacing: -0.5,
  lineHeight: 1,
  gap: 0,
  columns: 1,
  textColor: '#ffffff',
  background: '#000000',
  speed: 0.84,
  direction: 'down',
  radius: 0.16,
  depth: 1,
  flare: 0.46,
  bloom: 0.88,
  chromatic: 0.21,
  fade: 0,
  twist: 0,
  cursorInfluence: 0,
}

export function TextTunnel({
  text = textTunnelDefaults.text,
  fontFamily = textTunnelDefaults.fontFamily,
  fontSize = textTunnelDefaults.fontSize,
  fontWeight = textTunnelDefaults.fontWeight,
  fontStyle = textTunnelDefaults.fontStyle,
  letterSpacing = textTunnelDefaults.letterSpacing,
  lineHeight = textTunnelDefaults.lineHeight,
  gap = textTunnelDefaults.gap,
  columns = textTunnelDefaults.columns,
  textColor = textTunnelDefaults.textColor,
  background = textTunnelDefaults.background,
  speed = textTunnelDefaults.speed,
  direction = textTunnelDefaults.direction,
  radius = textTunnelDefaults.radius,
  depth = textTunnelDefaults.depth,
  flare = textTunnelDefaults.flare,
  bloom = textTunnelDefaults.bloom,
  chromatic = textTunnelDefaults.chromatic,
  fade = textTunnelDefaults.fade,
  twist = textTunnelDefaults.twist,
  cursorInfluence = textTunnelDefaults.cursorInfluence,
  className,
  style,
}: TextTunnelProps) {
  const engineRef = useRef<TextTunnelEngine | null>(null)
  if (!engineRef.current) engineRef.current = new TextTunnelEngine(textTunnelDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, wake } = useDotCanvas(engine, {
    pointer: cursorInfluence > 0,
    kind: 'webgl',
  })

  useEffect(() => {
    engine.setOptions({
      text,
      fontFamily,
      fontSize,
      fontWeight,
      fontStyle,
      letterSpacing,
      lineHeight,
      gap,
      columns,
      textColor,
      background,
      speed,
      direction,
      radius,
      depth,
      flare,
      bloom,
      chromatic,
      fade,
      twist,
      cursorInfluence,
    })
    wake()
  }, [
    engine,
    wake,
    text,
    fontFamily,
    fontSize,
    fontWeight,
    fontStyle,
    letterSpacing,
    lineHeight,
    gap,
    columns,
    textColor,
    background,
    speed,
    direction,
    radius,
    depth,
    flare,
    bloom,
    chromatic,
    fade,
    twist,
    cursorInfluence,
  ])

  useEffect(() => {
    const fonts = document.fonts
    if (!fonts) return
    let active = true
    const refresh = () => {
      if (!active) return
      engine.refreshText()
      wake()
    }
    fonts
      .load(`${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`, text)
      .then(refresh, () => {})
    fonts.addEventListener('loadingdone', refresh)
    return () => {
      active = false
      fonts.removeEventListener('loadingdone', refresh)
    }
  }, [engine, wake, fontFamily, fontSize, fontWeight, fontStyle, text])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onLost = (e: Event) => {
      e.preventDefault()
      engine.resetContext()
    }
    const onRestored = () => {
      engine.resetContext()
      wake()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [engine, wake, canvasRef])

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={text.replace(/\s+/g, ' ').trim()}
      className={['uig-text-tunnel', 'pointer-events-none overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={{ background, ...style }}
    >
      <canvas
        ref={canvasRef}
        className="uig-text-tunnel__canvas block h-full w-full"
        aria-hidden="true"
        role="presentation"
      />
    </div>
  )
}
