'use client'

import { useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { MorphingTextEngine, type MorphingTextLayer } from './morphing-text.engine'

export type MorphingTextTag = 'div' | 'p' | 'h1' | 'h2' | 'h3' | 'span'
export type MorphingTextAlign = 'left' | 'center' | 'right'
export type MorphingTextVerticalAlign = 'top' | 'middle' | 'bottom'

export interface MorphingTextOptions {
  words: string[]
  morphDuration: number
  holdDuration: number
  blur: number
  maxBlur: number
  threshold: number
  softness: number
  fontSize: number
  fontWeight: number
  letterSpacing: number
  lineHeight: number
  color: string
  textAlign: MorphingTextAlign
  verticalAlign: MorphingTextVerticalAlign
  loop: boolean
  paused: boolean
  tag: MorphingTextTag
}

export interface MorphingTextProps extends Partial<MorphingTextOptions> {
  className?: string
  style?: CSSProperties
}

export const morphingTextDefaults: MorphingTextOptions = {
  words: ['Grow', 'Bloom', 'Grove'],
  morphDuration: 1.5,
  holdDuration: 0.3,
  blur: 8,
  maxBlur: 16,
  threshold: 140,
  softness: 0.6,
  fontSize: 100,
  fontWeight: 600,
  letterSpacing: -0.038,
  lineHeight: 1,
  color: '#ffffff',
  textAlign: 'center',
  verticalAlign: 'middle',
  loop: true,
  paused: false,
  tag: 'div',
}

const MAX_DT = 0.1
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const HIDDEN: MorphingTextLayer = { blur: 0, opacity: 0 }
const ALIGN_ITEMS = { top: 'start', middle: 'center', bottom: 'end' } as const

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

function writeLayer(el: HTMLElement, layer: MorphingTextLayer) {
  el.style.filter = layer.blur > 0 ? `blur(${layer.blur}px)` : 'none'
  el.style.opacity = String(layer.opacity)
}

export function MorphingText({
  words = morphingTextDefaults.words,
  morphDuration = morphingTextDefaults.morphDuration,
  holdDuration = morphingTextDefaults.holdDuration,
  blur = morphingTextDefaults.blur,
  maxBlur = morphingTextDefaults.maxBlur,
  threshold = morphingTextDefaults.threshold,
  softness = morphingTextDefaults.softness,
  fontSize = morphingTextDefaults.fontSize,
  fontWeight = morphingTextDefaults.fontWeight,
  letterSpacing = morphingTextDefaults.letterSpacing,
  lineHeight = morphingTextDefaults.lineHeight,
  color = morphingTextDefaults.color,
  textAlign = morphingTextDefaults.textAlign,
  verticalAlign = morphingTextDefaults.verticalAlign,
  loop = morphingTextDefaults.loop,
  paused = morphingTextDefaults.paused,
  tag = morphingTextDefaults.tag,
  className,
  style,
}: MorphingTextProps) {
  const filterId = useId()
  const reduced = useReducedMotion()
  const list = words.length > 0 ? words : ['']
  const count = list.length
  const wordsKey = list.join('\u0000')
  const [engine] = useState(
    () =>
      new MorphingTextEngine({
        count,
        morphDuration,
        holdDuration,
        blur,
        maxBlur,
        loop,
        paused,
        reduced,
      }),
  )
  const stageRef = useRef<HTMLSpanElement>(null)
  const wakeRef = useRef<() => void>(() => {})

  useEffect(() => {
    engine.setOptions({ morphDuration, holdDuration, blur, maxBlur, loop, paused })
    wakeRef.current()
  }, [engine, morphDuration, holdDuration, blur, maxBlur, loop, paused])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const els = Array.from(stage.querySelectorAll<HTMLElement>('[data-word]'))
    let visible = true
    let frame = 0
    let last = 0
    let shown = -1

    const apply = () => {
      const { current, next } = engine
      if (shown !== current) {
        els.forEach((el, i) => {
          if (i !== current && i !== next) writeLayer(el, HIDDEN)
        })
        shown = current
      }
      const incoming = els[next]
      const outgoing = els[current]
      if (incoming && next !== current) writeLayer(incoming, engine.incoming)
      if (outgoing) writeLayer(outgoing, engine.outgoing)
    }

    const loop = (now: number) => {
      frame = 0
      if (!visible) return
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 0
      last = now
      if (engine.tick(dt)) apply()
      if (!engine.idle) frame = requestAnimationFrame(loop)
      else last = 0
    }

    const start = () => {
      if (frame || !visible || document.hidden || engine.idle) return
      last = 0
      frame = requestAnimationFrame(loop)
    }

    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }

    engine.setOptions({ count, reduced })
    engine.reset()
    apply()
    wakeRef.current = () => {
      apply()
      start()
    }
    start()

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
  }, [engine, count, reduced, wordsKey])

  const Tag = tag
  const rootStyle: CSSProperties = {
    fontSize,
    fontWeight,
    letterSpacing: `${letterSpacing}em`,
    lineHeight,
    color,
    textAlign,
    ...style,
  }

  return (
    <Tag
      className={['uig-morphing-text', 'select-none', className].filter(Boolean).join(' ')}
      style={rootStyle}
    >
      <span className="uig-morphing-text__label sr-only">{list.join(', ')}</span>
      {reduced ? null : (
        <svg className="uig-morphing-text__defs absolute size-0" aria-hidden="true">
          <defs>
            <filter id={filterId} x="-20%" y="-50%" width="140%" height="200%">
              <feColorMatrix
                in="SourceGraphic"
                type="matrix"
                values={`1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 255 ${-threshold}`}
              />
            </filter>
          </defs>
        </svg>
      )}
      <span
        ref={stageRef}
        className="uig-morphing-text__stage grid"
        style={{
          alignItems: ALIGN_ITEMS[verticalAlign],
          filter: reduced ? undefined : `url(#${filterId}) blur(${softness}px)`,
        }}
        aria-hidden="true"
      >
        {list.map((word, i) => (
          <span
            key={i}
            data-word=""
            className="uig-morphing-text__word col-start-1 row-start-1 whitespace-pre-wrap wrap-break-word"
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            {word}
          </span>
        ))}
      </span>
    </Tag>
  )
}
