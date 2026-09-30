'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useDynamicIsland, type DynamicIslandState } from './dynamic-island'

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const RED = '#ff5a45'
const AMBER = '#ffb224'
const GREEN = '#34d15d'
const BLUE = '#3aa0ff'

function subscribeMotion(onChange: () => void) {
  const list = window.matchMedia(MOTION_QUERY)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function useCalm() {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  )
}

function useTick(ms: number, running = true) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((t) => t + 1), ms)
    return () => window.clearInterval(id)
  }, [ms, running])
  return tick
}

// Stable pseudo random level in [0, 1) per bar and tick
function noise(index: number, tick: number) {
  const x = Math.sin(index * 12.9898 + tick * 78.233) * 43758.5453
  return x - Math.floor(x)
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const longClock = (seconds: number) => clock(seconds).padStart(5, '0')

interface BarsProps {
  count: number
  width: number
  color: string
  max: number
  min?: number
  still?: boolean
}

function Bars({ count, width, color, max, min = 3, still = false }: BarsProps) {
  const calm = useCalm()
  const tick = useTick(110, !calm && !still)
  return (
    <div className="uig-dynamic-island__demo-bars flex h-[18px] items-center gap-0.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="uig-dynamic-island__demo-bar rounded-full transition-[height] duration-150 ease-out"
          style={{
            width,
            background: color,
            height: still ? min : min + (max - min) * (0.2 + 0.8 * noise(i, tick)),
          }}
        />
      ))}
    </div>
  )
}

function useWiggle<T extends Element>() {
  const ref = useRef<T>(null)
  const calm = useCalm()
  useEffect(() => {
    const el = ref.current
    if (!el || calm) return
    const turns = [0, 18, -14, 10, -7, 4, -2, 0]
    const animation = el.animate(
      turns.map((deg) => ({ transform: `rotate(${deg}deg)` })),
      { duration: 900, delay: 250, easing: 'ease-out' },
    )
    return () => animation.cancel()
  }, [calm])
  return ref
}

function BellIcon() {
  const ref = useWiggle<SVGSVGElement>()
  return (
    <svg
      ref={ref}
      width="12"
      height="13"
      viewBox="0 0 12 13"
      fill="none"
      aria-hidden="true"
      className="uig-dynamic-island__demo-bell origin-top"
    >
      <path
        d="M6 .75a3.6 3.6 0 0 0-3.6 3.6v2.1c0 .55-.2 1.1-.56 1.52l-.72.86c-.4.47-.07 1.17.55 1.17h8.66c.62 0 .95-.7.55-1.17l-.72-.86a2.37 2.37 0 0 1-.56-1.52v-2.1A3.6 3.6 0 0 0 6 .75Z"
        fill="currentColor"
      />
      <path d="M4.5 11.2a1.6 1.6 0 0 0 3 0" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

function PauseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3.5" y="2.5" width="3.2" height="11" rx="1" />
      <rect x="9.3" y="2.5" width="3.2" height="11" rx="1" />
    </svg>
  )
}

function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 3.1v9.8c0 .63.7 1.01 1.23.67l7.6-4.9a.8.8 0 0 0 0-1.34l-7.6-4.9a.8.8 0 0 0-1.23.67Z" />
    </svg>
  )
}

