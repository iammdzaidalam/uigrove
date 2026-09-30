'use client'

import { GooeyEffect } from '@uigrove/components/gooey-effect'

export function GooeyEffectPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <GooeyEffect {...values} className="h-full w-full">
        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
          <GooeyEffect.Item label="Pill" className="h-24 w-52 rounded-[10px] bg-current" />
          <GooeyEffect.Item label="Circle" className="size-12 rounded-full bg-current" />
        </div>
      </GooeyEffect>
    </div>
  )
}
