'use client'

import {
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import {
  LINE_HEIGHT,
  spineGalleryClamp,
  spineGalleryRail,
  spineGalleryStep,
  spineGalleryTransition,
  spineGalleryWidth,
  type SpineGalleryEasing,
} from './spine-gallery.engine'

export interface SpineGalleryItem {
  label: string
  year?: string
  image?: string
  alt?: string
  href?: string
}

export interface SpineGalleryOptions {
  expandedSize: number
  collapsedSize: number
  labelSize: number
  radius: number
  duration: number
  easing: SpineGalleryEasing
  defaultIndex: number
  expandOn: 'hover' | 'click'
  showImages: boolean
  mutedOpacity: number
  lineOpacity: number
}

export interface SpineGalleryProps extends Partial<SpineGalleryOptions> {
  items: SpineGalleryItem[]
  onExpand?: (index: number) => void
  className?: string
  style?: CSSProperties
}

export const spineGalleryDefaults: SpineGalleryOptions = {
  expandedSize: 448,
  collapsedSize: 64,
  labelSize: 28,
  radius: 12,
  duration: 400,
  easing: 'spring',
  defaultIndex: 0,
  expandOn: 'hover',
  showImages: true,
  mutedOpacity: 0.3,
  lineOpacity: 0.3,
}

const MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const SIZE_PROPS = ['width'] as const
const FADE_PROPS = ['opacity', 'transform'] as const
const INSET_RATIO = 0.65
const YEAR_GAP_RATIO = 0.7

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

export function SpineGallery({
  items,
  expandedSize = spineGalleryDefaults.expandedSize,
  collapsedSize = spineGalleryDefaults.collapsedSize,
  labelSize = spineGalleryDefaults.labelSize,
  radius = spineGalleryDefaults.radius,
  duration = spineGalleryDefaults.duration,
  easing = spineGalleryDefaults.easing,
  defaultIndex = spineGalleryDefaults.defaultIndex,
  expandOn = spineGalleryDefaults.expandOn,
  showImages = spineGalleryDefaults.showImages,
  mutedOpacity = spineGalleryDefaults.mutedOpacity,
  lineOpacity = spineGalleryDefaults.lineOpacity,
  onExpand,
  className,
  style,
}: SpineGalleryProps) {
  const count = items.length
  const reduced = useReducedMotion()
  const [active, setActive] = useState(defaultIndex)
  const [seenDefault, setSeenDefault] = useState(defaultIndex)
  const itemRefs = useRef<(HTMLElement | null)[]>([])
  if (seenDefault !== defaultIndex) {
    setSeenDefault(defaultIndex)
    setActive(defaultIndex)
  }
  const current = spineGalleryClamp(active, count)
  const ms = reduced ? 0 : duration
  const sizeTransition = spineGalleryTransition(SIZE_PROPS, ms, easing)
  const fadeTransition = spineGalleryTransition(FADE_PROPS, ms, easing)
  const inset = Math.round(labelSize * INSET_RATIO)
  const rail = spineGalleryRail(labelSize, collapsedSize)
  const lineColor = `color-mix(in srgb, currentColor ${Math.round(lineOpacity * 100)}%, transparent)`

  const select = (index: number) => {
    if (index === current) return
    setActive(index)
    onExpand?.(index)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next = spineGalleryStep(e.key, current, count)
    if (next === null) return
    e.preventDefault()
    select(next)
    itemRefs.current[next]?.focus()
  }

  return (
    <div
      role="group"
      aria-label="Expandable columns"
      className={['uig-spine-gallery', 'flex items-stretch overflow-hidden', className]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onKeyDown={onKeyDown}
    >
      {items.map((item, index) => {
        const expanded = index === current
        const Tag = item.href ? 'a' : 'button'
        return (
          <Tag
            key={`${item.label}-${index}`}
            ref={(element: HTMLElement | null) => {
              itemRefs.current[index] = element
            }}
            href={item.href}
            type={item.href ? undefined : 'button'}
            aria-expanded={expanded}
            aria-label={item.label}
            tabIndex={expanded ? 0 : -1}
            className="uig-spine-gallery__item relative box-border block min-w-0 shrink-0 cursor-pointer overflow-hidden border-r p-0 text-left select-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current"
            style={{
              width: spineGalleryWidth(expanded, expandedSize, collapsedSize, count),
              borderColor: lineColor,
              transition: sizeTransition,
            }}
            onMouseEnter={expandOn === 'hover' ? () => select(index) : undefined}
            onFocus={expandOn === 'hover' ? () => select(index) : undefined}
            onClick={() => select(index)}
          >
            {showImages && item.image && (
              <span
                aria-hidden="true"
                className="uig-spine-gallery__figure pointer-events-none absolute inset-0 block"
                style={{
                  padding: inset,
                  paddingLeft: rail.imageLeft,
                  opacity: expanded ? 1 : 0,
                  transition: fadeTransition,
                }}
              >
                <img
                  src={item.image}
                  alt={item.alt ?? ''}
                  draggable={false}
                  className="uig-spine-gallery__image block h-full w-full object-cover"
                  style={{ borderRadius: radius }}
                />
              </span>
            )}
            <span
              aria-hidden="true"
              className="uig-spine-gallery__text absolute flex rotate-180 justify-between font-medium tracking-[-0.03em] whitespace-nowrap [text-orientation:sideways] [writing-mode:vertical-rl]"
              style={{
                top: inset,
                bottom: inset,
                left: rail.left,
                fontSize: labelSize,
                lineHeight: LINE_HEIGHT,
                paddingBottom: Math.round(labelSize * YEAR_GAP_RATIO),
              }}
            >
              <span
                className="uig-spine-gallery__label block"
                style={{ opacity: expanded ? 1 : mutedOpacity, transition: fadeTransition }}
              >
                {item.label}
              </span>
              {item.year && (
                <span
                  className="uig-spine-gallery__year block"
                  style={{
                    opacity: expanded ? 1 : 0,
                    transform: expanded ? 'none' : 'translateY(12px)',
                    transition: fadeTransition,
                  }}
                >
                  {item.year}
                </span>
              )}
            </span>
          </Tag>
        )
      })}
    </div>
  )
}
