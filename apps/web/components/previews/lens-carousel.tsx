'use client'

import { LensCarousel, lensCarouselDemoItems } from '@uigrove/components/lens-carousel'

export function LensCarouselPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0">
      <LensCarousel {...values} items={lensCarouselDemoItems} className="h-full w-full" />
    </div>
  )
}
