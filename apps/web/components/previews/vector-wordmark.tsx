'use client'

import { VectorWordmark } from '@uigrove/components/vector-wordmark'

export function VectorWordmarkPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 flex items-center px-8">
      <VectorWordmark {...(values as { text: string })} className="h-full w-full" />
    </div>
  )
}
