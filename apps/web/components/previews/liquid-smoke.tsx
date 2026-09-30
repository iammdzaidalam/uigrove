'use client'

import { LiquidSmoke } from '@uigrove/components/liquid-smoke'
import { useTheme } from '../theme'

export function LiquidSmokePreview({ values }: { values: Record<string, unknown> }) {
  const { fg, bg } = useTheme()
  const themed = { ...values }
  if (themed.color === '#f5f5f7') themed.color = fg
  if (themed.background === '#09090c') themed.background = bg
  return <LiquidSmoke {...themed} className="absolute inset-0" />
}
