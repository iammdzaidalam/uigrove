'use client'

import { ImageWheel3D, imageWheel3DDemoItems } from '@uigrove/components/image-wheel-3d'

export function ImageWheel3DPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0">
      <ImageWheel3D {...values} items={imageWheel3DDemoItems} className="h-full w-full" />
    </div>
  )
}
