'use client'

import Link from 'next/link'
import { componentMetas, type ComponentCategory } from '@uigrove/components/meta'
import { CopyButton } from '../copy-button'
import { ThemeIcon } from '../theme-icon'
import { useTheme } from '../theme'

export const githubUrl = 'https://github.com/iammdzaidalam'

const categoryOrder: readonly ComponentCategory[] = [
  'backgrounds',
  'text',
  'effects',
  'media',
  'galleries',
  'navigation',
]

const featuredSlugs = [
  'dot-grid',
  'gooey-dots',
  'dot-matrix-text',
  'dynamic-island',
  'lens-carousel',
  'image-wheel-3d',
]

const categories = categoryOrder
  .map((name) => {
    const members = componentMetas.filter((m) => m.category === name)
    return { name, count: members.length }
  })
  .filter((c) => c.count > 0)

const featured = featuredSlugs.flatMap((slug) => {
  const meta = componentMetas.find((m) => m.name === slug)
  return meta ? [{ slug, title: meta.title, category: meta.category }] : []
})

const registryConfig = `{
  "registries": {
    "@uigrove": "https://uigrove.me/r/{name}.json"
  }
}`

const installCommand = 'npx shadcn@latest add @uigrove/dot-grid'

const rowLink =
  'flex h-9 items-center justify-between gap-4 rounded-[10px] px-3 text-[14px] font-medium text-fg/85 transition-ui hover:bg-surface-strong hover:text-fg'

export function ComponentsPanel() {
  return (
    <div className="flex w-[min(560px,calc(100vw-32px))] flex-col p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-2">
        <div className="flex flex-col gap-1">
          <span className="label px-3 pt-3 pb-2">Categories</span>
          <ul className="flex flex-col">
            {categories.map((c) => (
              <li key={c.name}>
                <Link href={`/components#${c.name}`} className={rowLink}>
                  <span className="capitalize">{c.name}</span>
                  <span className="font-mono text-[12px] text-muted">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-1">
          <span className="label px-3 pt-3 pb-2">Featured</span>
          <ul className="flex flex-col">
            {featured.map((f) => (
              <li key={f.slug}>
                <Link href={`/components/${f.slug}`} className={rowLink}>
                  <span className="truncate">{f.title}</span>
                  <span className="label shrink-0">{f.category}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Link
        href="/components"
        className="mt-2 flex h-11 items-center justify-between rounded-[14px] border border-line px-4 text-[14px] font-medium text-fg/85 transition-ui hover:bg-surface-strong hover:text-fg"
      >
        View all {componentMetas.length} components
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </div>
  )
}

export function RegistryPanel() {
  return (
    <div className="flex w-[min(460px,calc(100vw-32px))] flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="label">Add to components.json</span>
        <CopyButton text={registryConfig} />
      </div>
      <pre className="overflow-x-auto rounded-[12px] border border-line px-4 py-3 font-mono text-[12px] leading-relaxed text-fg">
        {registryConfig}
      </pre>
      <span className="label pt-1">Then install any component</span>
      <div className="flex items-center justify-between gap-2 rounded-[12px] border border-line pr-1.5 pl-4">
        <code className="truncate py-2.5 text-[12px] text-fg">{installCommand}</code>
        <CopyButton text={installCommand} />
      </div>
    </div>
  )
}

export function MenuPanel() {
  const { theme, toggle } = useTheme()
  return (
    <div className="flex w-[min(400px,calc(100vw-32px))] flex-col gap-2 p-2">
      <ul className="flex flex-col">
        <li>
          <Link href="/components" className={`${rowLink} h-11`}>
            Components
            <span className="font-mono text-[12px] text-muted">{componentMetas.length}</span>
          </Link>
        </li>
        {featured.slice(0, 4).map((f) => (
          <li key={f.slug}>
            <Link href={`/components/${f.slug}`} className={`${rowLink} h-11 pl-6 text-fg/70`}>
              {f.title}
            </Link>
          </li>
        ))}
        <li>
          <a href={githubUrl} target="_blank" rel="noreferrer" className={`${rowLink} h-11`}>
            GitHub
            <span aria-hidden="true" className="text-muted">
              &#8599;
            </span>
          </a>
        </li>
      </ul>
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line py-1 pr-1 pl-3">
        <span className="label">Registry config</span>
        <CopyButton text={registryConfig} />
      </div>
      <button
        type="button"
        onClick={toggle}
        className="flex h-11 items-center justify-between rounded-[12px] border border-line px-3 text-[14px] font-medium text-fg/85 transition-ui hover:bg-surface-strong hover:text-fg"
      >
        {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        <ThemeIcon theme={theme} />
      </button>
    </div>
  )
}
