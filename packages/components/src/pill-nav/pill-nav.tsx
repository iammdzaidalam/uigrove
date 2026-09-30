'use client'

import {
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from 'react'
import {
  PillNavScroll,
  pillNavClosedHeight,
  pillNavCommands,
  pillNavDialogFrames,
  pillNavEase,
  pillNavFilter,
  pillNavGapTransition,
  pillNavInitialState,
  pillNavReduce,
  pillNavStep,
  pillNavTiming,
  pillNavTransition,
  type PillNavCommand,
  type PillNavCommandGroup,
  type PillNavPosition,
} from './pill-nav.engine'

export interface PillNavLink {
  label: string
  href: string
  external?: boolean
}

export interface PillNavMenuItem {
  label: string
  // Without a link the item renders as plain text
  href?: string
  description?: string
  external?: boolean
}

export interface PillNavMenuSection {
  title: string
  items: PillNavMenuItem[]
}

export interface PillNavOptions {
  brand: string
  brandHref: string
  hideOnScroll: boolean
  blur: number
  radius: number
  height: number
  maxWidth: number
  expandDuration: number
  position: PillNavPosition
  command: boolean
  searchPlaceholder: string
}

export interface PillNavProps extends Partial<PillNavOptions> {
  logo?: ReactNode
  links?: PillNavLink[]
  // First section fills the panel, the rest become rows
  menu?: PillNavMenuSection[]
  // Receives internal links instead of a full page load
  onNavigate?: (href: string) => void
  className?: string
  style?: CSSProperties
}

export const pillNavDefaults: PillNavOptions = {
  brand: 'Acme',
  brandHref: '/',
  hideOnScroll: false,
  blur: 12,
  radius: 16,
  height: 54,
  maxWidth: 768,
  expandDuration: 300,
  position: 'fixed',
  command: true,
  searchPlaceholder: 'Search pages and links',
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const SURFACE = 'var(--uig-pill-nav-surface, color-mix(in srgb, currentColor 4%, Canvas))'
const EDGE = 'var(--uig-pill-nav-edge, color-mix(in srgb, currentColor 2%, Canvas))'
const RAISED =
  'var(--uig-pill-nav-raised, light-dark(Canvas, color-mix(in srgb, currentColor 8%, Canvas)))'
const LINE = 'var(--uig-pill-nav-line, color-mix(in srgb, currentColor 5%, transparent))'
const SHADOW = '0 4px 8px -2px var(--uig-pill-nav-shadow, rgb(0 0 0 / 0.06))'
const OVERLAY = 'var(--uig-pill-nav-overlay, rgb(0 0 0 / 0.2))'
const PANEL_ALPHA = 80
const PANEL_BLUR_RATIO = 2 / 3
const FOOTER_HINT = 'Open link'
const NO_LINKS: PillNavLink[] = []

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

function translucent(color: string, percent: number) {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`
}

function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="uig-pill-nav__icon block shrink-0"
    >
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  command:
    'M9 9h6v6H9zM9 9H6a3 3 0 1 1 3-3v3M15 9V6a3 3 0 1 1 3 3h-3M15 15h3a3 3 0 1 1-3 3v-3M9 15v3a3 3 0 1 1-3-3h3',
  expand:
    'M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3',
  collapse:
    'M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M16 21v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20.5 20.5l-4.5-4.5',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  external: 'M7 17 17 7M8 7h9v9',
  enter: 'M20 5v7a3 3 0 0 1-3 3H5M9 11l-4 4 4 4',
} as const

export function PillNav({
  brand = pillNavDefaults.brand,
  brandHref = pillNavDefaults.brandHref,
  hideOnScroll = pillNavDefaults.hideOnScroll,
  blur = pillNavDefaults.blur,
  radius = pillNavDefaults.radius,
  height = pillNavDefaults.height,
  maxWidth = pillNavDefaults.maxWidth,
  expandDuration = pillNavDefaults.expandDuration,
  position = pillNavDefaults.position,
  command = pillNavDefaults.command,
  searchPlaceholder = pillNavDefaults.searchPlaceholder,
  logo,
  links = NO_LINKS,
  menu,
  onNavigate,
  className,
  style,
}: PillNavProps) {
  const reduced = useReducedMotion()
  const [state, dispatch] = useReducer(pillNavReduce, pillNavInitialState)
  const [paletteMounted, setPaletteMounted] = useState(false)
  const [scrollHidden, setScrollHidden] = useState(false)
  const [frameHeight, setFrameHeight] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const columnRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const paletteRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  if (state.palette && !paletteMounted) setPaletteMounted(true)

  const sections = useMemo<PillNavMenuSection[]>(
    () => (menu && menu.length > 0 ? menu : [{ title: 'Menu', items: links }]),
    [menu, links],
  )
  const groups = useMemo(() => pillNavCommands(sections, links), [sections, links])
  const [primary, ...rows] = sections
  const hasMenu = (primary?.items.length ?? 0) > 0
  const open = state.menu
  const hidden = hideOnScroll && scrollHidden && !open && !state.palette
  const duration = reduced ? 0 : expandDuration
  const closedHeight = pillNavClosedHeight(height)
  const panelBlur = Math.round(blur * PANEL_BLUR_RATIO)
  const inner = Math.max(0, radius - 4)
  const gap = open ? pillNavTiming.gapOpen : pillNavTiming.gapClosed
  const fullHeight = position === 'absolute' ? '100%' : '100vh'
  const columnHeight =
    position === 'absolute' ? (frameHeight === null ? '100%' : frameHeight) : '100dvh'

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const column = columnRef.current
      if (column && event.target instanceof Node && !column.contains(event.target)) {
        dispatch('close-menu')
      }
    }
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      dispatch('close-menu')
      toggleRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!command) return
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      dispatch('toggle-palette')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [command])

  useEffect(() => {
    const frame = rootRef.current?.offsetParent
    if (position !== 'absolute' || !(frame instanceof HTMLElement)) return
    const observer = new ResizeObserver(() => setFrameHeight(frame.clientHeight))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [position])

  useEffect(() => {
    const root = rootRef.current
    if (!hideOnScroll || !root || position === 'static') return
    const tracker = new PillNavScroll(closedHeight)
    const frame = position === 'absolute' ? root.offsetParent : null
    const read = (target: EventTarget | null) => {
      if (target instanceof Element) {
        if (root.contains(target) || paletteRef.current?.contains(target)) return
        setScrollHidden(tracker.update(target.scrollTop))
      } else setScrollHidden(tracker.update(window.scrollY))
    }
    const onScroll = (event: Event) => read(event.target === document ? null : event.target)
    const host: EventTarget = frame ?? window
    host.addEventListener('scroll', onScroll, { passive: true, capture: frame !== null })
    return () => {
      host.removeEventListener('scroll', onScroll, { capture: frame !== null })
      setScrollHidden(false)
    }
  }, [hideOnScroll, position, closedHeight])

  const follow = (event: MouseEvent, href: string, external: boolean, closes: boolean) => {
    if (closes) dispatch('close-menu')
    if (!onNavigate || external || !isPlainClick(event)) return
    event.preventDefault()
    onNavigate(href)
  }

  const go = (entry: PillNavCommand) => {
    dispatch('close-palette')
    if (entry.external) window.open(entry.href, '_blank', 'noopener,noreferrer')
    else if (onNavigate) onNavigate(entry.href)
    else window.location.assign(entry.href)
  }

  const linkProps = (href: string, external: boolean | undefined, closes: boolean) => ({
    href,
    target: external ? '_blank' : undefined,
    rel: external ? 'noreferrer' : undefined,
    onClick: (event: MouseEvent) => follow(event, href, external ?? false, closes),
  })

  return (
    <>
      <div
        ref={rootRef}
        className={['uig-pill-nav', 'overflow-hidden', className].filter(Boolean).join(' ')}
        style={{
          position,
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          marginInline: 'auto',
          width: '100%',
          maxWidth,
          height: open ? fullHeight : closedHeight,
          transform: hidden ? 'translateY(-100%)' : 'none',
          transition: pillNavTransition(duration),
          ...style,
        }}
        onFocus={() => setScrollHidden(false)}
      >
        <nav
          ref={columnRef}
          aria-label="Main"
          className="uig-pill-nav__column absolute inset-x-0 top-0 flex flex-col px-3 py-2"
          style={{ height: columnHeight, gap, transition: pillNavGapTransition(duration) }}
        >
          <div
            className="uig-pill-nav__bar flex w-full shrink-0 items-center justify-between py-0 pr-2.5 pl-5"
            style={{
              height,
              borderRadius: radius,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: EDGE,
              background: SURFACE,
              boxShadow: SHADOW,
              backdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
              WebkitBackdropFilter: blur > 0 ? `blur(${blur}px)` : undefined,
            }}
          >
            <a
              {...linkProps(brandHref, false, true)}
              className="uig-pill-nav__brand flex items-center gap-2 rounded-[6px] py-1 text-sm leading-5 font-semibold uppercase focus-visible:outline-offset-4 focus-visible:[outline:1px_solid_var(--uig-pill-nav-ring,#00a6f4)]"
            >
              {logo && (
                <span className="uig-pill-nav__logo flex size-6 shrink-0 items-center justify-center">
                  {logo}
                </span>
              )}
              <span className="uig-pill-nav__name">{brand}</span>
            </a>
            <div className="uig-pill-nav__end flex items-center gap-4 text-[13px] leading-[1.5]">
              {links.map((link) => (
                <a
                  key={`${link.href}-${link.label}`}
                  {...linkProps(link.href, link.external, true)}
                  className="uig-pill-nav__link hidden rounded-[6px] opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-offset-4 focus-visible:[outline:1px_solid_var(--uig-pill-nav-ring,#00a6f4)] md:block"
                >
                  {link.label}
                </a>
              ))}
              {(command || hasMenu) && (
                <div className="uig-pill-nav__actions flex gap-2">
                  {command && (
                    <button
                      type="button"
                      aria-label="Search"
                      aria-haspopup="dialog"
                      aria-expanded={state.palette}
                      aria-keyshortcuts="Meta+K Control+K"
                      className="uig-pill-nav__button flex size-8 cursor-pointer items-center justify-center focus-visible:outline-offset-2 focus-visible:[outline:1px_solid_var(--uig-pill-nav-ring,#00a6f4)]"
                      style={{ borderRadius: inner, background: RAISED }}
                      onClick={() => dispatch('open-palette')}
                    >
                      <span
                        className="uig-pill-nav__press flex size-full items-center justify-center transition-transform [button:active>&]:scale-95"
                        style={{
                          transitionDuration: `${pillNavTiming.press}ms`,
                          transitionTimingFunction: pillNavEase.press,
                        }}
                      >
                        <Icon d={ICONS.command} />
                      </span>
                    </button>
                  )}
                  {hasMenu && (
                    <button
                      ref={toggleRef}
                      type="button"
                      aria-label="Menu"
                      aria-expanded={open}
                      aria-controls={panelId}
                      className="uig-pill-nav__button flex size-8 cursor-pointer items-center justify-center focus-visible:outline-offset-2 focus-visible:[outline:1px_solid_var(--uig-pill-nav-ring,#00a6f4)]"
                      style={{ borderRadius: inner, background: RAISED }}
                      onClick={() => dispatch('toggle-menu')}
                    >
                      <span
                        className="uig-pill-nav__press flex size-full items-center justify-center transition-transform [button:active>&]:scale-95"
                        style={{
                          transitionDuration: `${pillNavTiming.press}ms`,
                          transitionTimingFunction: pillNavEase.press,
                        }}
                      >
                        <Icon d={open ? ICONS.collapse : ICONS.expand} />
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {hasMenu && primary && (
            <div
              id={panelId}
              inert={!open}
              className="uig-pill-nav__panel flex min-h-0 flex-1 flex-col"
              style={{ gap, transition: pillNavGapTransition(duration) }}
            >
              <ul
                aria-label={primary.title}
                className="uig-pill-nav__list m-0 flex w-full flex-1 list-none flex-col items-center justify-center gap-1.5 overflow-hidden px-7 py-3"
                style={{
                  borderRadius: radius,
                  background: translucent(SURFACE, PANEL_ALPHA),
                  backdropFilter: panelBlur > 0 ? `blur(${panelBlur}px)` : undefined,
                  WebkitBackdropFilter: panelBlur > 0 ? `blur(${panelBlur}px)` : undefined,
                }}
              >
                {primary.items.map((item) => (
                  <li
                    key={`${item.href}-${item.label}`}
                    className="uig-pill-nav__entry relative flex flex-col items-center"
                  >
                    {item.href ? (
                      <a
                        {...linkProps(item.href, item.external, true)}
                        className="uig-pill-nav__item relative flex items-start rounded-[6px] focus-visible:outline-offset-4 focus-visible:[outline:1px_solid_var(--uig-pill-nav-ring,#00a6f4)]"
                      >
                        <span className="uig-pill-nav__label text-4xl leading-[0.8] font-extrabold tracking-[-0.03em] uppercase hover:opacity-50 lg:text-5xl">
                          {item.label}
                        </span>
                        {item.description && (
                          <span
                            className="uig-pill-nav__hint absolute -right-1 text-xs leading-[0.9] tracking-tighter whitespace-nowrap opacity-0 lg:text-sm [a:focus-visible>&]:opacity-50 [a:hover>&]:opacity-50"
                            style={{ transform: 'translateX(100%)' }}
                          >
                            {item.description}
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="uig-pill-nav__label text-4xl leading-[0.8] font-extrabold tracking-[-0.03em] uppercase lg:text-5xl">
                        {item.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {rows.map((row) => (
                <div
                  key={row.title}
                  role="group"
                  aria-label={row.title}
                  className="uig-pill-nav__row flex w-full shrink-0 items-center justify-between p-4 text-sm leading-5 tracking-tight uppercase"
                  style={{
                    borderRadius: radius,
                    background: translucent(SURFACE, PANEL_ALPHA),
                    backdropFilter: panelBlur > 0 ? `blur(${panelBlur}px)` : undefined,
                    WebkitBackdropFilter: panelBlur > 0 ? `blur(${panelBlur}px)` : undefined,
                  }}
                >
                  {row.items.map((item, index) =>
                    item.href ? (
                      <a
                        key={`${item.href}-${item.label}`}
                        {...linkProps(item.href, item.external, true)}
                        className="uig-pill-nav__row-link rounded-[6px] opacity-50 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-offset-4 focus-visible:[outline:1px_solid_var(--uig-pill-nav-ring,#00a6f4)]"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <span
                        key={`${item.label}-${index}`}
                        className="uig-pill-nav__row-text"
                        style={{ opacity: index === 0 ? 1 : 0.6 }}
                      >
                        {item.label}
                      </span>
                    ),
                  )}
                </div>
              ))}
            </div>
          )}
        </nav>
      </div>
      {command && paletteMounted && (
        <PillNavPalette
          ref={paletteRef}
          open={state.palette}
          groups={groups}
          placeholder={searchPlaceholder}
          position={position}
          maxWidth={maxWidth}
          radius={radius}
          reduced={reduced}
          onClose={() => dispatch('close-palette')}
          onExited={() => setPaletteMounted(false)}
          onSelect={go}
        />
      )}
    </>
  )
}

interface PillNavPaletteProps {
  ref: Ref<HTMLDivElement>
  open: boolean
  groups: PillNavCommandGroup[]
  placeholder: string
  position: PillNavPosition
  maxWidth: number
  radius: number
  reduced: boolean
  onClose: () => void
  onExited: () => void
  onSelect: (entry: PillNavCommand) => void
}

function PillNavPalette({
  ref,
  open,
  groups,
  placeholder,
  position,
  maxWidth,
  radius,
  reduced,
  onClose,
  onExited,
  onSelect,
}: PillNavPaletteProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const exitedRef = useRef(onExited)
  const baseId = useId()
  const visible = useMemo(() => pillNavFilter(groups, query), [groups, query])
  const flat = useMemo(() => visible.flatMap((group) => group.commands), [visible])
  const orders = useMemo(() => new Map(flat.map((entry, order) => [entry.id, order])), [flat])
  const current = flat[Math.min(active, flat.length - 1)]
  const optionId = (entry: PillNavCommand) => `${baseId}-${entry.id}`
  const currentId = current ? optionId(current) : undefined

  useEffect(() => {
    exitedRef.current = onExited
  }, [onExited])

  useEffect(() => {
    const previous = document.activeElement
    inputRef.current?.focus()
    const lock = position !== 'absolute'
    const root = document.documentElement
    const overflow = root.style.overflow
    if (lock) root.style.overflow = 'hidden'
    return () => {
      if (lock) root.style.overflow = overflow
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [position])

  useEffect(() => {
    const dialog = dialogRef.current
    const overlay = overlayRef.current
    if (!dialog || !overlay) return
    if (reduced) {
      if (!open) exitedRef.current()
      return
    }
    const easing = pillNavEase.dialog
    const frames = pillNavDialogFrames(open)
    const fade = open ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }]
    const body = dialog.animate(frames, { duration: pillNavTiming.dialog, easing, fill: 'both' })
    const shade = overlay.animate(fade, { duration: pillNavTiming.overlay, easing, fill: 'both' })
    if (!open) body.onfinish = () => exitedRef.current()
    return () => {
      body.onfinish = null
      body.cancel()
      shade.cancel()
    }
  }, [open, reduced])

  useEffect(() => {
    if (!currentId) return
    const option = listRef.current?.querySelector(`[id="${currentId}"]`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [currentId])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (current) onSelect(current)
      return
    }
    const next = pillNavStep(event.key, Math.min(active, flat.length - 1), flat.length)
    if (next === null) return
    event.preventDefault()
    setActive(next)
  }

  return (
    <div
      ref={ref}
      className="uig-pill-nav__palette inset-0 flex items-center justify-center"
      style={{
        position: position === 'absolute' ? 'absolute' : 'fixed',
        zIndex: 40,
        pointerEvents: open ? 'auto' : 'none',
      }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="uig-pill-nav__overlay absolute inset-0"
        style={{ background: OVERLAY, opacity: reduced && !open ? 0 : undefined }}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="uig-pill-nav__dialog relative w-full p-3 tracking-tight"
        style={{ maxWidth }}
      >
        <div
          className="uig-pill-nav__sheet relative overflow-hidden p-2"
          style={{
            borderRadius: radius + 8,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: LINE,
            background: SURFACE,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div
            className="uig-pill-nav__search relative z-[2] flex h-11 items-center gap-2 pr-3 pl-4"
            style={{
              borderRadius: radius,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: LINE,
              background: EDGE,
            }}
          >
            <span className="uig-pill-nav__search-icon opacity-50">
              <Icon d={ICONS.search} />
            </span>
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={`${baseId}-list`}
              aria-activedescendant={currentId}
              aria-autocomplete="list"
              aria-label={placeholder}
              autoComplete="off"
              spellCheck={false}
              placeholder={placeholder}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              className="uig-pill-nav__input flex w-full bg-transparent py-2 text-sm text-current outline-none placeholder:text-[color-mix(in_srgb,currentColor_70%,transparent)]"
            />
          </div>
          <div
            aria-hidden="true"
            className="uig-pill-nav__fade pointer-events-none absolute top-8 left-0 z-[1] h-12 w-full"
            style={{
              background: `linear-gradient(to bottom, ${SURFACE}, transparent)`,
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
              maskImage: 'linear-gradient(black 60%, transparent)',
              WebkitMaskImage: 'linear-gradient(black 60%, transparent)',
            }}
          />
          <div
            ref={listRef}
            id={`${baseId}-list`}
            role="listbox"
            aria-label={placeholder}
            className="uig-pill-nav__results relative mb-10 h-[400px] max-h-[calc(100dvh-10rem)] scroll-py-5 overflow-x-hidden overflow-y-auto text-sm font-medium"
          >
            {visible.length === 0 && (
              <p className="uig-pill-nav__empty m-0 py-6 text-center text-sm font-normal">
                Nothing matches that search.
              </p>
            )}
            {visible.map((group, groupIndex) => (
              <div
                key={group.title}
                role="group"
                aria-labelledby={`${baseId}-g${groupIndex}`}
                className="uig-pill-nav__group py-4"
                style={{ paddingTop: groupIndex > 0 ? 0 : undefined }}
              >
                <div
                  id={`${baseId}-g${groupIndex}`}
                  className="uig-pill-nav__heading px-4 py-1.5 text-xs leading-4"
                  style={{ opacity: 0.6 }}
                >
                  {group.title}
                </div>
                {group.commands.map((entry) => {
                  const order = orders.get(entry.id) ?? 0
                  const selected = entry === current
                  return (
                    <div
                      key={entry.id}
                      id={optionId(entry)}
                      role="option"
                      aria-selected={selected}
                      className="uig-pill-nav__option relative flex cursor-pointer items-center gap-2 px-4 py-3 leading-5 select-none"
                      style={{
                        borderRadius: Math.max(0, radius - 4),
                        background: selected ? EDGE : undefined,
                      }}
                      onPointerMove={() => {
                        if (!selected) setActive(order)
                      }}
                      onClick={() => onSelect(entry)}
                    >
                      <span className="uig-pill-nav__option-icon" style={{ opacity: 0.7 }}>
                        <Icon d={entry.external ? ICONS.external : ICONS.arrow} />
                      </span>
                      <span className="uig-pill-nav__option-label truncate">{entry.label}</span>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div
            className="uig-pill-nav__footer absolute bottom-0 left-0 flex h-12 w-full items-center justify-between px-[22px] text-xs"
            style={{
              borderTopWidth: 1,
              borderTopStyle: 'solid',
              borderColor: LINE,
              background: translucent(EDGE, 50),
            }}
          >
            <span
              className="uig-pill-nav__footer-hint flex items-center gap-2"
              style={{ opacity: 0.5 }}
            >
              <span
                className="uig-pill-nav__kbd flex size-5 items-center justify-center rounded-[4px]"
                style={{
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'color-mix(in srgb, currentColor 10%, transparent)',
                }}
              >
                <Icon d={ICONS.enter} size={12} />
              </span>
              {FOOTER_HINT}
            </span>
            {current && (
              <span
                className="uig-pill-nav__footer-href flex min-w-0 items-center gap-2"
                style={{ opacity: 0.5 }}
              >
                <span className="uig-pill-nav__footer-text truncate">{current.href}</span>
                <Icon d={ICONS.external} size={12} />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
