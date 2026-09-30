'use client'

import Link from 'next/link'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { useTheme } from '../theme'
import { ThemeIcon } from '../theme-icon'
import { Wordmark } from '../wordmark'
import { NavIslandEngine, type NavRect } from './nav-island.engine'
import { ComponentsPanel, githubUrl, MenuPanel, RegistryPanel } from './nav-panels'
import styles from './nav.module.css'

type PanelKey = 'components' | 'registry' | 'menu'

interface Layout {
  capsules: NavRect[]
  anchors: Partial<Record<PanelKey, NavRect>>
  sizes: Partial<Record<PanelKey, { width: number; height: number }>>
  rootLeft: number
  rowBottom: number
}

const PANEL_KEYS: readonly PanelKey[] = ['components', 'registry', 'menu']
const ANCHOR: Record<PanelKey, string> = {
  components: 'links',
  registry: 'links',
  menu: 'menu',
}
const OPEN_DELAY = 80
const CLOSE_GRACE = 150
const MAX_DT = 1 / 30
const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const PANEL_GAP = 18
const PANEL_RADIUS = 24
const VIEWPORT_MARGIN = 16
const COLLAPSED_INSET = 6
const NECK_MAX = 26
const NECK_OVERLAP = 14
const NECK_REACH = 72
const DROP_RADIUS = 15
const DROP_TRAVEL = 8
const STEM_MIN = 48
const STEM_FLARE = 12
const STEM_OVERLAP = 10
const KAPPA = 0.5523
const GOO_BLUR = 5
const GOO_MATRIX = '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11'
const PAD = 40

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

// Bridge stays thick near its own capsule, thins far away
const lean = (distance: number) => clamp(1.1 - 0.55 * distance, 0.35, 1)

const emptyLayout: Layout = { capsules: [], anchors: {}, sizes: {}, rootLeft: 0, rowBottom: 48 }

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

function setRect(el: SVGRectElement | null | undefined, r: NavRect | null, radius = 0) {
  if (!el) return
  if (!r || r.width <= 0 || r.height <= 0) {
    el.setAttribute('width', '0')
    el.setAttribute('height', '0')
    return
  }
  const rx = Math.min(radius, r.width / 2, r.height / 2)
  el.setAttribute('x', String(r.x + PAD))
  el.setAttribute('y', String(r.y + PAD))
  el.setAttribute('width', String(r.width))
  el.setAttribute('height', String(r.height))
  el.setAttribute('rx', String(rx))
}

// Hourglass neck whose sides curve in like the row necks
function stemPath(cx: number, half: number, top: number, bottom: number) {
  const gap = bottom - top
  if (gap <= 0) return ''
  const flare = Math.min(STEM_FLARE, gap)
  const mid = top + gap / 2
  const dy = (gap / 2) * KAPPA
  const dx = flare * KAPPA
  const l = cx - half
  const r = cx + half
  return [
    `M ${l - flare} ${top - STEM_OVERLAP}`,
    `L ${l - flare} ${top}`,
    `C ${l - flare + dx} ${top} ${l} ${mid - dy} ${l} ${mid}`,
    `C ${l} ${mid + dy} ${l - flare + dx} ${bottom} ${l - flare} ${bottom}`,
    `L ${l - flare} ${bottom + STEM_OVERLAP}`,
    `L ${r + flare} ${bottom + STEM_OVERLAP}`,
    `L ${r + flare} ${bottom}`,
    `C ${r + flare - dx} ${bottom} ${r} ${mid + dy} ${r} ${mid}`,
    `C ${r} ${mid - dy} ${r + flare - dx} ${top} ${r + flare} ${top}`,
    `L ${r + flare} ${top - STEM_OVERLAP}`,
    'Z',
  ].join(' ')
}

