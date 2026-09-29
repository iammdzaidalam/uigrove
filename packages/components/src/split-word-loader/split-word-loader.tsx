'use client'

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { SplitWordLoaderEngine, splitWordLoaderTiming } from './split-word-loader.engine'

export interface SplitWordLoaderOptions {
  word: string
  splitAt: number
  durationScale: number
  progress: number
  playKey: number
  background: string
  color: string
  fontSize: number
  fontWeight: number
  letterSpacing: number
  fontFamily: string
  imageRatio: number
  fixed: boolean
  label: string
}

export interface SplitWordLoaderProps extends Partial<SplitWordLoaderOptions> {
  images?: string[]
  onComplete?: () => void
  className?: string
  style?: CSSProperties
  children?: ReactNode
}

export const splitWordLoaderDefaults: SplitWordLoaderOptions = {
  word: 'GROVE',
  splitAt: 0,
  durationScale: 1,
  progress: 1,
  playKey: 0,
  background: '#e7e7e7',
  color: '#1c1a1b',
  fontSize: 14,
  fontWeight: 500,
  letterSpacing: -0.03,
  fontFamily: 'inherit',
  imageRatio: 1.41,
  fixed: false,
  label: 'Loading',
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const MAX_DT = 0.1
const EDGE = '-9999px'

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

function splitWord(word: string, splitAt: number) {
  const letters = Array.from(word)
  const auto = Math.floor(letters.length / 2)
  const at = splitAt > 0 ? Math.min(Math.round(splitAt), letters.length) : auto
  return { letters, left: letters.slice(0, at), right: letters.slice(at) }
}

const EMPTY: string[] = []

export function SplitWordLoader({
  word = splitWordLoaderDefaults.word,
  splitAt = splitWordLoaderDefaults.splitAt,
  durationScale = splitWordLoaderDefaults.durationScale,
  progress = splitWordLoaderDefaults.progress,
  playKey = splitWordLoaderDefaults.playKey,
  background = splitWordLoaderDefaults.background,
  color = splitWordLoaderDefaults.color,
  fontSize = splitWordLoaderDefaults.fontSize,
  fontWeight = splitWordLoaderDefaults.fontWeight,
  letterSpacing = splitWordLoaderDefaults.letterSpacing,
  fontFamily = splitWordLoaderDefaults.fontFamily,
  imageRatio = splitWordLoaderDefaults.imageRatio,
  fixed = splitWordLoaderDefaults.fixed,
  label = splitWordLoaderDefaults.label,
  images = EMPTY,
  onComplete,
  className,
  style,
  children,
}: SplitWordLoaderProps) {
  const reduced = useReducedMotion()
  const [run, setRun] = useState({ key: playKey, stage: 0, percent: 0 })
  // A new play key restarts the loader from the top
  if (run.key !== playKey) setRun({ key: playKey, stage: 0, percent: 0 })
  const stage = run.key === playKey ? run.stage : 0

  const overlayRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLSpanElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(progress)
  const completeRef = useRef(onComplete)
  const measureRef = useRef(true)

  useEffect(() => {
    progressRef.current = progress
    completeRef.current = onComplete
  }, [progress, onComplete])

  const { letters, left, right } = splitWord(word, splitAt)
  const letterCount = letters.length
  const imageCount = images.length

  useEffect(() => {
    measureRef.current = true
  }, [word, splitAt, fontSize, fontWeight, letterSpacing, fontFamily])

  useEffect(() => {
    const overlay = overlayRef.current
    const row = rowRef.current
    const slot = slotRef.current
    const box = boxRef.current
    const groups = [leftRef.current, rightRef.current].filter(
      (group): group is HTMLDivElement => group !== null,
    )
    if (!overlay || !row || !slot || !box) return
    const glyphs = groups.flatMap((group) => Array.from(group.children) as HTMLElement[])
    const pictures = Array.from(box.children) as HTMLElement[]
    const engine = new SplitWordLoaderEngine({
      letters: letterCount,
      images: imageCount,
      durationScale,
      imageRatio,
      reduced,
    })
    const layout = { width: 0, height: 0, cap: 0 }
    let clipBottom = 0
    let raf = 0
    let last = 0
    let visible = true
    let stageNow = 0
    let percent = -1
    let shown = -2
    let drawn = -1

    const measure = () => {
      measureRef.current = false
      const frameRect = overlay.getBoundingClientRect()
      const rowRect = row.getBoundingClientRect()
      const slotRect = slot.getBoundingClientRect()
      const groupRect = (
        groups.find((group) => group.childElementCount > 0) ?? row
      ).getBoundingClientRect()
      layout.width = frameRect.width
      layout.height = frameRect.height
      layout.cap = slotRect.height
      clipBottom =
        groupRect.bottom - slotRect.bottom - layout.cap * splitWordLoaderTiming.clipOvershoot
      const slotCenter = slotRect.top - rowRect.top + slotRect.height / 2
      row.style.transform = `translate3d(0, ${rowRect.height / 2 - slotCenter}px, 0)`
      row.style.visibility = 'visible'
    }

    const apply = () => {
      // A held clock with an unchanged layout needs no writes
      if (engine.time === drawn && !measureRef.current) return false
      if (measureRef.current) measure()
      drawn = engine.time
      const frame = engine.frame(layout)
      frame.letters.forEach((offset, i) => {
        const glyph = glyphs[i]
        if (glyph) glyph.style.transform = `translate3d(0, ${offset}px, 0)`
      })
      const clip = frame.masked ? `inset(${EDGE} ${EDGE} ${clipBottom}px ${EDGE})` : 'none'
      for (const group of groups) group.style.clipPath = clip
      slot.style.width = `${frame.slot}px`
      if (frame.boxWidth < 0.5 || frame.boxHeight < 0.5) box.style.visibility = 'hidden'
      else {
        box.style.visibility = 'visible'
        box.style.width = `${frame.boxWidth}px`
        box.style.height = `${frame.boxHeight}px`
        box.style.left = `${(layout.width - frame.boxWidth) / 2}px`
        box.style.top = `${(layout.height - frame.boxHeight) / 2}px`
      }
      if (frame.image !== shown) {
        shown = frame.image
        pictures.forEach((picture, i) => {
          picture.style.opacity = i === shown ? '1' : '0'
        })
      }
      overlay.style.opacity = `${frame.opacity}`
      const loaded = Math.min(frame.progress, progressRef.current)
      const step = Math.floor(loaded * 4) * 25
      const next = frame.finished ? 2 : frame.revealed ? 1 : 0
      if (step !== percent || next !== stageNow) {
        percent = step
        if (next === 1 && stageNow === 0) completeRef.current?.()
        stageNow = next
        setRun((state) =>
          state.key === playKey ? { key: playKey, stage: next, percent: step } : state,
        )
      }
      return frame.finished
    }

    const tick = (now: number) => {
      raf = 0
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 0
      last = now
      engine.advance(dt, progressRef.current)
      if (!apply() && visible) raf = requestAnimationFrame(tick)
    }

    const start = () => {
      if (raf || engine.finished) return
      last = 0
      raf = requestAnimationFrame(tick)
    }

    const stop = () => {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }

    measureRef.current = true
    apply()
    start()

    const resize = new ResizeObserver(() => {
      measureRef.current = true
      if (!raf && !engine.finished) apply()
    })
    resize.observe(overlay)
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true
      if (visible) start()
      else stop()
    })
    intersection.observe(overlay)
    const onFonts = () => {
      measureRef.current = true
    }
    document.fonts?.addEventListener('loadingdone', onFonts)
    void document.fonts?.ready.then(onFonts)

    return () => {
      stop()
      resize.disconnect()
      intersection.disconnect()
      document.fonts?.removeEventListener('loadingdone', onFonts)
    }
  }, [playKey, reduced, letterCount, imageCount, durationScale, imageRatio])

  const state = stage === 0 ? 'loading' : stage === 1 ? 'revealing' : 'done'

  return (
    <div
      className={['uig-split-word-loader', 'isolate', className].filter(Boolean).join(' ')}
      style={style}
      data-state={state}
    >
      <div className="uig-split-word-loader__content" inert={stage === 0}>
        {children}
      </div>
      {stage < 2 && (
        <div
          key={playKey}
          ref={overlayRef}
          role="status"
          className="uig-split-word-loader__overlay inset-0 z-10 flex items-center justify-center overflow-hidden [container-type:size]"
          style={{
            position: fixed ? 'fixed' : 'absolute',
            background,
            color,
            pointerEvents: stage === 1 ? 'none' : undefined,
          }}
        >
          <span className="uig-split-word-loader__status sr-only">{`${label} ${run.percent}%`}</span>
          <div
            ref={rowRef}
            aria-hidden="true"
            className="uig-split-word-loader__row invisible flex w-full shrink-0 items-baseline whitespace-pre"
            style={{
              fontFamily,
              fontWeight,
              fontSize: `${fontSize}cqw`,
              letterSpacing: `${letterSpacing}em`,
              lineHeight: 1,
            }}
          >
            <div
              ref={leftRef}
              className="uig-split-word-loader__left flex min-w-0 flex-1 items-baseline justify-end"
            >
              {left.map((letter, i) => (
                <span key={i} className="uig-split-word-loader__letter block will-change-transform">
                  {letter}
                </span>
              ))}
            </div>
            <span
              ref={slotRef}
              className="uig-split-word-loader__slot block h-[1cap] w-0 shrink-0"
            />
            <div
              ref={rightRef}
              className="uig-split-word-loader__right flex min-w-0 flex-1 items-baseline justify-start"
            >
              {right.map((letter, i) => (
                <span key={i} className="uig-split-word-loader__letter block will-change-transform">
                  {letter}
                </span>
              ))}
            </div>
          </div>
          <div
            ref={boxRef}
            aria-hidden="true"
            className="uig-split-word-loader__box invisible absolute top-0 left-0 overflow-hidden bg-current"
          >
            {images.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt=""
                decoding="async"
                draggable={false}
                className="uig-split-word-loader__image absolute inset-0 h-full w-full object-cover opacity-0"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
