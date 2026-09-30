'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { useDotCanvas } from '../lib/dot-canvas'
import {
  DotGlobeEngine,
  type GlobeHover,
  type DotGlobeMarker,
  type DotGlobeOptions,
} from './dot-globe.engine'

export interface DotGlobeProps extends Partial<DotGlobeOptions> {
  markers?: DotGlobeMarker[]
  className?: string
  style?: CSSProperties
}

export const dotGlobeDefaults: DotGlobeOptions = {
  dotSize: 2,
  dotSpacing: 3,
  rotationSpeed: 6,
  drag: true,
  color: '#ffffff',
  landOpacity: 0.85,
  oceanOpacity: 0.1,
  backOpacity: 0.12,
  atmosphere: true,
  tilt: 18,
  markerSize: 3.5,
}

const EMPTY_MARKERS: DotGlobeMarker[] = []

interface DragState {
  active: boolean
  x: number
  y: number
}

export function DotGlobe({
  markers = EMPTY_MARKERS,
  dotSize = dotGlobeDefaults.dotSize,
  dotSpacing = dotGlobeDefaults.dotSpacing,
  rotationSpeed = dotGlobeDefaults.rotationSpeed,
  drag = dotGlobeDefaults.drag,
  color = dotGlobeDefaults.color,
  landOpacity = dotGlobeDefaults.landOpacity,
  oceanOpacity = dotGlobeDefaults.oceanOpacity,
  backOpacity = dotGlobeDefaults.backOpacity,
  atmosphere = dotGlobeDefaults.atmosphere,
  tilt = dotGlobeDefaults.tilt,
  markerSize = dotGlobeDefaults.markerSize,
  className,
  style,
}: DotGlobeProps) {
  const engineRef = useRef<DotGlobeEngine | null>(null)
  if (!engineRef.current) engineRef.current = new DotGlobeEngine(dotGlobeDefaults)
  const engine = engineRef.current
  const { containerRef, canvasRef, reducedMotion, wake } = useDotCanvas(engine)
  const [hover, setHover] = useState<GlobeHover | null>(null)
  const dragRef = useRef<DragState>({ active: false, x: 0, y: 0 })

  useEffect(() => {
    engine.setOptions({
      dotSize,
      dotSpacing,
      rotationSpeed,
      drag,
      color,
      landOpacity,
      oceanOpacity,
      backOpacity,
      atmosphere,
      tilt,
      markerSize,
    })
    wake()
  }, [
    engine,
    wake,
    dotSize,
    dotSpacing,
    rotationSpeed,
    drag,
    color,
    landOpacity,
    oceanOpacity,
    backOpacity,
    atmosphere,
    tilt,
    markerSize,
  ])

  useEffect(() => {
    engine.setMarkers(markers)
    wake()
  }, [engine, wake, markers])

  useEffect(() => {
    engine.onHover = (next) => setHover(next)
    return () => {
      engine.onHover = null
    }
  }, [engine])

  const finishDrag = useCallback(() => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    engine.dragEnd(reducedMotion)
    wake()
  }, [engine, wake, reducedMotion])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { active: true, x: e.clientX, y: e.clientY }
    engine.dragStart()
    wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!state.active) return
    engine.dragMove(e.clientX - state.x, e.clientY - state.y)
    state.x = e.clientX
    state.y = e.clientY
    wake()
  }

  const label = hover ? markers[hover.index]?.label : undefined

  return (
    <div
      className={['uig-dot-globe', 'overflow-hidden', className].filter(Boolean).join(' ')}
      style={{ cursor: drag ? 'grab' : undefined, touchAction: 'pan-y', ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    >
      <div ref={containerRef} className="uig-dot-globe__stage relative h-full w-full">
        <canvas
          ref={canvasRef}
          className="uig-dot-globe__canvas block h-full w-full"
          aria-hidden="true"
          role="presentation"
        />
        {hover && label && (
          <span
            className="uig-dot-globe__label pointer-events-none absolute -translate-x-1/2 whitespace-nowrap rounded-sm bg-current px-2 py-1 font-mono text-[11px] tracking-[0.08em] uppercase"
            style={{
              left: hover.x,
              top: hover.y - markerSize * 3 - 4,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <span className="uig-dot-globe__label-text mix-blend-difference text-white">
              {label}
            </span>
          </span>
        )}
      </div>
      <ul className="uig-dot-globe__list sr-only">
        {markers.map((marker) => (
          <li key={`${marker.lat},${marker.lng}`}>{marker.label}</li>
        ))}
      </ul>
    </div>
  )
}