function measure(root: HTMLElement, layers: Map<PanelKey, HTMLElement>): Layout {
  const box = root.getBoundingClientRect()
  const capsules: NavRect[] = []
  const anchors: Layout['anchors'] = {}
  for (const el of root.querySelectorAll<HTMLElement>('[data-capsule]')) {
    if (el.getClientRects().length === 0) continue
    const r = el.getBoundingClientRect()
    const rect = { x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height }
    capsules.push(rect)
    for (const key of PANEL_KEYS) if (ANCHOR[key] === el.dataset.capsule) anchors[key] = rect
  }
  const sizes: Layout['sizes'] = {}
  for (const [key, el] of layers) sizes[key] = { width: el.offsetWidth, height: el.offsetHeight }
  const rowBottom = Math.max(48, ...capsules.map((c) => c.y + c.height))
  return { capsules, anchors, sizes, rootLeft: box.left, rowBottom }
}

function collapsedRect(layout: Layout, key: PanelKey): NavRect {
  const a = layout.anchors[key] ?? { x: 0, y: 0, width: 48, height: 48 }
  return {
    x: a.x + COLLAPSED_INSET,
    y: a.y + COLLAPSED_INSET,
    width: Math.max(0, a.width - COLLAPSED_INSET * 2),
    height: Math.max(0, a.height - COLLAPSED_INSET * 2),
  }
}

function openRect(layout: Layout, key: PanelKey): NavRect {
  const a = layout.anchors[key] ?? { x: 0, y: 0, width: 48, height: 48 }
  const size = layout.sizes[key] ?? { width: 320, height: 200 }
  const min = VIEWPORT_MARGIN - layout.rootLeft
  const max = window.innerWidth - VIEWPORT_MARGIN - layout.rootLeft - size.width
  const centred = a.x + a.width / 2 - size.width / 2
  return {
    x: Math.max(min, Math.min(max, centred)),
    y: layout.rowBottom + PANEL_GAP,
    width: size.width,
    height: size.height,
  }
}

