'use client'

import {
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  expandOnHoverVerticalClamp,
  expandOnHoverVerticalStep,
  expandOnHoverVerticalTransition,
  type ExpandOnHoverVerticalEasing,
} from './expand-on-hover-vertical.engine'

export interface ExpandOnHoverVerticalItem {
  label: string
  image: string
  alt?: string
  href?: string
}

export interface ExpandOnHoverVerticalOptions {
  expandedSize: number
  collapsedSize: number
  width: number
  gap: number
  radius: number
  duration: number
  easing: ExpandOnHoverVerticalEasing
  defaultIndex: number
  expandOn: 'hover' | 'click'
  showLabels: boolean
}

export interface ExpandOnHoverVerticalProps extends Partial<ExpandOnHoverVerticalOptions> {
  items: ExpandOnHoverVerticalItem[]
  onExpand?: (index: number) => void
  className?: string
  style?: CSSProperties
}

export const expandOnHoverVerticalDefaults: ExpandOnHoverVerticalOptions = {
  expandedSize: 384,
  collapsedSize: 40,
  width: 384,
  gap: 4,
  radius: 24,
  duration: 300,
  easing: 'ease-in-out',
  defaultIndex: 1,
  expandOn: 'hover',
  showLabels: true,
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const SIZE_PROPS = ['height'] as const
const FADE_PROPS = ['opacity', 'transform'] as const

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

export function ExpandOnHoverVertical({
  items,
  expandedSize = expandOnHoverVerticalDefaults.expandedSize,
  collapsedSize = expandOnHoverVerticalDefaults.collapsedSize,
  width = expandOnHoverVerticalDefaults.width,
  gap = expandOnHoverVerticalDefaults.gap,
  radius = expandOnHoverVerticalDefaults.radius,
  duration = expandOnHoverVerticalDefaults.duration,
  easing = expandOnHoverVerticalDefaults.easing,
  defaultIndex = expandOnHoverVerticalDefaults.defaultIndex,
  expandOn = expandOnHoverVerticalDefaults.expandOn,
  showLabels = expandOnHoverVerticalDefaults.showLabels,
  onExpand,
  className,
  style,
}: ExpandOnHoverVerticalProps) {
  const count = items.length
  const reduced = useReducedMotion()
  const [active, setActive] = useState(defaultIndex)
  const [seenDefault, setSeenDefault] = useState(defaultIndex)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  if (seenDefault !== defaultIndex) {
    setSeenDefault(defaultIndex)
    setActive(defaultIndex)
  }
  const current = expandOnHoverVerticalClamp(active, count)
  const ms = reduced ? 0 : duration
  const sizeTransition = expandOnHoverVerticalTransition(SIZE_PROPS, ms, easing)
  const fadeTransition = expandOnHoverVerticalTransition(FADE_PROPS, ms, easing)

  const select = (index: number) => {
    if (index === current) return
    setActive(index)
    onExpand?.(index)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = expandOnHoverVerticalStep(e.key, current, count)
    if (next === null) return
    e.preventDefault()
    select(next)
    itemRefs.current[next]?.focus()
  }

  return (
    <div
      role="group"
      aria-label="Expandable gallery"
      className={[
        'uig-expand-on-hover-vertical',
        'flex flex-col items-center justify-center',
        className,
      ]
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
            className="uig-expand-on-hover-vertical__item relative block min-h-0 cursor-pointer overflow-hidden p-0 select-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
            style={{
              height: expanded ? expandedSize : collapsedSize,
              width,
              maxWidth: '100%',
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
              className="uig-expand-on-hover-vertical__image block h-full w-full object-cover"
            />
            {showLabels && (
              <span
                aria-hidden="true"
                className="uig-expand-on-hover-vertical__label absolute right-4 bottom-5 text-xs whitespace-nowrap"
                style={{
                  opacity: expanded ? 0.7 : 0,
                  transform: expanded ? 'none' : 'translateY(8px)',
                  transition: fadeTransition,
                }}
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
