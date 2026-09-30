'use client'

import { ExpandOnHover, expandOnHoverDemoItems } from '@uigrove/components/expand-on-hover'

export function ExpandOnHoverPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <ExpandOnHover {...values} items={expandOnHoverDemoItems} className="max-w-full" />
    </div>
  )
}
