'use client'

import Link from 'next/link'
import { useRef, type PointerEvent } from 'react'
import { defaultsFrom, getComponentMeta } from '@uigrove/components/meta'
import { cardValues } from '../component-bento'
import { withThemeColor } from '../playground/playground-context'
import { ComponentPreview } from '../previews/registry'
import { useTheme } from '../theme'

interface Pick {
  slug: string
  hint: string
  span: string
  values?: Record<string, unknown>
}

const picks: Pick[] = [
  { slug: 'dithered-logo', hint: 'move cursor', span: 'lg:col-span-4' },
  { slug: 'circular-gallery', hint: 'scroll', span: 'lg:col-span-5' },
  { slug: 'gooey-effect', hint: 'drag', span: 'lg:col-span-3' },
  {
    slug: 'devouring-sign-in',
    hint: 'type & enter',
    span: 'lg:col-span-7',
    values: { fontSize: 44 },
  },
  { slug: 'wheel-carousel', hint: 'drag', span: 'lg:col-span-5' },
  { slug: 'ascii-effect', hint: 'move cursor', span: 'lg:col-span-4', values: { cellSize: 8 } },
  { slug: 'expand-on-hover', hint: 'hover', span: 'lg:col-span-8' },
]

export function Featured() {
  const { fg } = useTheme()
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
      {picks.map((pick) => {
        const meta = getComponentMeta(pick.slug)
        if (!meta) return null
        const values = {
          ...withThemeColor(defaultsFrom(meta), meta, fg),
          ...cardValues[meta.name],
          ...pick.values,
        }
        return (
          <li key={pick.slug} className={pick.span}>
            <FeatureCard slug={pick.slug} title={meta.title} hint={pick.hint} values={values} />
          </li>
        )
      })}
    </ul>
  )
}

interface FeatureCardProps {
  slug: string
  title: string
  hint: string
  values: Record<string, unknown>
}

function FeatureCard({ slug, title, hint, values }: FeatureCardProps) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
  }
  return (
    <div className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-2 transition-ui hover:border-line-strong">
      <div className="relative h-[300px] overflow-hidden rounded-xl bg-bg" onPointerDown={onDown}>
        <ComponentPreview slug={slug} values={values} />
      </div>
      <Link
        href={`/components/${slug}`}
        className="flex items-center justify-between gap-3 px-2 pt-3 pb-1.5"
      >
        <span className="text-[14px] font-medium tracking-[-0.01em]">{title}</span>
        <span className="flex items-center gap-3">
          <span className="label">[ {hint} ]</span>
          <span
            aria-hidden="true"
            className="text-muted transition-ui group-hover:translate-x-0.5 group-hover:text-fg"
          >
            →
          </span>
        </span>
      </Link>
    </div>
  )
}