function SkipIcon({ back = false }: { back?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="currentColor"
      aria-hidden="true"
      style={back ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M2.5 6.3v9.4c0 .6.66.97 1.17.65l7.33-4.7a.77.77 0 0 0 0-1.3L3.67 5.65a.77.77 0 0 0-1.17.65Z" />
      <path d="M11 6.3v9.4c0 .6.66.97 1.17.65l7.33-4.7a.77.77 0 0 0 0-1.3l-7.33-4.7A.77.77 0 0 0 11 6.3Z" />
    </svg>
  )
}

function RingContent() {
  return (
    <div className="uig-dynamic-island__demo-ring flex h-full w-full items-center justify-between px-2.5 text-white">
      <BellIcon />
      <span className="uig-dynamic-island__demo-text text-xs font-medium">Ringer</span>
    </div>
  )
}

function TimerContent() {
  const { setState } = useDynamicIsland()
  const [paused, setPaused] = useState(false)
  const left = 480 - (useTick(1000, !paused) % 480)
  return (
    <div className="uig-dynamic-island__demo-timer flex h-full w-full items-center gap-2 pr-5 pl-3.5">
      <button
        type="button"
        aria-label={paused ? 'Resume timer' : 'Pause timer'}
        onClick={() => setPaused((p) => !p)}
        className="uig-dynamic-island__demo-round flex size-10 cursor-pointer items-center justify-center rounded-full bg-[#4a3206] text-[#ffb224] transition-colors hover:bg-[#5c3f09] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffb224]"
      >
        {paused ? <PlayIcon /> : <PauseIcon />}
      </button>
      <button
        type="button"
        aria-label="Stop timer"
        onClick={() => setState('idle')}
        className="uig-dynamic-island__demo-round flex size-10 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path
            d="M2.5 2.5l9 9m0-9-9 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <div
        className="uig-dynamic-island__demo-count ml-auto flex items-baseline gap-1.5"
        style={{ color: AMBER }}
      >
        <span className="uig-dynamic-island__demo-text text-sm leading-none font-medium">
          Pasta
        </span>
        <span className="uig-dynamic-island__demo-digits text-3xl leading-none tabular-nums">
          {clock(left)}
        </span>
      </div>
    </div>
  )
}

function RecordContent() {
  const seconds = useTick(1000)
  return (
    <div className="uig-dynamic-island__demo-record flex h-full w-full items-center justify-between px-2.5">
      <Bars count={16} width={3} color={RED} max={14} min={4} />
      <span
        className="uig-dynamic-island__demo-text text-xs font-medium tabular-nums"
        style={{ color: RED }}
      >
        {longClock(seconds)}
      </span>
    </div>
  )
}

function MusicContent() {
  const [paused, setPaused] = useState(false)
  const played = 42 + useTick(1000, !paused)
  const total = 214
  const at = Math.min(played, total)
  return (
    <div className="uig-dynamic-island__demo-music flex h-full w-full flex-col p-5 text-white">
      <div className="uig-dynamic-island__demo-track flex items-center gap-3">
        <img
          src="/demo/missed-calls.jpg"
          alt=""
          draggable={false}
          className="uig-dynamic-island__demo-cover size-14 shrink-0 rounded-2xl object-cover"
        />
        <div className="uig-dynamic-island__demo-titles min-w-0 flex-1">
          <p className="uig-dynamic-island__demo-title truncate text-base leading-5 font-medium">
            Missed Calls
          </p>
          <p className="uig-dynamic-island__demo-artist truncate text-base leading-5 text-white/55">
            Marlow Reed
          </p>
        </div>
        <Bars count={5} width={3} color={BLUE} max={14} min={4} still={paused} />
      </div>
      <div className="uig-dynamic-island__demo-progress mt-4 flex items-center gap-2 text-xs text-white/55 tabular-nums">
        <span>{clock(at)}</span>
        <div className="uig-dynamic-island__demo-rail relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
          <div
            className="uig-dynamic-island__demo-fill absolute inset-y-0 left-0 rounded-full bg-white/80"
            style={{ width: `${(at / total) * 100}%` }}
          />
        </div>
        <span>-{clock(total - at)}</span>
      </div>
      <div className="uig-dynamic-island__demo-controls mt-auto flex items-center justify-center gap-8 text-white/85">
        <button
          type="button"
          aria-label="Previous track"
          className="uig-dynamic-island__demo-skip flex cursor-pointer rounded-md transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <SkipIcon back />
        </button>
        <button
          type="button"
          aria-label={paused ? 'Play' : 'Pause'}
          onClick={() => setPaused((p) => !p)}
          className="uig-dynamic-island__demo-play flex cursor-pointer rounded-md transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {paused ? <PlayIcon size={22} /> : <PauseIcon size={22} />}
        </button>
        <button
          type="button"
          aria-label="Next track"
          className="uig-dynamic-island__demo-skip flex cursor-pointer rounded-md transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <SkipIcon />
        </button>
      </div>
    </div>
  )
}

function ShareContent() {
  const { setState } = useDynamicIsland()
  return (
    <div className="uig-dynamic-island__demo-share flex h-full w-full flex-col gap-4 p-4 text-white">
      <div className="uig-dynamic-island__demo-body flex min-h-0 flex-1 justify-between gap-3">
        <div className="uig-dynamic-island__demo-message flex min-w-0 flex-col">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle cx="20" cy="22" r="3.5" fill={BLUE} />
            <path
              d="M13 29a10 10 0 1 1 14 0M8.5 33.5a16.3 16.3 0 1 1 23 0"
              stroke={BLUE}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          <p className="uig-dynamic-island__demo-title mt-1 text-sm font-medium">Nearby share</p>
          <p className="uig-dynamic-island__demo-text text-xs leading-4 text-white/75">
            Ana wants to send you 12 photos
          </p>
        </div>
        <img
          src="/demo/portrait.jpg"
          alt=""
          draggable={false}
          className="uig-dynamic-island__demo-thumb size-24 shrink-0 rounded-2xl object-cover"
        />
      </div>
      <div className="uig-dynamic-island__demo-actions flex gap-2 text-base font-medium">
        <button
          type="button"
          onClick={() => setState('idle')}
          className="uig-dynamic-island__demo-later flex-1 cursor-pointer rounded-full bg-neutral-700 py-1.5 text-white transition-colors hover:bg-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="uig-dynamic-island__demo-receive flex-1 cursor-pointer rounded-full bg-[#0b2f57] py-1.5 text-[#3aa0ff] transition-colors hover:bg-[#0f3b6e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3aa0ff]"
        >
          Receive
        </button>
      </div>
    </div>
  )
}

function CallContent() {
  const seconds = 11 + useTick(1000)
  return (
    <div
      className="uig-dynamic-island__demo-call flex h-full w-full items-center justify-between px-2.5"
      style={{ color: GREEN }}
    >
      <div className="uig-dynamic-island__demo-caller flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
          <path d="M3.1 1.2 4.6 1.3c.35.03.64.28.72.62l.43 1.9c.07.33-.06.67-.34.86l-.98.66a7.9 7.9 0 0 0 3.2 3.2l.66-.98c.19-.28.53-.41.86-.34l1.9.43c.34.08.59.37.62.72l.1 1.5c.04.6-.44 1.12-1.05 1.1C5.3 10.8 1.2 6.7 1.02 2.25 1 1.64 1.5 1.16 2.1 1.2Z" />
        </svg>
        <span className="uig-dynamic-island__demo-text text-xs font-semibold tabular-nums">
          {longClock(seconds)}
        </span>
      </div>
      <Bars count={18} width={1} color={GREEN} max={14} min={2} />
    </div>
  )
}

function BatteryContent() {
  const fillRef = useRef<HTMLSpanElement>(null)
  const calm = useCalm()
  useEffect(() => {
    const el = fillRef.current
    if (!el || calm) return
    const animation = el.animate([{ width: '100%' }, { width: '14%' }], {
      duration: 700,
      delay: 450,
      easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
      fill: 'backwards',
    })
    return () => animation.cancel()
  }, [calm])
  return (
    <div className="uig-dynamic-island__demo-battery flex h-full w-full items-center justify-between px-2.5">
      <span className="uig-dynamic-island__demo-text text-xs font-semibold text-white">
        Battery low
      </span>
      <div className="uig-dynamic-island__demo-level flex items-center" style={{ color: RED }}>
        <span className="uig-dynamic-island__demo-text mr-1.5 text-xs font-semibold tabular-nums">
          12%
        </span>
        <span className="uig-dynamic-island__demo-cell relative h-[10px] w-5 overflow-hidden rounded-[3px] bg-[#ff5a45]/35">
          <span
            ref={fillRef}
            className="uig-dynamic-island__demo-charge absolute inset-y-0 left-0 bg-current"
            style={{ width: '14%' }}
          />
        </span>
        <span className="uig-dynamic-island__demo-nub ml-px h-1 w-0.5 rounded-r-sm bg-[#ff5a45]/35" />
      </div>
    </div>
  )
}

export const dynamicIslandDemoStates: Record<string, DynamicIslandState> = {
  idle: { width: 100, height: 28, label: 'Idle', content: null },
  ring: { width: 128, height: 28, bounce: 0.5, label: 'Ringer on', content: <RingContent /> },
  timer: { width: 284, height: 64, bounce: 0.3, label: 'Pasta timer', content: <TimerContent /> },
  record: { width: 200, height: 28, label: 'Recording a memo', content: <RecordContent /> },
  music: { width: 284, height: 172, label: 'Now playing Low Tide', content: <MusicContent /> },
  share: { width: 284, height: 180, label: 'Ana wants to share photos', content: <ShareContent /> },
  call: { width: 220, height: 28, label: 'Call in progress', content: <CallContent /> },
  battery: {
    width: 220,
    height: 28,
    label: 'Battery low, 12 percent',
    content: <BatteryContent />,
  },
}
