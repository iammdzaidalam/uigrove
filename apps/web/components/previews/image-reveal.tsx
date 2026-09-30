'use client'

import { ImageReveal, imageRevealDemoItems } from '@uigrove/components/image-reveal'

export function ImageRevealPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 overflow-y-auto [container-type:size]">
      <ImageReveal {...values} items={imageRevealDemoItems} viewportHeight="100cqh" />
    </div>
  )
}
