'use client'

import { OrbitTiles, orbitTilesDemoItems } from '@uigrove/components/orbit-tiles'

export function OrbitTilesInfiniteLoopPreview({ values }: { values: Record<string, unknown> }) {
  return <OrbitTiles {...values} items={orbitTilesDemoItems} className="absolute inset-0" />
}
