import { notFound } from 'next/navigation'
import { getComponentMeta, defaultsFrom } from '@uigrove/components/meta'
import { LabPreview } from './lab-preview'

export const metadata = { robots: { index: false } }

export default async function LabPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { slug } = await params
  const meta = getComponentMeta(slug)
  if (!meta) notFound()
  const query = await searchParams
  const values = defaultsFrom(meta) as Record<string, unknown>
  for (const [key, prop] of Object.entries(meta.props)) {
    const raw = query[key]
    if (raw === undefined) continue
    if (prop.kind === 'number') values[key] = Number(raw)
    else if (prop.kind === 'boolean') values[key] = raw === 'true'
    else values[key] = raw
  }
  return (
    <div className="relative h-dvh w-full">
      <LabPreview slug={slug} values={values} />
    </div>
  )
}
