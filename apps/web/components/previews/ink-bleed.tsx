'use client'

import { InkBleed } from '@uigrove/components/ink-bleed'
import { useTheme } from '../theme'

export function InkBleedPreview({ values }: { values: Record<string, unknown> }) {
  const { fg } = useTheme()
  const themed = { ...values }
  if (themed.color === '#ffffff') themed.color = fg
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <InkBleed {...(themed as { text: string })} />
    </div>
  )
}
