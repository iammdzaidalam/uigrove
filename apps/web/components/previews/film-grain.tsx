'use client'

import Image from 'next/image'
import { FilmGrain } from '@uigrove/components/film-grain'

export function FilmGrainEffectPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <Image src="/demo/arches.jpg" alt="" fill sizes="100vw" className="object-cover" />
      <FilmGrain {...values} className="absolute inset-0" />
    </div>
  )
}
