'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { GooeyEffectEngine } from './gooey-effect.engine'

export interface GooeyEffectOptions {
  goo: number
  inertia: boolean
  friction: number
  bounds: boolean
}

export interface GooeyEffectProps extends Partial<GooeyEffectOptions> {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

export interface GooeyItemProps {
  label?: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

export const gooeyEffectDefaults: GooeyEffectOptions = {
  goo: 0.55,
  inertia: true,
  friction: 3.5,
  bounds: true,
}

interface GooeyContextValue {
  engine: GooeyEffectEngine
  stageRef: RefObject<HTMLDivElement | null>
  register(id: string, element: HTMLElement | null): void
  wake(): void
}

interface DragState {
  active: boolean
  x: number
  y: number
}

const MAX_DT = 1 / 30
const NUDGE = 10
const NUDGE_FAST = 40
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const GooeyContext = createContext<GooeyContextValue | null>(null)

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

export function GooeyEffect({
  goo = gooeyEffectDefaults.goo,
  inertia = gooeyEffectDefaults.inertia,
  friction = gooeyEffectDefaults.friction,
  bounds = gooeyEffectDefaults.bounds,
  children,
  className,
  style,
}: GooeyEffectProps) {
  const filterId = useId()
  const reduced = useReducedMotion()
  const engineRef = useRef<GooeyEffectEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new GooeyEffectEngine({ inertia, friction, bounds, instant: false })
  }
  const engine = engineRef.current
  const stageRef = useRef<HTMLDivElement>(null)
  const elementsRef = useRef(new Map<string, HTMLElement>())
  const wakeRef = useRef<() => void>(() => {})

  const wake = useCallback(() => wakeRef.current(), [])

  const register = useCallback((id: string, element: HTMLElement | null) => {
    if (element) elementsRef.current.set(id, element)
    else elementsRef.current.delete(id)
  }, [])

  const context = useMemo<GooeyContextValue>(
    () => ({ engine, stageRef, register, wake }),
    [engine, register, wake],
  )

  useEffect(() => {
    engine.setOptions({ inertia, friction, bounds, instant: reduced })
    wake()
  }, [engine, wake, inertia, friction, bounds, reduced])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let visible = true
    let frame = 0
    let last = 0

    const apply = () => {
      engine.forEach((id, x, y) => {
        const element = elementsRef.current.get(id)
        if (element) element.style.transform = `translate3d(${x}px, ${y}px, 0)`
      })
    }

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt)
      apply()
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

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
      else stop()
    })
    intersection.observe(stage)

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
  }, [engine])

  const blur = Math.max(0, goo) * 8

  return (
    <div
      className={['uig-gooey-effect', 'overflow-hidden', className].filter(Boolean).join(' ')}
      style={style}
    >
      <svg className="uig-gooey-effect__defs absolute size-0" aria-hidden="true">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -7"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <div
        ref={stageRef}
        className="uig-gooey-effect__stage relative h-full w-full"
        style={{ filter: goo > 0 ? `url(#${filterId})` : undefined }}
      >
        <GooeyContext.Provider value={context}>{children}</GooeyContext.Provider>
      </div>
    </div>
  )
}

export function GooeyItem({
  label = 'Draggable shape',
  children,
  className,
  style,
}: GooeyItemProps) {
  const context = useContext(GooeyContext)
  const id = useId()
  const ref = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState>({ active: false, x: 0, y: 0 })

  useEffect(() => {
    if (!context) return
    context.engine.add(id)
    context.register(id, ref.current)
    return () => {
      context.register(id, null)
      context.engine.remove(id)
    }
  }, [context, id])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!context || (e.pointerType === 'mouse' && e.button !== 0)) return
    // Native focus from the pointer keeps :focus-visible off during drags
    const element = e.currentTarget
    element.setPointerCapture(e.pointerId)
    const stage = context.stageRef.current
    if (stage) {
      // Bounds are offsets that keep this element inside the stage
      const position = context.engine.position(id)
      const outer = stage.getBoundingClientRect()
      const inner = element.getBoundingClientRect()
      context.engine.setBounds(id, {
        minX: position.x + outer.left - inner.left,
        maxX: position.x + outer.right - inner.right,
        minY: position.y + outer.top - inner.top,
        maxY: position.y + outer.bottom - inner.bottom,
      })
    }
    dragRef.current = { active: true, x: e.clientX, y: e.clientY }
    context.engine.dragStart(id)
    context.wake()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!context || !drag.active) return
    const dx = e.clientX - drag.x
    const dy = e.clientY - drag.y
    drag.x = e.clientX
    drag.y = e.clientY
    context.engine.dragMove(id, dx, dy)
    context.wake()
  }

  const finishDrag = () => {
    const drag = dragRef.current
    if (!context || !drag.active) return
    drag.active = false
    context.engine.dragEnd(id)
    context.wake()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!context) return
    const step = e.shiftKey ? NUDGE_FAST : NUDGE
    let dx = 0
    let dy = 0
    if (e.key === 'ArrowLeft') dx = -step
    else if (e.key === 'ArrowRight') dx = step
    else if (e.key === 'ArrowUp') dy = -step
    else if (e.key === 'ArrowDown') dy = step
    else return
    e.preventDefault()
    const stage = context.stageRef.current
    const element = e.currentTarget
    if (stage) {
      const position = context.engine.position(id)
      const outer = stage.getBoundingClientRect()
      const inner = element.getBoundingClientRect()
      context.engine.setBounds(id, {
        minX: position.x + outer.left - inner.left,
        maxX: position.x + outer.right - inner.right,
        minY: position.y + outer.top - inner.top,
        maxY: position.y + outer.bottom - inner.bottom,
      })
    }
    context.engine.nudge(id, dx, dy)
    context.wake()
  }

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={label}
      className={[
        'uig-gooey-effect__item',
        'cursor-grab touch-none select-none will-change-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current active:cursor-grabbing',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}

GooeyEffect.Item = GooeyItem
