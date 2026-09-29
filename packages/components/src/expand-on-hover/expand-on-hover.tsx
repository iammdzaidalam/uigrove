'use client'

import {
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  expandOnHoverClamp,
  expandOnHoverStep,
  expandOnHoverTransition,
  type ExpandOnHoverEasing,
} from './expand-on-hover.engine'

export interface ExpandOnHoverItem {
  label: string
  image: string
  alt?: string
  href?: string
}

export interface ExpandOnHoverOptions {
  expandedSize: number
  collapsedSize: number
  height: number
  gap: number
  radius: number
  duration: number
  easing: ExpandOnHoverEasing
  defaultIndex: number
  expandOn: 'hover' | 'click'
  showLabels: boolean
}

export interface ExpandOnHoverProps extends Partial<ExpandOnHoverOptions> {
  items: ExpandOnHoverItem[]
  onExpand?: (index: number) => void
  className?: string
  style?: CSSProperties
}

export const expandOnHoverDefaults: ExpandOnHoverOptions = {
  expandedSize: 384,
  collapsedSize: 80,
  height: 384,
  gap: 4,
  radius: 24,
  duration: 300,
  easing: 'ease-in-out',
  defaultIndex: 1,
  expandOn: 'hover',
  showLabels: true,
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const SIZE_PROPS = ['width'] as const
const FADE_PROPS = ['opacity'] as const

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

export function ExpandOnHover({
  items,
  expandedSize = expandOnHoverDefaults.expandedSize,
  collapsedSize = expandOnHoverDefaults.collapsedSize,
  height = expandOnHoverDefaults.height,
  gap = expandOnHoverDefaults.gap,
  radius = expandOnHoverDefaults.radius,
  duration = expandOnHoverDefaults.duration,
  easing = expandOnHoverDefaults.easing,
  defaultIndex = expandOnHoverDefaults.defaultIndex,
  expandOn = expandOnHoverDefaults.expandOn,
  showLabels = expandOnHoverDefaults.showLabels,
  onExpand,
  className,
  style,
}: ExpandOnHoverProps) {
  const count = items.length
  const reduced = useReducedMotion()
  const [active, setActive] = useState(defaultIndex)
  const [seenDefault, setSeenDefault] = useState(defaultIndex)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  if (seenDefault !== defaultIndex) {
    setSeenDefault(defaultIndex)
    setActive(defaultIndex)
  }
  const current = expandOnHoverClamp(active, count)
  const ms = reduced ? 0 : duration
  const sizeTransition = expandOnHoverTransition(SIZE_PROPS, ms, easing)
  const fadeTransition = expandOnHoverTransition(FADE_PROPS, ms, easing)

  const select = (index: number) => {
    if (index === current) return
    setActive(index)
    onExpand?.(index)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = expandOnHoverStep(e.key, current, count)
    if (next === null) return
    e.preventDefault()
    select(next)
    itemRefs.current[next]?.focus()
  }

  return (
    <div
      role="group"
      aria-label="Expandable gallery"
      className={['uig-expand-on-hover', 'flex items-center justify-center', className]
        .filter(Boolean)
        .join(' ')}
      style={{ gap, ...style }}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => {
        const expanded = index === current
        const Tag = item.href ? 'a' : 'button'
        return (
          <Tag
            key={`${item.image}-${index}`}
            ref={(element: HTMLElement | null) => {
              itemRefs.current[index] = element
            }}
            href={item.href}
            type={item.href ? undefined : 'button'}
            aria-expanded={expanded}
            aria-label={item.label}
            tabIndex={expanded ? 0 : -1}
            className="uig-expand-on-hover__item relative block min-w-0 cursor-pointer overflow-hidden p-0 select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
            style={{
              width: expanded ? expandedSize : collapsedSize,
              height,
              borderRadius: radius,
              transition: sizeTransition,
            }}
            onMouseEnter={expandOn === 'hover' ? () => select(index) : undefined}
            onFocus={expandOn === 'hover' ? () => select(index) : undefined}
            onClick={() => select(index)}
          >
            <img
              src={item.image}
              alt={item.alt ?? ''}
              draggable={false}
              className="uig-expand-on-hover__image block h-full w-full object-cover"
            />
            {showLabels && (
              <span
                aria-hidden="true"
                className="uig-expand-on-hover__label absolute right-4 bottom-4 text-xs whitespace-nowrap"
                style={{ opacity: expanded ? 0.7 : 0, transition: fadeTransition }}
              >
                {item.label}
              </span>
            )}
          </Tag>
        )
      })}
    </div>
  )
}
