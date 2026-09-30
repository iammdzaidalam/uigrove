'use client'

import { useEffect, useRef } from 'react'
import { GooeyDotsEngine, gooeyDotsDefaults } from '@uigrove/components/gooey-dots'

type Mode = 'svg' | 'canvas-svg' | 'canvas-css' | 'field'

const BLUR = 12
const SLOPE = 24
const INTERCEPT = -11

export function GooeyLab({ mode, count }: { mode: Mode; count: number }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const width = root.clientWidth
    const height = root.clientHeight
    const engine = new GooeyDotsEngine({
      ...gooeyDotsDefaults,
      count,
      size: 14,
      speed: 2,
      wander: 120,
    })
    engine.resize(width, height)
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect()
      engine.setPointer(e.clientX - r.left, e.clientY - r.top, true)
    }
    window.addEventListener('pointermove', onMove)
    const renderer = createRenderer(mode, root, width, height)
    let frame = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      engine.tick(dt)
      renderer.draw(engine)
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      renderer.dispose()
    }
  }, [mode, count])

  return <div ref={rootRef} className="absolute inset-0" />
}

interface Renderer {
  draw(engine: GooeyDotsEngine): void
  dispose(): void
}

const gooFilter = (id: string) =>
  `<filter id="${id}" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${BLUR}"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${SLOPE} ${INTERCEPT}"/></filter>`

function createRenderer(mode: Mode, root: HTMLDivElement, width: number, height: number): Renderer {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const color = '#f5f5f7'
  const read = (engine: GooeyDotsEngine) => {
    const e = engine as unknown as { pos: Float32Array; radii: Float32Array; count: number }
    return e
  }

  if (mode === 'svg') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.innerHTML = `<defs>${gooFilter('lab-goo')}</defs><g filter="url(#lab-goo)" fill="${color}"></g>`
    root.appendChild(svg)
    const group = svg.querySelector('g')!
    const circles: SVGCircleElement[] = []
    return {
      draw(engine) {
        const { pos, radii, count } = read(engine)
        while (circles.length < count) {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          group.appendChild(c)
          circles.push(c)
        }
        for (let i = 0; i < count; i++) {
          const c = circles[i]!
          c.setAttribute('cx', pos[i * 2]!.toFixed(1))
          c.setAttribute('cy', pos[i * 2 + 1]!.toFixed(1))
          c.setAttribute('r', radii[i]!.toFixed(1))
        }
      },
      dispose: () => svg.remove(),
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  root.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  if (mode === 'canvas-svg' || mode === 'canvas-css') {
    let svg: SVGSVGElement | null = null
    if (mode === 'canvas-svg') {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')
      svg.style.position = 'absolute'
      svg.innerHTML = `<defs>${gooFilter('lab-goo-canvas')}</defs>`
      root.appendChild(svg)
      canvas.style.filter = 'url(#lab-goo-canvas)'
    } else {
      canvas.style.filter = `blur(${BLUR}px) contrast(${SLOPE})`
      canvas.style.background = '#000'
    }
    return {
      draw(engine) {
        ctx.clearRect(0, 0, width, height)
        ctx.fillStyle = color
        engine.draw(ctx)
      },
      dispose() {
        canvas.remove()
        svg?.remove()
      },
    }
  }

  const scale = 4
  const fw = Math.ceil(width / scale)
  const fh = Math.ceil(height / scale)
  const field = document.createElement('canvas')
  field.width = fw
  field.height = fh
  const fctx = field.getContext('2d')!
  const image = fctx.createImageData(fw, fh)
  const data = image.data
  ctx.imageSmoothingEnabled = true
  return {
    draw(engine) {
      const { pos, radii, count } = read(engine)
      data.fill(0)
      for (let py = 0; py < fh; py++) {
        const y = (py + 0.5) * scale
        for (let px = 0; px < fw; px++) {
          const x = (px + 0.5) * scale
          let sum = 0
          for (let i = 0; i < count; i++) {
            const dx = x - pos[i * 2]!
            const dy = y - pos[i * 2 + 1]!
            const r = radii[i]!
            sum += (r * r) / (dx * dx + dy * dy + 1)
            if (sum > 1.2) break
          }
          if (sum > 1.2) {
            const o = (py * fw + px) * 4
            data[o] = 245
            data[o + 1] = 245
            data[o + 2] = 247
            data[o + 3] = 255
          }
        }
      }
      fctx.putImageData(image, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(field, 0, 0, width, height)
    },
    dispose: () => canvas.remove(),
  }
}
