'use client'

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from 'react'
import { DevouringSignInEngine } from './devouring-sign-in.engine'

export interface DevouringSignInOptions {
  placeholder: string
  label: string
  hint: string
  fontSize: number
  speed: number
}

export interface DevouringSignInProps extends Partial<DevouringSignInOptions> {
  onSubmit?: (email: string) => void
  onChange?: (value: string) => void
  className?: string
  style?: CSSProperties
}

export const devouringSignInDefaults: DevouringSignInOptions = {
  placeholder: 'you@example.com',
  label: 'Email address',
  hint: '[ enter ↵ ]',
  fontSize: 60,
  speed: 1,
}

const MAX_DT = 1 / 30
const FRONT_PX_PER_SECOND = 240
const RASTER_SCALE = 2
const PASSES_PER_FRAME = 2
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'

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

// Paints input text at double resolution where the input shows
function rasterize(input: HTMLInputElement, canvas: HTMLCanvasElement, text: string) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  const box = input.getBoundingClientRect()
  const host = canvas.getBoundingClientRect()
  canvas.width = Math.max(1, Math.round(host.width * RASTER_SCALE))
  canvas.height = Math.max(1, Math.round(host.height * RASTER_SCALE))
  const cs = getComputedStyle(input)
  ctx.setTransform(RASTER_SCALE, 0, 0, RASTER_SCALE, 0, 0)
  ctx.clearRect(0, 0, host.width, host.height)
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing
  ctx.fillStyle = cs.color
  ctx.textBaseline = 'alphabetic'
  const metrics = ctx.measureText(text)
  const ascent = metrics.fontBoundingBoxAscent ?? 0
  const descent = metrics.fontBoundingBoxDescent ?? 0
  const x = box.left - host.left + parseFloat(cs.paddingLeft)
  const middle = box.top - host.top + box.height / 2
  ctx.fillText(text, x, middle + (ascent - descent) / 2)
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return { ctx, pixels }
}

export function DevouringSignIn({
  placeholder = devouringSignInDefaults.placeholder,
  label = devouringSignInDefaults.label,
  hint = devouringSignInDefaults.hint,
  fontSize = devouringSignInDefaults.fontSize,
  speed = devouringSignInDefaults.speed,
  onSubmit,
  onChange,
  className,
  style,
}: DevouringSignInProps) {
  const reduced = useReducedMotion()
  const inputId = useId()
  const [value, setValue] = useState('')
  const [devouring, setDevouring] = useState(false)
  const [announce, setAnnounce] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const engineRef = useRef<DevouringSignInEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new DevouringSignInEngine({
      speed: FRONT_PX_PER_SECOND * RASTER_SCALE,
      passes: PASSES_PER_FRAME,
    })
  }
  const engine = engineRef.current
  const emailRef = useRef('')
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const reset = useCallback(() => {
    setValue('')
    setDevouring(false)
    setAnnounce(`Submitted ${emailRef.current}`)
    onChangeRef.current?.('')
  }, [])

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (devouring) return
    setValue(e.target.value)
    onChange?.(e.target.value)
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = value.trim()
    if (!email || devouring) return
    emailRef.current = email
    onSubmit?.(email)
    const input = inputRef.current
    const canvas = canvasRef.current
    const raster = reduced || !input || !canvas ? null : rasterize(input, canvas, value)
    if (!raster) {
      reset()
      return
    }
    engine.setOptions({ speed: FRONT_PX_PER_SECOND * RASTER_SCALE * speed })
    engine.load(raster.pixels)
    if (engine.done) {
      reset()
      return
    }
    ctxRef.current = raster.ctx
    setAnnounce('Submitting')
    setDevouring(true)
  }

  useEffect(() => {
    if (!devouring) return
    const ctx = ctxRef.current
    if (!ctx) return
    let frame = 0
    let last = 0
    let ended = false

    const end = () => {
      if (ended) return
      ended = true
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      engine.drawStatic(ctx)
      reset()
    }

    const loop = (now: number) => {
      frame = 0
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60
      last = now
      engine.tick(dt)
      engine.draw(ctx)
      if (engine.done) end()
      else frame = requestAnimationFrame(loop)
    }

    const onVisibility = () => {
      if (document.hidden) end()
    }
    document.addEventListener('visibilitychange', onVisibility)
    frame = requestAnimationFrame(loop)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [devouring, engine, reset])

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className={['uig-devouring-sign-in', 'relative w-full', className].filter(Boolean).join(' ')}
      style={style}
    >
      <label htmlFor={inputId} className="uig-devouring-sign-in__label sr-only">
        {label}
      </label>
      <div
        className="uig-devouring-sign-in__field w-full border-b border-current/10 pb-4 leading-none tracking-[-0.05em]"
        style={{ fontSize }}
      >
        <div className="uig-devouring-sign-in__row relative flex h-[1.2em] w-full items-center pr-2">
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            role="presentation"
            className="uig-devouring-sign-in__canvas pointer-events-none absolute inset-0 h-full w-full"
            style={{ opacity: devouring ? 1 : 0 }}
          />
          <input
            ref={inputRef}
            id={inputId}
            type="email"
            name="email"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={placeholder}
            value={value}
            onChange={handleChange}
            className="uig-devouring-sign-in__input relative h-full w-full min-w-0 flex-1 border-none bg-transparent pr-4 outline-none placeholder:opacity-50"
            style={{ color: devouring ? 'transparent' : undefined }}
          />
          <button
            type="submit"
            aria-label="Submit email"
            className="uig-devouring-sign-in__submit flex h-full shrink-0 cursor-pointer items-center justify-center pr-4 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
          >
            {value ? (
              <span className="uig-devouring-sign-in__hint pt-2 text-base tracking-tight opacity-50">
                {hint}
              </span>
            ) : (
              <span className="uig-devouring-sign-in__arrow">→</span>
            )}
          </button>
        </div>
      </div>
      <div className="uig-devouring-sign-in__live sr-only" aria-live="polite">
        {announce}
      </div>
    </form>
  )
}
