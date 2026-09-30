'use client'

import { useEffect, useRef } from 'react'
import { ComponentPreview, type ComponentPreviewProps } from './previews/registry'

type Path = (t: number) => readonly [number, number]

interface Scroll {
  travel: number
  hold: number
  step?: number
  range?: number
}

interface Tour {
  selector: string
  glide: number
  dwell: number
}

interface Wheel {
  axis: 'x' | 'y'
  delta: number
  every: number
  flip: number
  frames: number
  selector?: string
}

interface Typing {
  text: string
  key: number
  before: number
  after: number
  rest: number
}

interface Nudge {
  selector: string
  keys: readonly [string, string]
  steps: number
  gap: number
  rest: number
}

interface Script {
  path?: Path
  canvas?: boolean
  tour?: Tour
  scroll?: Scroll
  wheel?: Wheel
  click?: { selector: string; every: number }
  type?: Typing
  nudge?: Nudge
}

const POINTER_STEP = 1000 / 30
const CANVAS_TURN = 8000
const REAL_POINTER_QUIET = 2000
const RESUME_AFTER = 1200
const SCROLLER_RETRY = 1000
const MAX_STEP = 50
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const GHOST_TYPES = [
  'pointermove',
  'mousemove',
  'pointerover',
  'pointerout',
  'mouseover',
  'mouseout',
  'wheel',
  'keydown',
] as const

const ease = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)))
const wander: Path = (t) => [0.5 + 0.32 * Math.sin(t * 0.3), 0.45 + 0.26 * Math.sin(t * 0.47 + 1.3)]
// Eased back and forth, slowing down near both edges
const swing = (t: number, seconds: number) =>
  0.08 + 0.84 * ease(0.5 - 0.5 * Math.cos((2 * Math.PI * t) / seconds))
const sweepX =
  (seconds: number): Path =>
  (t) => [swing(t, seconds), 0.45 + 0.05 * Math.sin(t * 0.6)]
const orbit: Path = (t) => [0.5 + 0.3 * Math.sin(t * 0.38), 0.5 + 0.1 * Math.sin(t * 0.7)]

// How each card plays itself when nobody is touching it
const scripts: Partial<Record<string, Script>> = {
  'dot-grid': { path: wander, canvas: true },
  'dithered-logo': { path: wander, canvas: true },
  'dot-matrix-text': { path: sweepX(16), canvas: true },
  'vector-wordmark': { path: sweepX(18), canvas: true },
  'ink-bleed': { path: wander },
  'goo-carve-button': { path: orbit },
  'expand-on-hover': {
    tour: { selector: '.uig-expand-on-hover__item', glide: 900, dwell: 1800 },
  },
  'expand-on-hover-vertical': {
    tour: { selector: '.uig-expand-on-hover-vertical__item', glide: 900, dwell: 1800 },
  },
  'spine-gallery': { tour: { selector: '.uig-spine-gallery__item', glide: 900, dwell: 1600 } },
  'scroll-surf': {
    path: wander,
    scroll: { step: 600, range: 3000, travel: 1800, hold: 1400 },
  },
  'image-reveal': { scroll: { step: 1600, range: 6400, travel: 2600, hold: 1600 } },
  'scene-reveal': { scroll: { travel: 6500, hold: 2200 } },
  'dust-transition': { scroll: { travel: 6500, hold: 2200 } },
  'pill-nav': { scroll: { travel: 5500, hold: 2000 } },
  'wheel-carousel': { wheel: { axis: 'y', delta: 120, every: 3400, flip: 4, frames: 8 } },
  'lens-carousel': {
    wheel: {
      axis: 'x',
      delta: 0.4,
      every: 4200,
      flip: 0,
      frames: 18,
      selector: '[role="listbox"]',
    },
  },
  'dynamic-island': { click: { selector: '[role="group"] button', every: 4800 } },
  'window-transition': { click: { selector: 'button', every: 5200 } },
  'split-word-loader': { click: { selector: 'button', every: 11000 } },
  'devouring-sign-in': {
    type: { text: 'hello@uigrove.me', key: 120, before: 1400, after: 4200, rest: 1000 },
  },
  'gooey-effect': {
    nudge: {
      selector: '[aria-label="Circle"]',
      keys: ['ArrowUp', 'ArrowDown'],
      steps: 5,
      gap: 90,
      rest: 2800,
    },
  },
}

