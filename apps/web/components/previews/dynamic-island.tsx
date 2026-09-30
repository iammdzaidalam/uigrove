'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DynamicIsland, dynamicIslandDemoStates } from '@uigrove/components/dynamic-island'

const COLLAPSE_MS = 500
const IDLE_BOUNCE = 0.5
const keys = Object.keys(dynamicIslandDemoStates)
const idle = dynamicIslandDemoStates.idle ?? { width: 100, height: 28, content: null }

export function DynamicIslandPreview({ values }: { values: Record<string, unknown> }) {
  const [view, setView] = useState('idle')
  const [pressed, setPressed] = useState('idle')
  const [idleBounce, setIdleBounce] = useState<number | undefined>(undefined)
  const timer = useRef(0)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const states = useMemo(
    () => ({ ...dynamicIslandDemoStates, idle: { ...idle, bounce: idleBounce } }),
    [idleBounce],
  )

  // Collapse to idle first, then open the chosen state
  const select = (key: string) => {
    window.clearTimeout(timer.current)
    setPressed(key)
    setView('idle')
    setIdleBounce(key === 'idle' ? IDLE_BOUNCE : undefined)
    if (key !== 'idle') timer.current = window.setTimeout(() => setView(key), COLLAPSE_MS)
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-4">
      <div className="flex h-[184px] w-full items-center justify-center">
        <DynamicIsland
          {...values}
          states={states}
          state={view}
          onStateChange={select}
          className="ring-1 ring-current/10"
        />
      </div>
      <div
        role="group"
        aria-label="Island state"
        className="flex max-w-[360px] flex-wrap justify-center gap-2"
      >
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={pressed === key}
            onClick={() => select(key)}
            className={[
              'cursor-pointer rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current',
              pressed === key
                ? 'border-current/30 bg-current/10'
                : 'border-current/15 text-muted hover:bg-current/5 hover:text-fg',
            ].join(' ')}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
