import type { Metadata } from 'next'
import { componentMetas } from '@uigrove/components/meta'
import { ComponentsBrowser } from '@/components/components-browser'

export const metadata: Metadata = {
  title: 'Components',
  description: 'Every UIgrove component with a live preview.',
}

export default function ComponentsPage() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-4 pt-32 pb-16 sm:px-6">
      <div className="mb-14 flex flex-col gap-3">
        <span className="label">Components</span>
        <h1 className="heading text-[40px]">All {componentMetas.length} components</h1>
        <p className="max-w-[52ch] text-muted">
          Backgrounds, text, effects, media, galleries and navigation that share one look. Each one
          ships as a few files with zero runtime dependencies.
        </p>
      </div>
      <ComponentsBrowser />
    </section>
  )
}