const demoValues: Partial<Record<string, Record<string, unknown>>> = {
  'image-wheel-3d': { mode: 'animate' },
}

const ghosts = new WeakSet<Event>()
const pilots = new Set<Pilot>()
let frame = 0
let realMoveAt = -Infinity
let installed = false

function reducedMotion() {
  return window.matchMedia(MOTION_QUERY).matches
}

function fire(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  related: Element | null = null,
) {
  const init = {
    bubbles: true,
    cancelable: true,
    composed: true,
    clientX: x,
    clientY: y,
    relatedTarget: related,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    view: window,
  }
  const event = type.startsWith('pointer')
    ? new PointerEvent(type, init)
    : new MouseEvent(type, init)
  ghosts.add(event)
  target.dispatchEvent(event)
}

function setInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function findScroller(root: HTMLElement) {
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    if (el.scrollHeight <= el.clientHeight + 4) continue
    if (/auto|scroll/.test(getComputedStyle(el).overflowY)) return el
  }
  return null
}

function loop(now: number) {
  frame = 0
  if (document.hidden || reducedMotion()) return
  const active = [...pilots].filter((p) => p.running)
  if (active.length === 0) return
  // Canvas cards share window listeners, so one ghost visits them in turn
  const canvases = active.filter((p) => p.canvas)
  const owner = canvases[Math.floor(now / CANVAS_TURN) % Math.max(1, canvases.length)]
  for (const pilot of active) pilot.tick(now, pilot === owner)
  frame = requestAnimationFrame(loop)
}

function wake() {
  if (frame || document.hidden || reducedMotion()) return
  if ([...pilots].some((p) => p.running)) frame = requestAnimationFrame(loop)
}

function install() {
  if (installed) return
  installed = true
  // Ghost events reach React at the document but never the window listeners
  const stop = (e: Event) => {
    if (ghosts.has(e)) e.stopPropagation()
  }
  for (const type of GHOST_TYPES) document.addEventListener(type, stop)
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.isTrusted) realMoveAt = performance.now()
    },
    { capture: true, passive: true },
  )
  document.addEventListener('visibilitychange', wake)
  window.matchMedia(MOTION_QUERY).addEventListener('change', wake)
}

class Pilot {
  running = false
  readonly canvas: boolean
  private visible = false
  private held = false
  private resumeAt = 0
  private lastTick = 0
  private clock = 0
  private lastPointer = -Infinity
  private hovered: Element | null = null
  private scroller: HTMLElement | null = null
  private scrollerSearch = -Infinity
  private nextAt = 0
  private step = 0
  private framesLeft = 0
  private frameDelta = 0
  private typed = 0
  private phase: 'type' | 'hold' | 'wait' | 'rest' = 'rest'
  private stop = -1
  private stopDir = 1
  private stopAt = -Infinity
  private from: readonly [number, number] = [0, 0]
  private to: readonly [number, number] = [0, 0]

  constructor(
    private root: HTMLElement,
    private script: Script,
  ) {
    this.canvas = Boolean(script.canvas)
  }

  setVisible(visible: boolean) {
    this.visible = visible
    this.update()
  }

  hold() {
    this.held = true
    this.update()
  }

  release() {
    this.held = false
    this.resumeAt = performance.now() + RESUME_AFTER
    this.update()
  }

  dispose() {
    this.visible = false
    this.update()
  }