function Frame({
  id,
  label,
  panel,
  frames,
  layers,
  onPointerEnter,
  children,
}: {
  id: string
  label: string
  panel: PanelKey
  frames: Map<PanelKey, HTMLElement>
  layers: Map<PanelKey, HTMLElement>
  onPointerEnter?: (e: PointerEvent) => void
  children: ReactNode
}) {
  return (
    <div
      id={id}
      role="region"
      aria-label={label}
      data-panel={panel}
      className={styles.frame}
      onPointerEnter={onPointerEnter}
      ref={(el) => {
        if (el) frames.set(panel, el)
        return () => {
          frames.delete(panel)
        }
      }}
    >
      <div
        className={styles.layer}
        ref={(el) => {
          if (el) layers.set(panel, el)
          return () => {
            layers.delete(panel)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function SiteNav() {
  const reduced = useReducedMotion()
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState<PanelKey | null>(null)
  const [engine] = useState(() => new NavIslandEngine())
  const uid = useId()
  const gooId = `${uid}goo`
  const panelIds: Record<PanelKey, string> = {
    components: `${uid}components`,
    registry: `${uid}registry`,
    menu: `${uid}menu`,
  }

  const rootRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const filterRef = useRef<SVGFilterElement>(null)
  const capsuleEls = useRef<(SVGRectElement | null)[]>([])
  const neckEls = useRef<(SVGRectElement | null)[]>([])
  const dropEls = useRef<(SVGCircleElement | null)[]>([])
  const panelEl = useRef<SVGRectElement>(null)
  const stemEl = useRef<SVGPathElement>(null)
  const [frames] = useState(() => new Map<PanelKey, HTMLElement>())
  const [layers] = useState(() => new Map<PanelKey, HTMLElement>())
  const triggers = useRef(new Map<PanelKey, HTMLButtonElement>())
  const layoutRef = useRef<Layout>(emptyLayout)
  const openRef = useRef<PanelKey | null>(null)
  const shownRef = useRef<PanelKey | null>(null)
  const reducedRef = useRef(reduced)
  const wakeRef = useRef<() => void>(() => {})
  const openTimer = useRef(0)
  const closeTimer = useRef(0)
  const pointerType = useRef('')
  const refocusing = useRef(false)

  useLayoutEffect(() => {
    reducedRef.current = reduced
  })

  useEffect(() => {
    const root = rootRef.current
    const svg = svgRef.current
    if (!root || !svg) return
    let frame = 0
    let last = 0

    const render = () => {
      const layout = layoutRef.current
      const { capsules } = layout
      capsuleEls.current.forEach((el, i) => setRect(el, capsules[i] ?? null, 999))
      dropEls.current.forEach((drop, i) => {
        const a = capsules[i]
        const b = capsules[i + 1]
        const fromEl = neckEls.current[i * 2] ?? null
        const toEl = neckEls.current[i * 2 + 1] ?? null
        const amount = Math.max(0, engine.neck(i))
        if (!a || !b || amount < 0.01) {
          setRect(fromEl, null)
          setRect(toEl, null)
          drop?.setAttribute('r', '0')
          return
        }
        const cy = a.y + a.height / 2
        const gapLeft = a.x + a.width
        const gapRight = b.x
        const x = clamp(engine.dropX, gapLeft - DROP_TRAVEL, gapRight + DROP_TRAVEL)
        const u = (x - gapLeft) / Math.max(1, gapRight - gapLeft)
        const fromH = NECK_MAX * amount * lean(u)
        const toH = NECK_MAX * amount * lean(1 - u)
        const fromX = gapLeft - NECK_OVERLAP
        const toX = gapRight + NECK_OVERLAP
        setRect(
          fromEl,
          { x: fromX, y: cy - fromH / 2, width: Math.max(0, x - fromX), height: fromH },
          fromH / 2,
        )
        setRect(toEl, { x, y: cy - toH / 2, width: Math.max(0, toX - x), height: toH }, toH / 2)
        drop?.setAttribute('cx', String(x + PAD))
        drop?.setAttribute('cy', String(cy + PAD))
        drop?.setAttribute('r', String(DROP_RADIUS * amount))
      })

      const shown = shownRef.current
      const anchor = shown ? layout.anchors[shown] : undefined
      const panel = engine.panel
      let bottom = layout.rowBottom
      let right = Math.max(0, ...capsules.map((c) => c.x + c.width))
      let left = 0
      if (shown && anchor) {
        setRect(panelEl.current, panel, PANEL_RADIUS)
        const room = panel.width / 2 - STEM_FLARE - PANEL_RADIUS / 2
        const want = Math.max(STEM_MIN, anchor.width - anchor.height) / 2
        const half = Math.max(0, Math.min(room, want))
        const reach = half + STEM_FLARE + PANEL_RADIUS / 2
        const cx = Math.max(
          panel.x + reach,
          Math.min(panel.x + panel.width - reach, anchor.x + anchor.width / 2),
        )
        stemEl.current?.setAttribute(
          'd',
          stemPath(cx + PAD, half, anchor.y + anchor.height + PAD, panel.y + PAD),
        )
        bottom = Math.max(bottom, panel.y + panel.height)
        right = Math.max(right, panel.x + panel.width)
        left = Math.min(left, panel.x)
      } else {
        setRect(panelEl.current, null)
        stemEl.current?.setAttribute('d', '')
      }

      svg.style.left = `${left - PAD}px`
      svg.style.top = `${-PAD}px`
      svg.setAttribute('width', String(right - left + PAD * 2))
      svg.setAttribute('height', String(bottom + PAD * 2))
      svg.setAttribute('viewBox', `${left} 0 ${right - left + PAD * 2} ${bottom + PAD * 2}`)
      const filter = filterRef.current
      if (filter) {
        filter.setAttribute('x', String(left))
        filter.setAttribute('width', String(right - left + PAD * 2))
        filter.setAttribute('height', String(bottom + PAD * 2))
      }

      for (const key of PANEL_KEYS) {
        const frameEl = frames.get(key)
        const layerEl = layers.get(key)
        if (!frameEl || !layerEl) continue
        if (key !== shown) {
          frameEl.style.visibility = ''
          layerEl.style.visibility = ''
          layerEl.style.opacity = ''
          continue
        }
        frameEl.style.visibility = 'visible'
        frameEl.style.left = `${panel.x}px`
        frameEl.style.top = `${panel.y}px`
        frameEl.style.width = `${panel.width}px`
        frameEl.style.height = `${panel.height}px`
        frameEl.style.borderRadius = `${Math.min(PANEL_RADIUS, panel.width / 2, panel.height / 2)}px`
        const active = key === openRef.current
        if (!active) {
          layerEl.style.visibility = ''
          layerEl.style.opacity = ''
          layerEl.style.pointerEvents = 'none'
          continue
        }
        const size = layout.sizes[key]
        const f = engine.frame(key)
        layerEl.style.visibility = 'visible'
        layerEl.style.pointerEvents = ''
        layerEl.style.opacity = String(f.opacity)
        if (reducedRef.current || !size) {
          layerEl.style.filter = ''
          layerEl.style.transform = ''
          continue
        }
        const sx = size.width > 0 ? (panel.width / size.width) * f.scale : f.scale
        const sy = size.height > 0 ? (panel.height / size.height) * f.scale : f.scale
        layerEl.style.filter = f.blur > 0.01 ? `blur(${f.blur}px)` : ''
        layerEl.style.transform = `translate(-50%, -50%) scale(${sx}, ${sy})`
      }
    }

    const settle = () => {
      if (engine.idle && openRef.current === null) shownRef.current = null
    }

    const loop = (now: number) => {
      frame = 0
      const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 0
      last = now
      engine.tick(dt)
      settle()
      render()
      if (!engine.idle) frame = requestAnimationFrame(loop)
      else last = 0
    }

    wakeRef.current = () => {
      if (reducedRef.current || document.hidden) {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        last = 0
        engine.finish()
        settle()
        render()
      } else if (!frame && !engine.idle) {
        frame = requestAnimationFrame(loop)
      } else if (!frame) {
        settle()
        render()
      }
    }

    const relayout = () => {
      layoutRef.current = measure(root, layers)
      const key = openRef.current
      if (key && !layoutRef.current.anchors[key]) {
        setOpen(null)
      } else if (key) {
        engine.jumpPanel(openRect(layoutRef.current, key))
      }
      wakeRef.current()
    }

    relayout()
    const resize = new ResizeObserver(relayout)
    for (const el of root.querySelectorAll('[data-capsule]')) resize.observe(el)
    for (const el of layers.values()) resize.observe(el)
    window.addEventListener('resize', relayout)
    document.addEventListener('visibilitychange', wakeRef.current)

    return () => {
      resize.disconnect()
      window.removeEventListener('resize', relayout)
      document.removeEventListener('visibilitychange', wakeRef.current)
      if (frame) cancelAnimationFrame(frame)
      wakeRef.current = () => {}
    }
  }, [engine, frames, layers])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    openRef.current = open
    const layout = measure(root, layers)
    layoutRef.current = layout
    if (open) {
      if (!shownRef.current) engine.jumpPanel(collapsedRect(layout, open))
      shownRef.current = open
      if (engine.layerId !== open) engine.show(open, !reduced)
      const target = openRect(layout, open)
      if (reduced) engine.jumpPanel(target)
      else engine.setPanel(target)
    } else if (shownRef.current) {
      engine.hide()
      engine.setPanel(collapsedRect(layout, shownRef.current))
    }
    wakeRef.current()
  }, [open, reduced, engine, layers])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const root = rootRef.current
      const trigger = triggers.current.get(open)
      setOpen(null)
      const focused = document.activeElement
      if (root && trigger && focused !== trigger && root.contains(focused)) {
        refocusing.current = true
        trigger.focus()
      }
    }
    const onDown = (e: globalThis.PointerEvent) => {
      const root = rootRef.current
      if (root && e.target instanceof Node && !root.contains(e.target)) setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current)
      window.clearTimeout(closeTimer.current)
    },
    [],
  )

  const openNow = (key: PanelKey) => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    setOpen(key)
  }

  const scheduleOpen = (key: PanelKey) => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    if (openRef.current === key) return
    openTimer.current = window.setTimeout(() => openNow(key), OPEN_DELAY)
  }

  const scheduleClose = () => {
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
    if (openRef.current === null) return
    closeTimer.current = window.setTimeout(() => setOpen(null), CLOSE_GRACE)
  }

  const setNecks = (targets: readonly number[], pointerX?: number) => {
    engine.setNecks(targets, pointerX)
    wakeRef.current()
  }

  // Necks grow as the pointer nears a gap, then pinch off
  const onRootMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || reducedRef.current) return
    const { capsules, rootLeft, rowBottom } = layoutRef.current
    const root = rootRef.current
    if (!root) return
    const x = e.clientX - rootLeft
    const y = e.clientY - root.getBoundingClientRect().top
    const inRow = y <= rowBottom + 6
    const targets = [0, 1].map((i) => {
      const a = capsules[i]
      const b = capsules[i + 1]
      if (!a || !b || !inRow) return 0
      const gapLeft = a.x + a.width
      const gapRight = b.x
      const offset = x - (gapLeft + gapRight) / 2
      const outside = Math.max(0, Math.abs(offset) - (gapRight - gapLeft) / 2)
      // Fades out before the pointer reaches either capsule's centre
      const reach = Math.min(NECK_REACH, (offset < 0 ? a.width : b.width) / 2 - 6)
      const t = clamp(1 - outside / Math.max(1, reach), 0, 1)
      return t * t * (3 - 2 * t)
    })
    setNecks(targets, x)
  }

  const onRootEnter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(closeTimer.current)
    onRootMove(e)
  }

  const onRootLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    setNecks([0, 0])
    if (openRef.current !== 'menu') scheduleClose()
  }

  const hoverTrigger = (key: PanelKey) => (e: PointerEvent) => {
    if (e.pointerType === 'mouse') scheduleOpen(key)
  }

  const hoverPlain = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && openRef.current !== 'menu') scheduleClose()
  }

  const enterPanel = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    window.clearTimeout(openTimer.current)
    window.clearTimeout(closeTimer.current)
  }

  const onRootFocus = (e: FocusEvent) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    const trigger = target.closest<HTMLElement>('[data-trigger]')
    const key = PANEL_KEYS.find((k) => k === trigger?.dataset.trigger)
    if (key) {
      if (refocusing.current) refocusing.current = false
      else if (key !== 'menu' && target.matches(':focus-visible')) openNow(key)
      return
    }
    const panel = target.closest<HTMLElement>('[data-panel]')
    if (panel) return
    if (openRef.current && openRef.current !== 'menu') setOpen(null)
  }

  const onRootBlur = (e: FocusEvent) => {
    const next = e.relatedTarget
    const root = rootRef.current
    if (root && next instanceof Node && root.contains(next)) return
    if (next && openRef.current) setOpen(null)
  }

  // Mouse hover already opened it, so a mouse click never closes
  const onTriggerClick = (key: PanelKey) => () => {
    const byMouse = pointerType.current === 'mouse'
    pointerType.current = ''
    if (openRef.current !== key) openNow(key)
    else if (!byMouse || key === 'menu') setOpen(null)
  }

  const onRootClick = (e: MouseEvent) => {
    if (e.target instanceof Element && e.target.closest('[data-panel] a')) setOpen(null)
  }

  const trigger = (key: PanelKey, label: string) => (
    <button
      type="button"
      data-trigger={key}
      aria-expanded={open === key}
      aria-controls={panelIds[key]}
      ref={(el) => {
        if (el) triggers.current.set(key, el)
        return () => {
          triggers.current.delete(key)
        }
      }}
      onPointerEnter={hoverTrigger(key)}
      onPointerDown={(e) => {
        pointerType.current = e.pointerType
      }}
      onClick={onTriggerClick(key)}
      className={`${styles.item} flex h-9 items-center px-4 text-[14px] font-medium`}
    >
      {label}
    </button>
  )

  return (
    <div
      ref={rootRef}
      className={`${styles.nav} pointer-events-auto relative`}
      onPointerEnter={onRootEnter}
      onPointerMove={onRootMove}
      onPointerLeave={onRootLeave}
      onFocus={onRootFocus}
      onBlur={onRootBlur}
      onClick={onRootClick}
    >
      <svg ref={svgRef} aria-hidden="true" className={styles.shapes} width="0" height="0">
        <defs>
          <filter
            ref={filterRef}
            id={gooId}
            filterUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="0"
            height="0"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation={GOO_BLUR} result="blur" />
            <feColorMatrix in="blur" type="matrix" values={GOO_MATRIX} />
          </filter>
        </defs>
        <g filter={`url(#${gooId})`}>
          {[0, 1, 2].map((i) => (
            <rect
              key={`c${i}`}
              ref={(el) => {
                capsuleEls.current[i] = el
              }}
            />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={`n${i}`}
              ref={(el) => {
                neckEls.current[i] = el
              }}
            />
          ))}
          {[0, 1].map((i) => (
            <circle
              key={`d${i}`}
              r={0}
              ref={(el) => {
                dropEls.current[i] = el
              }}
            />
          ))}
          <path ref={stemEl} />
          <rect ref={panelEl} />
        </g>
      </svg>

      <nav aria-label="Primary" className="flex items-center gap-[10px]">
        <Link
          href="/"
          aria-label="UIgrove home"
          data-capsule="brand"
          onPointerEnter={hoverPlain}
          className={`${styles.capsule} ${styles.item} flex h-12 items-center px-5`}
        >
          <Wordmark height={16} />
        </Link>

        <ul
          data-capsule="links"
          className={`${styles.capsule} ${styles.inset} flex h-12 items-center px-2 max-sm:hidden`}
        >
          <li className="flex h-full items-center">
            {trigger('components', 'Components')}
            <Frame
              id={panelIds.components}
              label="Components"
              panel="components"
              frames={frames}
              layers={layers}
              onPointerEnter={enterPanel}
            >
              <ComponentsPanel />
            </Frame>
          </li>
          <li className="flex h-full items-center">
            <span aria-hidden="true" className={styles.divider} />
            {trigger('registry', 'Registry')}
            <Frame
              id={panelIds.registry}
              label="Registry"
              panel="registry"
              frames={frames}
              layers={layers}
              onPointerEnter={enterPanel}
            >
              <RegistryPanel />
            </Frame>
          </li>
          <li className="flex h-full items-center">
            <span aria-hidden="true" className={styles.divider} />
            <a
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              onPointerEnter={hoverPlain}
              className={`${styles.item} flex h-9 items-center px-4 text-[14px] font-medium`}
            >
              GitHub
            </a>
          </li>
        </ul>

        <div
          data-capsule="theme"
          className={`${styles.capsule} ${styles.inset} flex size-12 items-center justify-center max-sm:hidden`}
        >
          <button
            type="button"
            onClick={toggle}
            onPointerEnter={hoverPlain}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className={`${styles.item} flex size-9 items-center justify-center`}
          >
            <ThemeIcon theme={theme} />
          </button>
        </div>

        <div
          data-capsule="menu"
          className={`${styles.capsule} ${styles.inset} flex h-12 items-center px-1.5 sm:hidden`}
        >
          {trigger('menu', 'Menu')}
          <Frame id={panelIds.menu} label="Menu" panel="menu" frames={frames} layers={layers}>
            <MenuPanel />
          </Frame>
        </div>
      </nav>
    </div>
  )
}
