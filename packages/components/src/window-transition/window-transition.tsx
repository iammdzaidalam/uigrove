'use client'

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { windowKeyframes, type WindowEasing, type WindowOrigin } from './window-transition.engine'

export interface WindowTransitionOptions {
  duration: number
  easing: WindowEasing
  windowSize: number
  radius: number
  dim: number
  shrink: number
  zoom: number
  origin: WindowOrigin
}

export interface WindowTransitionProps extends Partial<WindowTransitionOptions> {
  transitionKey: string
  children: ReactNode
  onComplete?: (key: string) => void
  className?: string
  style?: CSSProperties
}

export const windowTransitionDefaults: WindowTransitionOptions = {
  duration: 1100,
  easing: 'expo',
  windowSize: 320,
  radius: 16,
  dim: 0.35,
  shrink: 0.04,
  zoom: 1.12,
  origin: 'bottom',
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

interface Layer {
  key: string
  node: ReactNode
}

interface Layers {
  current: Layer
  previous: Layer | null
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

export function WindowTransition({
  transitionKey,
  children,
  duration = windowTransitionDefaults.duration,
  easing = windowTransitionDefaults.easing,
  windowSize = windowTransitionDefaults.windowSize,
  radius = windowTransitionDefaults.radius,
  dim = windowTransitionDefaults.dim,
  shrink = windowTransitionDefaults.shrink,
  zoom = windowTransitionDefaults.zoom,
  origin = windowTransitionDefaults.origin,
  onComplete,
  className,
  style,
}: WindowTransitionProps) {
  const reduced = useReducedMotion()
  const [layers, setLayers] = useState<Layers>(() => ({
    current: { key: transitionKey, node: children },
    previous: null,
  }))
  // A new key freezes the old page behind
  if (layers.current.key !== transitionKey) {
    setLayers({ current: { key: transitionKey, node: children }, previous: layers.current })
  } else if (layers.current.node !== children) {
    setLayers({ current: { key: transitionKey, node: children }, previous: layers.previous })
  }
  const rootRef = useRef<HTMLDivElement>(null)
  const frontRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const completeRef = useRef(onComplete)

  useEffect(() => {
    completeRef.current = onComplete
  }, [onComplete])

  const previousKey = layers.previous?.key ?? null
  const currentKey = layers.current.key

  useEffect(() => {
    if (previousKey === null) return
    const root = rootRef.current
    const front = frontRef.current
    const content = contentRef.current
    const back = backRef.current
    if (!root || !front || !content || !back) return
    const rect = root.getBoundingClientRect()
    const frames = windowKeyframes({
      width: rect.width,
      height: rect.height,
      windowSize,
      radius,
      origin,
      zoom,
      dim,
      shrink,
      easing,
    })
    const timing: KeyframeAnimationOptions = { duration: reduced ? 0 : duration, fill: 'forwards' }
    const animations = [
      front.animate(frames.window, timing),
      content.animate(frames.content, timing),
      back.animate(frames.back, timing),
    ]
    let done = false
    const finish = () => {
      if (done) return
      done = true
      for (const animation of animations) animation.cancel()
      setLayers((state) =>
        state.previous?.key === previousKey ? { ...state, previous: null } : state,
      )
      completeRef.current?.(currentKey)
    }
    animations[0]?.finished.then(finish).catch(() => {})
    return () => {
      done = true
      for (const animation of animations) animation.cancel()
    }
  }, [
    previousKey,
    currentKey,
    reduced,
    duration,
    easing,
    windowSize,
    radius,
    origin,
    zoom,
    dim,
    shrink,
  ])

  return (
    <div
      ref={rootRef}
      className={['uig-window-transition', 'overflow-hidden', className].filter(Boolean).join(' ')}
      style={style}
    >
      {layers.previous && (
        <div
          key={layers.previous.key}
          ref={backRef}
          aria-hidden="true"
          inert
          className="uig-window-transition__back absolute inset-0 overflow-hidden"
        >
          {layers.previous.node}
        </div>
      )}
      <div
        key={layers.current.key}
        ref={frontRef}
        className="uig-window-transition__front relative h-full w-full"
      >
        <div ref={contentRef} className="uig-window-transition__content h-full w-full">
          {layers.current.node}
        </div>
      </div>
    </div>
  )
}
