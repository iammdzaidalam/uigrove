'use client'

import { useSyncExternalStore } from 'react'
import { CopyButton } from './copy-button'

const managers = [
  { id: 'pnpm', prefix: 'pnpm dlx shadcn@latest add' },
  { id: 'npm', prefix: 'npx shadcn@latest add' },
  { id: 'yarn', prefix: 'yarn dlx shadcn@latest add' },
  { id: 'bun', prefix: 'bunx --bun shadcn@latest add' },
] as const

type Manager = (typeof managers)[number]['id']

const storageKey = 'uigrove-pm'
const listeners = new Set<() => void>()

function isManager(value: unknown): value is Manager {
  return managers.some((m) => m.id === value)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): Manager {
  try {
    const saved = localStorage.getItem(storageKey)
    return isManager(saved) ? saved : 'pnpm'
  } catch {
    return 'pnpm'
  }
}

function getServerSnapshot(): Manager {
  return 'pnpm'
}

function chooseManager(next: Manager) {
  try {
    localStorage.setItem(storageKey, next)
  } catch {}
  for (const listener of listeners) listener()
}

function useManager() {
  const manager = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [manager, chooseManager] as const
}

function commandFor(manager: Manager, slug: string) {
  const entry = managers.find((m) => m.id === manager) ?? managers[0]
  return `${entry.prefix} @uigrove/${slug}`
}

const registryConfig = `{
  "registries": {
    "@uigrove": "https://uigrove.me/r/{name}.json"
  }
}`

export function InstallCommand({
  slug,
  registryDependencies = [],
}: {
  slug: string
  registryDependencies?: readonly string[]
}) {
  const [manager, choose] = useManager()
  const command = commandFor(manager, slug)
  return (
    <div className="flex flex-col gap-3">
      <span className="label">Installation</span>
      <div
        role="radiogroup"
        aria-label="Package manager"
        className="flex w-fit rounded-md border border-line p-0.5"
      >
        {managers.map((m) => {
          const active = m.id === manager
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(m.id)}
              className={[
                'rounded-[5px] px-2.5 py-1 font-mono text-[12px] transition-ui',
                active ? 'bg-surface-strong text-fg' : 'text-muted hover:text-fg',
              ].join(' ')}
            >
              {m.id}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-line pr-2 pl-5">
        <code className="truncate py-3 text-[13px]">{command}</code>
        <CopyButton text={command} />
      </div>
      <p className="text-[13px] text-muted">
        Dependencies: none.
        {registryDependencies.length > 0
          ? ` Installs ${registryDependencies.join(', ')} alongside.`
          : ''}
      </p>
      <details className="group text-[13px] text-muted">
        <summary className="cursor-pointer list-none py-1 transition-ui hover:text-fg">
          First time? Add the registry to components.json
        </summary>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-line px-5 py-4 font-mono text-[12px] leading-relaxed text-fg">
          {registryConfig}
        </pre>
      </details>
    </div>
  )
}

export function InstallPill({ slug }: { slug: string }) {
  const [manager, choose] = useManager()
  const command = commandFor(manager, slug)
  return (
    <div className="flex max-w-[calc(100vw-48px)] items-center gap-1 rounded-lg border border-line bg-bg/90 py-1 pr-1 pl-2">
      <select
        value={manager}
        onChange={(e) => choose(e.target.value as Manager)}
        aria-label="Package manager"
        className="appearance-none rounded-md bg-transparent px-1.5 py-1 font-mono text-[12px] text-muted outline-none transition-ui hover:text-fg"
      >
        {managers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id}
          </option>
        ))}
      </select>
      <span aria-hidden="true" className="h-4 w-px bg-line-strong" />
      <code className="truncate px-2 font-mono text-[12px] text-fg">{command}</code>
      <CopyButton text={command} />
    </div>
  )
}
