'use client'

import { SpineGallery, spineGalleryDemoItems } from '@uigrove/components/spine-gallery'

export function SpineGalleryPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0">
      <SpineGallery {...values} items={spineGalleryDemoItems} className="h-full w-full" />
    </div>
  )
}
