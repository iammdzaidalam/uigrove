'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { MouseEvent } from 'react'
import type { AnyComponentMeta } from '@uigrove/components/meta'
import { defaultsFrom } from '@uigrove/components/meta'
import { DemoPreview } from './demo-preview'
import { withThemeColor } from './playground/playground-context'
import { useTheme } from './theme'

const spans = [
  'lg:col-span-4',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-2',
  'lg:col-span-3',
  'lg:col-span-3',
]

// Smaller settings so tall components fit a card
export const cardValues: Record<string, Record<string, unknown>> = {
  'wheel-carousel': { radius: 200, photoWidth: 150, labelSize: 18, visibleItems: 5 },
  'scroll-surf': { cardWidth: 200, depth: 300, spread: 160 },
  'dot-matrix-text': { fontSize: 88 },
  'ink-bleed': { fontSize: 84 },
  'dithered-logo': { scale: 0.8 },
  'spine-gallery': { expandedSize: 240, labelSize: 16, collapsedSize: 36 },
  'vector-wordmark': { intro: false, labels: false },
  'circular-gallery': { autoplay: true },
  'orbit-tiles': { radiusX: 260, radiusY: 120, tileWidth: 110, tileHeight: 140 },
  // Caption rows plus a 324px card overflow 300px and squash the viewport
  'lens-carousel': {
    cardHeight: 212,
    cardWidth: 170,
    gap: 28,
    lensWidth: 190,
    showCaption: false,
  },
}

const interactive = 'a, button, input, textarea, select, [role="button"], [role="slider"]'

export function ComponentBento({
  metas,
  visible,
}: {
  metas: readonly AnyComponentMeta[]
  // Hidden cards stay mounted so their previews keep their GPU contexts
  visible?: ReadonlySet<string>
}) {
  const { fg } = useTheme()
  const router = useRouter()
  let order = 0
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {metas.map((meta) => {
        const shown = !visible || visible.has(meta.name)
        const i = shown ? order++ : 0
        const href = `/components/${meta.name}`
        const values = { ...withThemeColor(defaultsFrom(meta), meta, fg), ...cardValues[meta.name] }
        // Card clicks navigate unless they hit the preview's own controls
        const onClick = (e: MouseEvent<HTMLDivElement>) => {
          if (e.target instanceof Element && e.target.closest(interactive)) return
          router.push(href)
        }
        return (
          <li key={meta.name} hidden={!shown} className={spans[i % spans.length]}>
            <div
              onClick={onClick}
              className="group relative isolate block h-[300px] cursor-pointer overflow-hidden rounded-xl border border-line bg-bg transition-ui hover:border-line-strong"
            >
              <DemoPreview slug={meta.name} values={values} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                <Link
                  href={href}
                  className="pointer-events-auto rounded-md bg-bg/85 px-2.5 py-1.5 text-[13px] font-medium tracking-[-0.01em] text-fg"
                >
                  {meta.title}
                </Link>
                <span className="label rounded-md bg-bg/85 px-2 py-1.5 opacity-0 transition-ui group-hover:opacity-100">
                  {meta.category}
                </span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
