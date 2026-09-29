'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { OrbitTilesEngine, orbitLayout } from './orbit-tiles.engine'

export interface OrbitTilesItem {
  image: string
  alt?: string
}

export interface OrbitTilesOptions {
  radiusX: number
  radiusY: number
  tileWidth: number
  tileHeight: number
  speed: number
  tilt: number
  roll: number
  perspective: number
  blur: number
  dimming: number
  pauseOnHover: boolean
  drag: boolean
}

export interface OrbitTilesProps extends Partial<OrbitTilesOptions> {
  items: OrbitTilesItem[]
  className?: string
  style?: CSSProperties
}

export const orbitTilesDefaults: OrbitTilesOptions = {
  radiusX: 520,
  radiusY: 260,
  tileWidth: 200,
  tileHeight: 250,
  speed: 10,
  tilt: 22,
  roll: -12,
  perspective: 1500,
  blur: 8,
  dimming: 0.6,
  pauseOnHover: true,
  drag: true,
}

const MAX_DT = 1 / 30
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface DragState {
  active: boolean
  x: number
}

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  )
}

export function OrbitTiles({
  items,
  radiusX = orbitTilesDefaults.radiusX,
  radiusY = orbitTilesDefaults.radiusY,
  tileWidth = orbitTilesDefaults.tileWidth,
  tileHeight = orbitTilesDefaults.tileHeight,
  speed = orbitTilesDefaults.speed,
  tilt = orbitTilesDefaults.tilt,
  roll = orbitTilesDefaults.roll,
  perspective = orbitTilesDefaults.perspective,
  blur = orbitTilesDefaults.blur,
  dimming = orbitTilesDefaults.dimming,
  pauseOnHover = orbitTilesDefaults.pauseOnHover,
  drag = orbitTilesDefaults.drag,
  className,
  style,
}: OrbitTilesProps) {
  const count = items.length
  const reduced = useReducedMotion()
  const engineRef = useRef<OrbitTilesEngine | null>(null)
  if (!engineRef.current) engineRef.current = new OrbitTilesEngine({ count, speed, instant: false })
  const engine = engineRef.current
  const [angle, setAngle] = useState(() => engine.angle)
  const rootRef = useRef<HTMLDivElement>(null)
  const wakeRef = useRef<() => void>(() => {})
  const dragRef = useRef<DragState>({ active: false, x: 0 })

  const wake = useCallback(() => wakeRef.current(), [])

  const publish = useCallback(() => {
    const next = engine.angle
    setAngle((current) => (current === next ? current : next))
  }, [engine])

  useEffect(() => {
    engine.setOptions({ count, speed, instant: reduced })
    wake()
  }, [engine, wake, count, speed, reduced])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let visible = true
    let frame = 0
    let last = 0

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt)
      publish()
      if (!engine.idle) frame = requestAnimationFrame(loop)
      else last = 0
    }

    const start = () => {
      if (frame || !visible) return
      last = 0
      frame = requestAnimationFrame(loop)
    }

    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }

    wakeRef.current = start
    start()

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
      else stop()
    })
    intersection.observe(root)

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      wakeRef.current = () => {}
    }
  }, [engine, publish])

  const onPointerEnter = () => {
    if (!pauseOnHover) return
    engine.setHover(true)
    wake()
  }

  const onPointerLeave = () => {
    engine.setHover(false)
    wake()
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || (e.pointerType === 'mouse' && e.button !== 0)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { active: true, x: e.clientX }
    engine.dragStart()
    wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const state = dragRef.current
    if (!state.active) return
    const dx = e.clientX - state.x
    state.x = e.clientX
    engine.dragMove(dx, radiusX)
    wake()
  }

  const finishDrag = () => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    engine.dragEnd()
    wake()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') engine.nudge(-1)
    else if (e.key === 'ArrowRight') engine.nudge(1)
    else return
    e.preventDefault()
    wake()
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label="Orbiting tiles"
      tabIndex={0}
      className={[
        'uig-orbit-tiles',
        'overflow-hidden select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ cursor: drag ? 'grab' : undefined, touchAction: 'pan-y', ...style }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onKeyDown={onKeyDown}
    >
      <div className="uig-orbit-tiles__stage relative h-full w-full">
        {items.map((item, index) => {
          const tile = orbitLayout(angle, index, count, radiusX, radiusY, tilt, roll, perspective)
          const back = 1 - tile.depth
          const softness = blur * back * back
          return (
            <figure
              key={`${item.image}-${index}`}
              className="uig-orbit-tiles__tile absolute top-1/2 left-1/2 m-0 overflow-hidden rounded-lg"
              style={{
                width: tileWidth,
                height: tileHeight,
                zIndex: 1000 + Math.round(tile.z),
                opacity: 1 - dimming * back,
                filter: softness > 0.2 ? `blur(${softness.toFixed(1)}px)` : undefined,
                transform: `translate(-50%, -50%) translate3d(${tile.x.toFixed(1)}px, ${tile.y.toFixed(1)}px, 0) scale(${tile.scale.toFixed(3)})`,
                willChange: 'transform',
              }}
            >
              <img
                src={item.image}
                alt={item.alt ?? ''}
                draggable={false}
                className="uig-orbit-tiles__image block h-full w-full object-cover"
              />
            </figure>
          )
        })}
      </div>
    </div>
  )
}
