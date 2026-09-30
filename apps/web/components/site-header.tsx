import { SiteNav } from './nav/site-nav'

export function SiteHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-center px-4">
      <SiteNav />
    </header>
  )
}
