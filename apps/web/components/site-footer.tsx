import Link from 'next/link'
import { componentMetas } from '@uigrove/components/meta'
import { Lockup } from './lockup'

const authorUrl = 'https://github.com/iammdzaidalam'
const sorted = [...componentMetas].sort((a, b) => a.title.localeCompare(b.title))

export function SiteFooter() {
  return (
    <footer className="overflow-hidden border-t border-line">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-14 px-4 pt-16 sm:px-6">
        <nav aria-label="All components" className="flex flex-col gap-6">
          <span className="label">
            Components <span className="ml-2 text-faint">{componentMetas.length}</span>
          </span>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
            {sorted.map((meta) => (
              <li key={meta.name}>
                <Link
                  href={`/components/${meta.name}`}
                  className="text-[14px] text-muted transition-ui hover:text-fg"
                >
                  {meta.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[13px] text-muted">
            © 2026 UIgrove. Built by{' '}
            <a
              href={authorUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Zaid Alam on GitHub"
              className="group inline-flex items-baseline gap-1.5 font-semibold text-fg"
            >
              <span className="underline-offset-4 group-hover:underline">Zaid Alam</span>
              <span
                aria-hidden="true"
                className="-translate-x-1 font-mono text-[11px] font-normal text-muted opacity-0 transition-ui group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
              >
                @iammdzaidalam &#8599;
              </span>
            </a>
          </span>
          <div className="flex items-center gap-6">
            <Link href="/components" className="label transition-ui hover:text-fg">
              Components
            </Link>
            <a
              href="/r/registry.json"
              target="_blank"
              className="label transition-ui hover:text-fg"
            >
              Registry
            </a>
            <a
              href={authorUrl}
              target="_blank"
              rel="noreferrer"
              className="label transition-ui hover:text-fg"
            >
              GitHub
            </a>
          </div>
        </div>
      </div>

      <div className="w-full pt-14">
        <Lockup />
      </div>
    </footer>
  )
}
