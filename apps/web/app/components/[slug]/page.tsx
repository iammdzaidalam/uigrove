import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { componentMetas, getComponentMeta } from '@uigrove/components/meta'
import { CodeTabs, type HighlightedVariants, type VariantKey } from '@/components/code-tabs'
import { ComponentSidebar } from '@/components/component-sidebar'
import { InstallCommand } from '@/components/install-command'
import { PlaygroundProvider } from '@/components/playground/playground-context'
import { PreviewPanel } from '@/components/playground/preview-panel'
import { UsageSnippet } from '@/components/playground/usage-snippet'
import { PropsTable } from '@/components/props-table'
import { highlight, type CodeLang } from '@/lib/highlight'
import variants from '@/generated/variants.json'

type Params = { slug: string }

interface VariantFile {
  name: string
  lang: string
  code: string
}

const variantKeys: VariantKey[] = ['ts-tailwind', 'ts-css', 'js-tailwind', 'js-css']

export function generateStaticParams(): Params[] {
  return componentMetas.map((meta) => ({ slug: meta.name }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const meta = getComponentMeta(slug)
  if (!meta) return {}
  return { title: meta.title, description: meta.description }
}

async function loadVariants(slug: string): Promise<HighlightedVariants | null> {
  const all = variants as Record<string, Record<string, VariantFile[]>>
  const entry = all[slug]
  const hook = all['dot-canvas']
  if (!entry) return null
  const out = {} as HighlightedVariants
  for (const key of variantKeys) {
    const files = [...(entry[key] ?? []), ...(usesHook(entry[key]) ? (hook?.[key] ?? []) : [])]
    out[key] = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        code: file.code,
        html: await highlight(file.code, file.lang as CodeLang),
      })),
    )
  }
  return out
}

function usesHook(files: VariantFile[] | undefined) {
  return files?.some((file) => file.code.includes('use-dot-canvas')) ?? false
}

export default async function ComponentPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const meta = getComponentMeta(slug)
  if (!meta) notFound()
  const highlighted = await loadVariants(slug)
  const index = componentMetas.findIndex((m) => m.name === slug)
  const previous = componentMetas[(index - 1 + componentMetas.length) % componentMetas.length]
  const next = componentMetas[(index + 1) % componentMetas.length]

  return (
    <PlaygroundProvider meta={meta}>
      <ComponentSidebar />
      <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-4 pt-20 pb-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8">
        <div className="order-first lg:order-last">
          <div className="lg:sticky lg:top-20 lg:h-[calc(100dvh-96px)]">
            <PreviewPanel />
          </div>
        </div>

        <article className="flex min-w-0 flex-col gap-12 py-4 lg:py-10 lg:pl-4">
          <nav className="flex items-center gap-2" aria-label="Breadcrumb">
            <Link href="/components" className="label transition-ui hover:text-fg">
              Components
            </Link>
            <span className="label text-faint">/</span>
            <span className="label text-fg">{meta.title}</span>
          </nav>

          <header className="flex flex-col gap-4">
            <h1 className="heading text-[40px] sm:text-[48px]">{meta.title}</h1>
            <p className="max-w-[52ch] text-[17px] leading-relaxed text-muted">
              {meta.description}
            </p>
          </header>

          <InstallCommand slug={slug} registryDependencies={meta.registryDependencies} />
          <UsageSnippet />
          <PropsTable meta={meta} />
          {highlighted ? <CodeTabs variants={highlighted} /> : null}

          <nav
            className="flex items-center justify-between border-t border-line pt-6"
            aria-label="Adjacent components"
          >
            {previous ? (
              <Link
                href={`/components/${previous.name}`}
                className="flex flex-col gap-1 transition-ui hover:text-fg"
              >
                <span className="label">Previous</span>
                <span className="text-[14px] font-medium">{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/components/${next.name}`}
                className="flex flex-col items-end gap-1 text-right transition-ui hover:text-fg"
              >
                <span className="label">Next</span>
                <span className="text-[14px] font-medium">{next.title}</span>
              </Link>
            ) : null}
          </nav>
        </article>
      </div>
    </PlaygroundProvider>
  )
}
