'use client'

import { MorphingText } from '@uigrove/components/morphing-text'
import { useTheme } from '../theme'

export function MorphingTextPreview({ values }: { values: Record<string, unknown> }) {
  const { fg } = useTheme()
  const themed = { ...values }
  if (themed.color === '#ffffff') themed.color = fg
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <MorphingText {...themed} className="w-full" />
    </div>
  )
}
