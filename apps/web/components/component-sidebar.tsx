'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { componentMetas, defaultsFrom } from '@uigrove/components/meta'
import { cardValues } from './component-bento'
import { withThemeColor } from './playground/playground-context'
import { ComponentPreview } from './previews/registry'
import { useTheme } from './theme'

interface HoverState {
  slug: string
  top: number
}

export function ComponentSidebar() {
  const [open, setOpen] = useState(false)
  const [hover, setHover] = useState<HoverState | null>(null)
  const pathname = usePathname()
  const { fg } = useTheme()
  const titleId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef(0)

  const close = useCallback(() => {
    setOpen(false)
    setHover(null)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((current) => !current)
      } else if (e.key === 'Escape') {
        setOpen(false)
        setHover(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      const list = listRef.current
      const active = list?.querySelector<HTMLAnchorElement>('[aria-current="page"]')
      const target = active ?? list?.querySelector<HTMLAnchorElement>('a')
      active?.scrollIntoView({ block: 'center' })
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const onEnter = (slug: string, row: HTMLElement) => {
    window.clearTimeout(hoverTimer.current)
    const top = row.getBoundingClientRect().top
    hoverTimer.current = window.setTimeout(() => setHover({ slug, top }), 120)
  }

  const onLeave = () => {
    window.clearTimeout(hoverTimer.current)
    setHover(null)
  }

  const hoverMeta = hover ? componentMetas.find((m) => m.name === hover.slug) : undefined
  const hoverValues = hoverMeta
    ? { ...withThemeColor(defaultsFrom(hoverMeta), hoverMeta, fg), ...cardValues[hoverMeta.name] }
    : null

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Close component list' : 'Open component list'}
        aria-expanded={open}
        aria-controls={titleId}
        className="fixed bottom-4 left-4 z-[60] flex size-12 items-center justify-center rounded-full border border-line bg-bg/85 text-muted backdrop-blur-md transition-ui hover:text-fg md:top-4 md:bottom-auto"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect
            x="1.5"
            y="2.5"
            width="13"
            height="11"
            rx="2.5"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect x="3.5" y="4.5" width="3.5" height="7" rx="1" fill="currentColor" />
        </svg>
      </button>

      <div
        className={[
          'fixed inset-0 z-50 transition-ui',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        data-sidebar=""
        data-open={open}
      >
        <button
          type="button"
          aria-label="Close component list"
          tabIndex={-1}
          onClick={close}
          className="absolute inset-0 bg-bg/50"
        />
        <aside
          id={titleId}
          role="dialog"
          aria-modal="true"
          aria-label="Components"
          className={[
            'absolute inset-y-0 left-0 w-[320px] max-w-[86vw] border-r border-line bg-bg transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
            open ? 'translate-x-0' : '-translate-x-6',
          ].join(' ')}
        >
          <div
            ref={listRef}
            className="h-full overflow-y-auto py-[40vh] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)] [scrollbar-width:none]"
          >
            <ul className="flex flex-col">
              {componentMetas.map((meta, index) => {
                const href = `/components/${meta.name}`
                const active = pathname === href
                const hovered = hover?.slug === meta.name
                const lit = active || hovered
                return (
                  <li
                    key={meta.name}
                    className="relative"
                    onMouseEnter={(e) => onEnter(meta.name, e.currentTarget)}
                    onMouseLeave={onLeave}
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-5 flex flex-col justify-around"
                    >
                      <span className="block h-px w-6 bg-line-strong" />
                      <span
                        className={[
                          'block h-px transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
                          lit ? 'w-12 bg-fg' : 'w-6 bg-line-strong',
                        ].join(' ')}
                      />
                      <span className="block h-px w-6 bg-line-strong" />
                    </span>
                    <Link
                      href={href}
                      onClick={() => {
                        setOpen(false)
                        setHover(null)
                      }}
                      aria-current={active ? 'page' : undefined}
                      tabIndex={open ? 0 : -1}
                      onFocus={(e) => {
                        if (e.currentTarget.matches(':focus-visible')) {
                          onEnter(meta.name, e.currentTarget.parentElement ?? e.currentTarget)
                        }
                      }}
                      onBlur={onLeave}
                      className={[
                        'flex h-8 items-center gap-2 pl-14 text-[15px] tracking-[-0.01em] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] focus-visible:outline-none',
                        lit ? 'translate-x-6 text-fg' : 'text-muted hover:text-fg',
                      ].join(' ')}
                    >
                      <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                      <span>{meta.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden justify-between px-5 pb-4 md:flex">
            <span className="label">{componentMetas.length} components</span>
            <span className="label">⌘K</span>
          </div>
        </aside>

        {hover && hoverMeta && hoverValues ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[336px] hidden h-[150px] w-[240px] overflow-hidden rounded-xl border border-line bg-bg md:block"
            style={{ top: Math.max(16, Math.min(hover.top - 59, window.innerHeight - 166)) }}
          >
            <ComponentPreview key={hover.slug} slug={hover.slug} values={hoverValues} />
          </div>
        ) : null}
      </div>
    </>
  )
}
