'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { sheet } from './sheet'
import { STRIDE, VortexEngine } from './vortex.engine'
import { VortexRenderer } from './vortex.gl'

const MAX_CARDS = 256
const MAX_DPR = 2
const MAX_DT = 1 / 20
// Roughly half a card, so edges never cross the text
const CLEAR_PAD = 64

export function Vortex({
  theme,
  clearRef,
  className,
}: {
  theme: 'dark' | 'light'
  clearRef?: RefObject<HTMLElement | null>
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [engine] = useState(() => new VortexEngine())
  const rendererRef = useRef<VortexRenderer | null>(null)
  const drawRef = useRef<() => void>(() => {})
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.decoding = 'async'
    img.src = sheet.src
    img
      .decode()
      .then(() => {
        if (!cancelled) setImage(img)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    renderer.setBorder(
      theme === 'light' ? [0, 0, 0, 0.12] : [1, 1, 1, 0.16],
      theme === 'light' ? 0 : 0.075,
    )
    if (image && !renderer.ready) renderer.setSheet(image)
    engine.setSpriteCount(image ? sheet.rows : 0)
    drawRef.current()
  }, [engine, image, theme])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    const renderer = new VortexRenderer(canvas)
    rendererRef.current = renderer
    const data = new Float32Array(MAX_CARDS * STRIDE)
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = motion.matches
    let visible = false
    let frame = 0
    let last = 0
    let time = 0

    const draw = () => renderer.draw(data, engine.layout(data), time)
    drawRef.current = () => {
      if (reduced || !frame) draw()
    }

    const loop = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 0
      last = now
      time += dt
      engine.tick(dt)
      draw()
      frame = requestAnimationFrame(loop)
    }
    const start = () => {
      if (frame || reduced || !visible) return
      last = 0
      frame = requestAnimationFrame(loop)
    }
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
    }
    const onLost = (e: Event) => {
      e.preventDefault()
      stop()
      renderer.lose()
    }
    const onRestored = () => {
      renderer.init()
      start()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const { width, height } = container.getBoundingClientRect()
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      engine.resize(width, height, dpr)
      const clear = clearRef?.current
      if (clear) {
        const box = clear.getBoundingClientRect()
        const outer = container.getBoundingClientRect()
        engine.setClear(box.width / 2 + CLEAR_PAD, box.height / 2 + CLEAR_PAD)
        engine.setOrigin((box.top + box.height / 2 - outer.top) / Math.max(1, outer.height))
      }
      draw()
    }
    const resizer = new ResizeObserver(resize)
    resizer.observe(container)
    if (clearRef?.current) resizer.observe(clearRef.current)
    resize()

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      if (visible) start()
      else stop()
    })
    observer.observe(container)

    let lastY = window.scrollY
    let lastT = performance.now()
    const onScroll = () => {
      const now = performance.now()
      engine.setScrollVelocity(((window.scrollY - lastY) / Math.max(8, now - lastT)) * 1000)
      lastY = window.scrollY
      lastT = now
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const onMotion = () => {
      reduced = motion.matches
      if (reduced) {
        stop()
        draw()
      } else start()
    }
    motion.addEventListener('change', onMotion)

    return () => {
      stop()
      resizer.disconnect()
      observer.disconnect()
      motion.removeEventListener('change', onMotion)
      window.removeEventListener('scroll', onScroll)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
      drawRef.current = () => {}
      rendererRef.current = null
    }
  }, [engine, clearRef])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={['pointer-events-none overflow-hidden', className].filter(Boolean).join(' ')}
    >
      <canvas
        ref={canvasRef}
        role="presentation"
        className="block h-full w-full transition-opacity duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{ opacity: image ? 1 : 0 }}
      />
    </div>
  )
}
