'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { componentMetas, type ComponentCategory } from '@uigrove/components/meta'
import { ComponentBento } from './component-bento'

const categories: readonly { id: ComponentCategory; label: string }[] = [
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'text', label: 'Text' },
  { id: 'effects', label: 'Effects' },
  { id: 'media', label: 'Media' },
  { id: 'galleries', label: 'Galleries' },
  { id: 'navigation', label: 'Navigation' },
]

// Grid fades out, swaps, then fades back in on a filter change
const FADE_OUT_MS = 230

const haystacks = new Map(
  componentMetas.map((meta) => [
    meta.name,
    `${meta.name} ${meta.title} ${meta.description} ${meta.category}`.toLowerCase(),
  ]),
)

function matches(name: string, query: string) {
  const text = haystacks.get(name) ?? ''
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word))
}

export function ComponentsBrowser() {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<ComponentCategory | null>(null)
  const [shown, setShown] = useState<ComponentCategory | null>(null)
  const [fading, setFading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timer = useRef(0)

  // One filter at a time: pills update now, the grid after the fade
  const choose = (next: ComponentCategory | null) => {
    if (next === picked) return
    setPicked(next)
    window.clearTimeout(timer.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(next)
      return
    }
    setFading(true)
    timer.current = window.setTimeout(() => {
      setShown(next)
      setFading(false)
    }, FADE_OUT_MS)
  }

  const reset = () => {
    setQuery('')
    choose(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable]'))
        return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(timer.current)
    }
  }, [])

  const sections = useMemo(
    () =>
      categories.map((category) => {
        const metas = componentMetas.filter((meta) => meta.category === category.id)
        const open = shown === null || shown === category.id
        const visible = new Set(
          open ? metas.filter((meta) => matches(meta.name, query)).map((meta) => meta.name) : [],
        )
        return { ...category, metas, visible }
      }),
    [query, shown],
  )
  const total = sections.reduce((sum, s) => sum + s.visible.size, 0)

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="search" className="relative w-full lg:max-w-[360px]">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('')
            }}
            placeholder="Search components"
            aria-label="Search components"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-full border border-line bg-surface pr-12 pl-11 text-[14px] text-fg placeholder:text-muted transition-ui hover:border-line-strong focus:border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-fg/20 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-ui hover:bg-surface-strong hover:text-fg"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          ) : (
            <kbd className="label pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 rounded border border-line px-1.5 py-0.5">
              /
            </kbd>
          )}
        </div>

        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Filter by category"
        >
          <button
            type="button"
            aria-pressed={picked === null}
            onClick={() => choose(null)}
            className={pill(picked === null)}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              aria-pressed={picked === category.id}
              onClick={() => choose(picked === category.id ? null : category.id)}
              className={pill(picked === category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {total} of {componentMetas.length} components shown
      </p>

      <div
        className={`flex flex-col gap-16 transition-opacity motion-reduce:transition-none ${
          fading ? 'opacity-0 duration-[230ms] ease-in' : 'opacity-100 duration-[400ms] ease-out'
        }`}
      >
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            hidden={section.visible.size === 0}
            className="scroll-mt-28"
            aria-labelledby={`${section.id}-title`}
          >
            <div className="mb-5 flex items-baseline gap-3">
              <h2 id={`${section.id}-title`} className="heading text-[22px]">
                {section.label}
              </h2>
              <span className="label">
                {section.visible.size === section.metas.length
                  ? section.metas.length
                  : `${section.visible.size} / ${section.metas.length}`}
              </span>
            </div>
            <ComponentBento metas={section.metas} visible={section.visible} />
          </section>
        ))}

        {total === 0 ? (
          <div className="flex flex-col items-center gap-4 py-24 text-center">
            <p className="text-[15px] text-muted">
              {query.trim()
                ? `Nothing matches “${query.trim()}”.`
                : 'Nothing in these categories yet.'}
            </p>
            <button
              type="button"
              onClick={reset}
              className="h-9 rounded-full border border-line-strong px-4 text-[13px] font-medium transition-ui hover:bg-surface"
            >
              Reset filters
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function pill(active: boolean) {
  return `h-9 rounded-full px-4 text-[13px] font-medium transition-ui ${
    active ? 'bg-fg text-bg' : 'bg-surface text-muted hover:bg-surface-strong hover:text-fg'
  }`
}
