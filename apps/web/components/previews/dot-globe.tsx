'use client'

import { DotGlobe, dotGlobeDemoMarkers } from '@uigrove/components/dot-globe'

export function DotGlobePreview({ values }: { values: Record<string, unknown> }) {
  return <DotGlobe {...values} markers={dotGlobeDemoMarkers} className="absolute inset-0" />
}
