import { notFound } from 'next/navigation'
import { GooeyLab } from './lab'

export const metadata = { title: 'Gooey benchmark', robots: { index: false } }

export default async function GooeyLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  if (process.env.NODE_ENV === 'production') notFound()
  const params = await searchParams
  const mode = (params.mode ?? 'canvas-svg') as 'svg' | 'canvas-svg' | 'canvas-css' | 'field'
  const count = Number(params.count ?? 200)
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-6 pt-24 pb-8">
      <span className="label">
        lab / gooey / {mode} / {count} dots
      </span>
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-line">
        <GooeyLab mode={mode} count={count} />
      </div>
    </div>
  )
}