  // The clock only runs while playing, so pauses never skip ahead
  tick(now: number, canvasOwner: boolean) {
    if (now < this.resumeAt) {
      this.lastTick = 0
      return
    }
    this.clock += this.lastTick ? Math.min(now - this.lastTick, MAX_STEP) : 0
    this.lastTick = now
    const clock = this.clock
    const box = this.root.getBoundingClientRect()
    const { path, tour, scroll, wheel, click, type, nudge } = this.script

    if (path && clock - this.lastPointer >= POINTER_STEP) {
      this.lastPointer = clock
      const [fx, fy] = path(clock / 1000)
      const x = box.left + fx * box.width
      const y = box.top + fy * box.height
      if (!this.canvas) this.point(x, y)
      else if (canvasOwner && now - realMoveAt > REAL_POINTER_QUIET) {
        fire(window, 'pointermove', x, y)
      }
    }
    if (tour) this.tour(clock, box, tour)
    if (scroll) this.scroll(clock, scroll)
    if (this.framesLeft > 0) this.spin(box)
    if (clock < this.nextAt) return
    if (wheel) this.wheel(clock, box, wheel)
    else if (click) this.click(clock, click)
    else if (type) this.type(clock, type)
    else if (nudge) this.nudge(clock, nudge)
  }

  private update() {
    const running = this.visible && !this.held
    if (!running) {
      this.leave()
      this.lastTick = 0
    }
    this.running = running
    wake()
  }

  private point(x: number, y: number) {
    const hit = document.elementFromPoint(x, y)
    const target = hit && this.root.contains(hit) ? hit : null
    if (target !== this.hovered) {
      if (this.hovered) {
        fire(this.hovered, 'pointerout', x, y, target)
        fire(this.hovered, 'mouseout', x, y, target)
      }
      if (target) {
        fire(target, 'pointerover', x, y, this.hovered)
        fire(target, 'mouseover', x, y, this.hovered)
      }
      this.hovered = target
    }
    if (!target) return
    fire(target, 'pointermove', x, y)
    fire(target, 'mousemove', x, y)
  }

  private leave() {
    const last = this.hovered
    if (!last) return
    this.hovered = null
    const box = last.getBoundingClientRect()
    fire(last, 'pointerout', box.left, box.top)
    fire(last, 'mouseout', box.left, box.top)
  }

  // Glides to each item in turn and rests there, then walks back
  private tour(clock: number, box: DOMRect, tour: Tour) {
    const items = this.root.querySelectorAll(tour.selector)
    if (items.length === 0) return
    if (clock - this.stopAt >= tour.glide + tour.dwell) {
      if (
        items.length > 1 &&
        (this.stop + this.stopDir < 0 || this.stop + this.stopDir >= items.length)
      ) {
        this.stopDir *= -1
      }
      this.stop = Math.min(items.length - 1, Math.max(0, this.stop + this.stopDir))
      const r = items[this.stop]?.getBoundingClientRect()
      if (!r) return
      this.from =
        this.stopAt === -Infinity ? [r.left - box.left + r.width / 2, box.height * 0.45] : this.to
      this.to = [r.left - box.left + r.width / 2, r.top - box.top + r.height * 0.45]
      this.stopAt = clock
    }
    const k = ease((clock - this.stopAt) / tour.glide)
    const x = this.from[0] + (this.to[0] - this.from[0]) * k
    const y = this.from[1] + (this.to[1] - this.from[1]) * k
    this.point(box.left + x, box.top + y)
  }

  // Eased moves between stops with a rest at each one
  private scroll(clock: number, scroll: Scroll) {
    if (!this.scroller && clock - this.scrollerSearch > SCROLLER_RETRY) {
      this.scrollerSearch = clock
      this.scroller = findScroller(this.root)
    }
    const scroller = this.scroller
    if (!scroller) return
    const max = Math.min(scroller.scrollHeight - scroller.clientHeight, scroll.range ?? Infinity)
    if (max <= 0) return
    const size = scroll.step ?? max
    const moves = Math.max(1, Math.ceil(max / size - 0.01))
    const segment = scroll.travel + scroll.hold
    const local = clock % (segment * moves * 2)
    const index = Math.floor(local / segment)
    const k = ease((local - index * segment) / scroll.travel)
    const forward = index < moves
    const from = forward ? index : moves * 2 - index
    const to = forward ? index + 1 : from - 1
    const at = (stop: number) => Math.min(max, stop * size)
    scroller.scrollTop = at(from) + (at(to) - at(from)) * k
  }

