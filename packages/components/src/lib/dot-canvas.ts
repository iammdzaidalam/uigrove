'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type CanvasKind = '2d' | 'webgl'

export interface DotCanvasEngine<Ctx = CanvasRenderingContext2D> {
  resize(width: number, height: number, dpr: number): void
  setPointer(x: number, y: number, active: boolean): void
  tick(dt: number, now: number): void
  draw(ctx: Ctx): void
  drawStatic(ctx: Ctx): void
  idle: boolean
}

export interface UseDotCanvasOptions {
  pointer?: boolean
  maxDpr?: number
  kind?: CanvasKind
}

type AnyContext = CanvasRenderingContext2D | WebGLRenderingContext

const MAX_DT = 1 / 30

export function useDotCanvas<Ctx extends AnyContext = CanvasRenderingContext2D>(
  engine: DotCanvasEngine<Ctx>,
  options: UseDotCanvasOptions = {},
) {
  const { pointer = true, maxDpr = 2, kind = '2d' } = options
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const wakeRef = useRef<() => void>(() => {})

  const wake = useCallback(() => wakeRef.current(), [])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const ctx = (
      kind === 'webgl'
        ? canvas.getContext('webgl', { antialias: false, premultipliedAlpha: true })
        : canvas.getContext('2d')
    ) as Ctx | null
    if (!ctx) return
    const ctx2d = ctx instanceof CanvasRenderingContext2D ? ctx : null

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = motionQuery.matches
    let visible = true
    let frame = 0
    let last = 0
    let rect = container.getBoundingClientRect()
    let width = 0
    let height = 0
    setReducedMotion(reduced)

    const clear = () => ctx2d?.clearRect(0, 0, width, height)

    const drawStatic = () => {
      clear()
      engine.drawStatic(ctx)
    }

    const loop = (now: number) => {
      frame = 0
      if (!visible || reduced) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt, now)
      clear()
      engine.draw(ctx)
      if (!engine.idle) frame = requestAnimationFrame(loop)
      else last = 0
    }

    const start = () => {
      if (frame || !visible || reduced) return
      last = 0
      frame = requestAnimationFrame(loop)
    }

    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }

    wakeRef.current = () => {
      if (reduced) drawStatic()
      else if (!visible) {
        clear()
        engine.draw(ctx)
      } else start()
    }

    const resize = () => {
      rect = container.getBoundingClientRect()
      width = Math.round(rect.width)
      height = Math.round(rect.height)
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx2d?.setTransform(dpr, 0, 0, dpr, 0, 0)
      engine.resize(width, height, dpr)
      if (reduced) drawStatic()
      else {
        clear()
        engine.draw(ctx)
        start()
      }
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)

    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
      else stop()
    })
    intersection.observe(container)

    const onMotionChange = (e: MediaQueryListEvent) => {
      reduced = e.matches
      setReducedMotion(reduced)
      if (reduced) {
        stop()
        drawStatic()
      } else start()
    }
    motionQuery.addEventListener('change', onMotionChange)

    const onVisibility = () => {
      if (document.hidden) stop()
      else start()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const onScroll = () => {
      rect = container.getBoundingClientRect()
    }

    const onPointerMove = (e: PointerEvent) => {
      engine.setPointer(e.clientX - rect.left, e.clientY - rect.top, true)
      start()
    }
    const onPointerLeave = () => {
      engine.setPointer(0, 0, false)
      start()
    }

    if (pointer) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      window.addEventListener('pointerdown', onPointerMove, { passive: true })
      document.addEventListener('pointerleave', onPointerLeave)
      window.addEventListener('blur', onPointerLeave)
      window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    }

    return () => {
      stop()
      resizeObserver.disconnect()
      intersection.disconnect()
      motionQuery.removeEventListener('change', onMotionChange)
      document.removeEventListener('visibilitychange', onVisibility)
      if (pointer) {
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerdown', onPointerMove)
        document.removeEventListener('pointerleave', onPointerLeave)
        window.removeEventListener('blur', onPointerLeave)
        window.removeEventListener('scroll', onScroll, { capture: true })
      }
      wakeRef.current = () => {}
    }
  }, [engine, pointer, maxDpr, kind])

  return { containerRef, canvasRef, reducedMotion, wake }
}
