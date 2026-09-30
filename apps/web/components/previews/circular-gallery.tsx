'use client'

import { CircularGallery, circularGalleryDemoItems } from '@uigrove/components/circular-gallery'

export function CircularGalleryPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0">
      <CircularGallery {...values} items={circularGalleryDemoItems} className="h-full w-full" />
    </div>
  )
}
