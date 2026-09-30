'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { DynamicIslandEngine, dynamicIslandSpring } from './dynamic-island.engine'

export interface DynamicIslandState {
  width: number
  height: number
  radius?: number
  bounce?: number
  label?: string
  content: ReactNode
}

export interface DynamicIslandOptions {
  bounce: number
  duration: number
  radius: number
  background: string
}

export interface DynamicIslandProps extends Partial<DynamicIslandOptions> {
  states: Record<string, DynamicIslandState>
  state?: string
  defaultState?: string
  onStateChange?: (state: string) => void
  className?: string
  style?: CSSProperties
}

export interface DynamicIslandContextValue {
  state: string
  setState: (state: string) => void
}

export const dynamicIslandDefaults: DynamicIslandOptions = {
  bounce: 0.2,
  duration: 800,
  radius: 32,
  background: '#000000',
}

interface Layer {
  id: number
  key: string
  shown: boolean
}

const MAX_DT = 1 / 30
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const DynamicIslandContext = createContext<DynamicIslandContextValue | null>(null)

export function useDynamicIsland() {
  const context = useContext(DynamicIslandContext)
  if (!context) throw new Error('useDynamicIsland must be used inside a DynamicIsland')
  return context
}

function subscribeMotion(onChange: () => void) {
  const list = window.matchMedia(MOTION_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function useReducedMotion() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  )
}

const hasState = (states: Record<string, DynamicIslandState>, key: string) =>
  Object.hasOwn(states, key)

export function DynamicIsland({
  states,
  state,
  defaultState,
  onStateChange,
  bounce = dynamicIslandDefaults.bounce,
  duration = dynamicIslandDefaults.duration,
  radius = dynamicIslandDefaults.radius,
  background = dynamicIslandDefaults.background,
  className,
  style,
}: DynamicIslandProps) {
  const reduced = useReducedMotion()
  const first = Object.keys(states)[0] ?? ''
  const [internal, setInternal] = useState(() =>
    defaultState !== undefined && hasState(states, defaultState) ? defaultState : first,
  )
  const controlled = state !== undefined && hasState(states, state)
  const current = controlled ? state : hasState(states, internal) ? internal : first
  const target = states[current]
  const width = target?.width ?? 0
  const height = target?.height ?? 0
  const corner = target?.radius ?? radius
  const springBounce = target?.bounce ?? bounce

  const [initial] = useState(() => ({ width, height, radius: corner }))
  const [engine] = useState(() => {
    const created = new DynamicIslandEngine(initial)
    created.show(0, false)
    return created
  })
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, key: current, shown: true }])
  const newest = layers[layers.length - 1]
  if (newest && newest.key !== current) {
    setLayers([{ id: newest.id + 1, key: current, shown: reduced }])
  }
  const newestId = newest?.id ?? 0

  const rootRef = useRef<HTMLDivElement>(null)
  const layerEls = useRef(new Map<number, HTMLDivElement>())
  const statesRef = useRef(states)
  const layersRef = useRef(layers)
  const reducedRef = useRef(reduced)
  const wakeRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    statesRef.current = states
    layersRef.current = layers
    reducedRef.current = reduced
  })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let frame = 0
    let last = 0
    let visible = true

    const apply = () => {
      const box = engine.box
      root.style.width = `${box.width}px`
      root.style.height = `${box.height}px`
      root.style.borderRadius = `${box.radius}px`
      for (const layer of layersRef.current) {
        const el = layerEls.current.get(layer.id)
        const size = statesRef.current[layer.key]
        if (!el || !size) continue
        const f = engine.frame(layer.id)
        const sx = size.width > 0 ? (box.width / size.width) * f.scale : f.scale
        const sy = size.height > 0 ? (box.height / size.height) * f.scale : f.scale
        el.style.opacity = String(f.opacity)
        el.style.filter = f.blur > 0.01 ? `blur(${f.blur}px)` : ''
        el.style.transform = `translate(-50%, -50%) scale(${sx}, ${sy})`
      }
    }

    const loop = (now: number) => {
      frame = 0
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 0
      last = now
      engine.tick(dt)
      apply()
      if (!engine.idle && visible) frame = requestAnimationFrame(loop)
      else last = 0
    }

    wakeRef.current = () => {
      if (!visible || reducedRef.current) {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        last = 0
        engine.finish()
        apply()
      } else if (!frame && !engine.idle) {
        frame = requestAnimationFrame(loop)
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      wakeRef.current()
    })
    observer.observe(root)
    wakeRef.current()

    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
      wakeRef.current = () => {}
    }
  }, [engine])

  useLayoutEffect(() => {
    if (!engine.visibleLayers().includes(newestId)) engine.show(newestId, !reduced)
    const box = { width, height, radius: corner }
    if (reduced) engine.jump(box)
    else engine.setTarget(box, dynamicIslandSpring(springBounce, duration))
    wakeRef.current()
  }, [engine, newestId, width, height, corner, springBounce, duration, reduced])

  const setState = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next)
      onStateChange?.(next)
    },
    [controlled, onStateChange],
  )
  const context = useMemo(() => ({ state: current, setState }), [current, setState])

  return (
    <div
      ref={rootRef}
      className={['uig-dynamic-island', 'overflow-hidden contain-layout', className]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...style,
        width: initial.width,
        height: initial.height,
        borderRadius: initial.radius,
        background,
      }}
    >
      <span className="uig-dynamic-island__status sr-only" role="status" aria-live="polite">
        {target?.label ?? current}
      </span>
      <DynamicIslandContext value={context}>
        {layers.map((layer) => {
          const item = states[layer.key]
          return (
            <div
              key={layer.id}
              ref={(el) => {
                if (el) layerEls.current.set(layer.id, el)
                return () => {
                  layerEls.current.delete(layer.id)
                }
              }}
              className="uig-dynamic-island__layer absolute top-1/2 left-1/2"
              style={{
                width: item?.width,
                height: item?.height,
                opacity: layer.shown ? 1 : 0,
                transform: 'translate(-50%, -50%)',
              }}
            >
              {item?.content}
            </div>
          )
        })}
      </DynamicIslandContext>
    </div>
  )
}
