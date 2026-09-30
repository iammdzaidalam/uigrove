'use client'

import { GooCarveButton } from '@uigrove/components/goo-carve-button'
import { useTheme } from '../theme'

export function GooCarveButtonPreview({ values }: { values: Record<string, unknown> }) {
  const { fg, bg } = useTheme()
  const themed = { ...values }
  if (themed.fill === '#f5f5f7') themed.fill = fg
  if (themed.textColor === '#09090c') themed.textColor = bg
  if (themed.blobColor === '#09090c') themed.blobColor = bg
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <GooCarveButton {...themed} />
    </div>
  )
}
