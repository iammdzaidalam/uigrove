export type PillNavPosition = 'fixed' | 'absolute' | 'static'

export interface PillNavEntry {
  label: string
  href?: string
  description?: string
  external?: boolean
}

export interface PillNavCommand {
  id: string
  label: string
  href: string
  external: boolean
  keywords: string
}

export interface PillNavCommandGroup {
  title: string
  commands: PillNavCommand[]
}

export interface PillNavState {
  menu: boolean
  palette: boolean
}

export type PillNavEvent =
  'toggle-menu' | 'close-menu' | 'open-palette' | 'toggle-palette' | 'close-palette'

export const pillNavPositions = ['fixed', 'absolute', 'static'] as const

export const pillNavEase = {
  expand: 'cubic-bezier(0, 0, 0.58, 1)',
  gap: 'cubic-bezier(0.25, 0.1, 0.35, 1)',
  dialog: 'ease',
  press: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const

export const pillNavTiming = {
  dialog: 200,
  overlay: 150,
  press: 150,
  gapClosed: 3,
  gapOpen: 8,
  inset: 8,
} as const

export const pillNavInitialState: PillNavState = { menu: false, palette: false }

// The palette always opens over a collapsed menu
export function pillNavReduce(state: PillNavState, event: PillNavEvent): PillNavState {
  switch (event) {
    case 'toggle-menu':
      return { menu: !state.menu, palette: false }
    case 'close-menu':
      return state.menu ? { ...state, menu: false } : state
    case 'open-palette':
      return state.palette && !state.menu ? state : { menu: false, palette: true }
    case 'toggle-palette':
      return state.palette ? { ...state, palette: false } : { menu: false, palette: true }
    case 'close-palette':
      return state.palette ? { ...state, palette: false } : state
  }
}

export function pillNavClosedHeight(barHeight: number) {
  return pillNavTiming.inset + barHeight + 1
}

export function pillNavTransition(duration: number) {
  if (duration <= 0) return 'none'
  return [
    `height ${duration}ms ${pillNavEase.expand}`,
    `transform ${duration}ms ${pillNavEase.expand}`,
  ].join(', ')
}

export function pillNavGapTransition(duration: number) {
  return duration <= 0 ? 'none' : `gap ${duration}ms ${pillNavEase.gap}`
}

// Hides after a downward run, shows on any upward run
export class PillNavScroll {
  private anchor = 0
  private hidden = false
  private threshold: number
  private tolerance: number

  constructor(threshold: number, tolerance = 6) {
    this.threshold = threshold
    this.tolerance = tolerance
  }

  setThreshold(threshold: number) {
    this.threshold = threshold
  }

  reset(y = 0) {
    this.anchor = y
    this.hidden = false
  }

  update(y: number) {
    const delta = y - this.anchor
    if (y <= this.threshold) {
      this.hidden = false
      this.anchor = y
    } else if (delta > this.tolerance) {
      this.hidden = true
      this.anchor = y
    } else if (delta < -this.tolerance) {
      this.hidden = false
      this.anchor = y
    }
    return this.hidden
  }
}

export function pillNavCommands(
  sections: { title: string; items: PillNavEntry[] }[],
  links: PillNavEntry[],
  linksTitle = 'Links',
): PillNavCommandGroup[] {
  const seen = new Set<string>()
  const groups: PillNavCommandGroup[] = []
  const collect = (title: string, items: PillNavEntry[]) => {
    const commands: PillNavCommand[] = []
    for (const item of items) {
      if (!item.href || seen.has(item.href)) continue
      seen.add(item.href)
      commands.push({
        id: `${groups.length}-${commands.length}`,
        label: item.label,
        href: item.href,
        external: item.external ?? isExternal(item.href),
        keywords: [item.label, item.description ?? '', item.href, title].join(' ').toLowerCase(),
      })
    }
    if (commands.length > 0) groups.push({ title, commands })
  }
  for (const section of sections) collect(section.title, section.items)
  collect(linksTitle, links)
  return groups
}

// Label prefix beats label substring beats keyword substring
function score(command: PillNavCommand, query: string) {
  const label = command.label.toLowerCase()
  if (label.startsWith(query)) return 3
  if (label.includes(query)) return 2
  if (command.keywords.includes(query)) return 1
  return 0
}

export function pillNavFilter(groups: PillNavCommandGroup[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return groups
  const out: PillNavCommandGroup[] = []
  for (const group of groups) {
    const ranked = group.commands
      .map((command, index) => ({ command, index, rank: score(command, q) }))
      .filter((entry) => entry.rank > 0)
      .sort((a, b) => b.rank - a.rank || a.index - b.index)
      .map((entry) => entry.command)
    if (ranked.length > 0) out.push({ title: group.title, commands: ranked })
  }
  return out
}

export function pillNavStep(key: string, index: number, count: number): number | null {
  if (count === 0) return null
  if (key === 'ArrowDown') return Math.min(index + 1, count - 1)
  if (key === 'ArrowUp') return Math.max(index - 1, 0)
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

export function isExternal(href: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('/')
}

export function pillNavDialogFrames(open: boolean): Keyframe[] {
  const hidden = { opacity: 0, transform: 'scale(0.95)' }
  const shown = { opacity: 1, transform: 'scale(1)' }
  return open ? [hidden, shown] : [shown, hidden]
}
