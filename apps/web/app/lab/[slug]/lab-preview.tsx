'use client'

import { ComponentPreview } from '@/components/previews/registry'
import { useTheme } from '@/components/theme'

export function LabPreview({ slug, values }: { slug: string; values: Record<string, unknown> }) {
  const { fg } = useTheme()
  const themed = { ...values }
  if (themed.color === '#ffffff') themed.color = fg
  return <ComponentPreview slug={slug} values={themed} />
}
