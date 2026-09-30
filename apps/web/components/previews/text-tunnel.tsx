'use client'

import { Instrument_Serif } from 'next/font/google'
import { TextTunnel, textTunnelDefaults } from '@uigrove/components/text-tunnel'
import { useTheme } from '../theme'

const serif = Instrument_Serif({ weight: '400', subsets: ['latin'] })

export function TextTunnelPreview({ values }: { values: Record<string, unknown> }) {
  const { fg, bg } = useTheme()
  const themed = { ...values }
  if (themed.textColor === textTunnelDefaults.textColor) themed.textColor = fg
  if (themed.background === textTunnelDefaults.background) themed.background = bg
  if (themed.fontFamily === textTunnelDefaults.fontFamily) {
    themed.fontFamily = `${serif.style.fontFamily}, Georgia, serif`
  }
  return <TextTunnel {...themed} className="absolute inset-0" />
}