  // Deltas under 1 are a share of the card width
  private wheel(clock: number, box: DOMRect, wheel: Wheel) {
    this.nextAt = clock + wheel.every
    const direction = wheel.flip && Math.floor(this.step / wheel.flip) % 2 ? -1 : 1
    this.step++
    const size = wheel.delta < 1 ? wheel.delta * box.width : wheel.delta
    this.framesLeft = wheel.frames
    this.frameDelta = (size * direction) / wheel.frames
    this.spin(box)
  }

  private spin(card: DOMRect) {
    const wheel = this.script.wheel
    this.framesLeft--
    if (!wheel) return
    const named = wheel.selector ? this.root.querySelector(wheel.selector) : null
    const box = named?.getBoundingClientRect() ?? card
    const x = box.left + box.width / 2
    const y = box.top + box.height / 2
    const hit = named ?? document.elementFromPoint(x, y)
    if (!hit || !this.root.contains(hit)) return
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      deltaMode: 0,
      deltaX: wheel.axis === 'x' ? this.frameDelta : 0,
      deltaY: wheel.axis === 'y' ? this.frameDelta : 0,
    })
    ghosts.add(event)
    hit.dispatchEvent(event)
  }

  private click(clock: number, click: NonNullable<Script['click']>) {
    const first = this.nextAt === 0
    this.nextAt = clock + click.every
    if (first) return
    const buttons = this.root.querySelectorAll<HTMLElement>(click.selector)
    // Skips the first button, which is the state the card starts in
    buttons[++this.step % Math.max(1, buttons.length)]?.click()
  }

  private type(clock: number, typing: Typing) {
    const input = this.root.querySelector('input')
    if (!input) return
    if (this.phase === 'rest') {
      this.typed = 0
      setInputValue(input, '')
      this.phase = 'type'
      this.nextAt = clock + typing.rest
    } else if (this.phase === 'type') {
      this.typed++
      setInputValue(input, typing.text.slice(0, this.typed))
      const done = this.typed >= typing.text.length
      if (done) this.phase = 'hold'
      this.nextAt = clock + (done ? typing.before : typing.key)
    } else if (this.phase === 'hold') {
      input.form?.requestSubmit()
      this.phase = 'wait'
      this.nextAt = clock + typing.after
    } else {
      this.phase = 'rest'
    }
  }

  private nudge(clock: number, nudge: Nudge) {
    const target = this.root.querySelector(nudge.selector)
    const key = nudge.keys[Math.floor(this.step / nudge.steps) % 2]
    if (!target || !key) return
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    ghosts.add(event)
    target.dispatchEvent(event)
    this.step++
    this.nextAt = clock + (this.step % nudge.steps === 0 ? nudge.rest : nudge.gap)
  }
}

export function DemoPreview({ slug, values }: ComponentPreviewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const extra = demoValues[slug]

  useEffect(() => {
    const root = ref.current
    const script = scripts[slug]
    if (!root || !script) return
    install()
    const pilot = new Pilot(root, script)
    pilots.add(pilot)
    const observer = new IntersectionObserver(([entry]) => {
      pilot.setVisible(entry?.isIntersecting ?? false)
    })
    observer.observe(root)
    const onEnter = (e: PointerEvent) => {
      if (e.isTrusted) pilot.hold()
    }
    const onLeave = (e: PointerEvent) => {
      if (e.isTrusted) pilot.release()
    }
    const onFocusIn = () => pilot.hold()
    const onFocusOut = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node && root.contains(e.relatedTarget))) pilot.release()
    }
    root.addEventListener('pointerenter', onEnter)
    root.addEventListener('pointerleave', onLeave)
    root.addEventListener('focusin', onFocusIn)
    root.addEventListener('focusout', onFocusOut)
    return () => {
      observer.disconnect()
      root.removeEventListener('pointerenter', onEnter)
      root.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('focusin', onFocusIn)
      root.removeEventListener('focusout', onFocusOut)
      pilot.dispose()
      pilots.delete(pilot)
    }
  }, [slug])

  return (
    <div ref={ref} className="absolute inset-0">
      <ComponentPreview slug={slug} values={extra ? { ...values, ...extra } : values} />
    </div>
  )
}
