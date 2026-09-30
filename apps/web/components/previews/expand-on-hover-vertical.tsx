'use client'

import {
  ExpandOnHoverVertical,
  expandOnHoverVerticalDemoItems,
} from '@uigrove/components/expand-on-hover-vertical'

export function ExpandOnHoverVerticalPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-8">
      <ExpandOnHoverVertical
        {...values}
        items={expandOnHoverVerticalDemoItems}
        className="max-h-full max-w-full"
      />
    </div>
  )
}
