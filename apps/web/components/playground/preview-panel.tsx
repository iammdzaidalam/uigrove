'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ComponentPreview } from '../previews/registry'
import { useTheme } from '../theme'
import { Controls } from './controls'
import { usePlayground } from './playground-context'
import { InstallPill } from '../install-command'

export function PreviewPanel() {
  const { meta, values, previewKey, setValue, reset } = usePlayground()
  const { theme, toggle } = useTheme()
  const [controlsOpen, setControlsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    if (!controlsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setControlsOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [controlsOpen])

  const toggleFullscreen = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void panel.requestFullscreen?.()
  }, [])

  return (
    <div
      ref={panelRef}
      className="relative flex h-full min-h-[520px] w-full flex-col overflow-hidden rounded-2xl border border-line bg-bg"
    >
      <div className="relative isolate min-h-0 flex-1">
        <ComponentPreview key={previewKey} slug={meta.name} values={values} />
      </div>

      <div className="absolute top-3 right-3 z-40 flex items-center gap-1 rounded-lg border border-line bg-bg/90 p-1">
        <ToolbarButton
          label={controlsOpen ? 'Hide controls' : 'Show controls'}
          pressed={controlsOpen}
          onClick={() => setControlsOpen((open) => !open)}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M1 4h8M11 4h2M1 10h2M5 10h8" strokeLinecap="round" />
            <circle cx="9.5" cy="4" r="1.5" fill="var(--bg)" />
            <circle cx="3.5" cy="10" r="1.5" fill="var(--bg)" />
          </svg>
        </ToolbarButton>
        <ToolbarButton label="Reset" onClick={reset}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M2.5 7a4.5 4.5 0 1 0 1.3-3.2" strokeLinecap="round" />
            <path d="M2 1.5v3h3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ToolbarButton>
        <ToolbarButton label={theme === 'dark' ? 'Light preview' : 'Dark preview'} onClick={toggle}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 1a6 6 0 0 1 0 12z" />
          </svg>
        </ToolbarButton>
        <ToolbarButton
          label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={toggleFullscreen}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              d="M1.5 5v-3.5h3.5M12.5 9v3.5h-3.5M9 1.5h3.5v3.5M5 12.5h-3.5v-3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </ToolbarButton>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-3">
        <div className="pointer-events-auto">
          <InstallPill slug={meta.name} />
        </div>
      </div>

      <div
        className={[
          'absolute inset-y-0 right-0 z-30 w-[300px] max-w-full overflow-y-auto border-l border-line bg-bg px-4 pt-14 pb-16 transition-ui',
          controlsOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        aria-hidden={!controlsOpen}
      >
        <button
          type="button"
          onClick={() => setControlsOpen(false)}
          className="label mb-2 flex h-8 w-full items-center justify-between rounded-md border border-line px-3 transition-ui hover:bg-surface hover:text-fg"
          tabIndex={controlsOpen ? 0 : -1}
        >
          <span>Close controls</span>
          <span aria-hidden="true">Esc</span>
        </button>
        <Controls meta={meta} values={values} onChange={setValue} onReset={reset} />
      </div>
    </div>
  )
}

interface ToolbarButtonProps {
  label: string
  onClick: () => void
  pressed?: boolean
  children: React.ReactNode
}

function ToolbarButton({ label, onClick, pressed, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={[
        'flex size-8 items-center justify-center rounded-md transition-ui',
        pressed ? 'bg-surface-strong text-fg' : 'text-muted hover:bg-surface hover:text-fg',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
