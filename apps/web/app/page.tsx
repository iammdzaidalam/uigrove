import Link from 'next/link'
import { componentMetas } from '@uigrove/components/meta'
import { Hero } from '@/components/hero'
import { Divider } from '@/components/home/divider'
import { Featured } from '@/components/home/featured'
import { Contact } from '@/components/home/contact'
import { HowItWorks } from '@/components/home/how-it-works'
import { Stack } from '@/components/home/stack'

export default function HomePage() {
  return (
    <>
      <Hero />

      <section className="mx-auto w-full max-w-[1280px] px-4 pt-32 pb-24 sm:px-6">
        <div className="mx-auto mb-14 flex max-w-[640px] flex-col items-center gap-4 text-center">
          <h2 className="text-[clamp(34px,5vw,56px)] leading-[1] font-semibold tracking-[-0.045em]">
            {componentMetas.length} components, grown one at a time
          </h2>
          <p className="text-[16px] leading-relaxed text-muted">
            No packages to install at runtime. One command with the shadcn CLI, or copy the source
            and make it yours.
          </p>
        </div>
        <Featured />
        <div className="mt-10 flex justify-center">
          <Link
            href="/components"
            className="flex h-11 items-center gap-2 rounded-full border border-line-strong px-5 text-[13px] font-medium transition-ui hover:bg-surface"
          >
            Explore all {componentMetas.length} components
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 py-24 sm:px-6">
        <div className="mb-12 flex flex-col gap-3">
          <span className="label">How it works</span>
          <h2 className="heading max-w-[18ch] text-[clamp(28px,3.4vw,40px)]">
            Three steps, then it is your code.
          </h2>
        </div>
        <HowItWorks />
      </section>

      <section className="mx-auto w-full max-w-[880px] px-4 py-24 sm:px-6">
        <Divider label="Built with" />
        <Stack />
        <Divider label="Free to use" />
        <p className="pt-10 text-center text-[14px] text-muted">
          Use any component in personal and commercial work. Copy it in and make it yours.
        </p>
      </section>

      <Contact />
    </>
  )
}
