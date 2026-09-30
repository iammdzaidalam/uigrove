'use client'

import {
  DustTransition,
  DustTransitionDemoHero,
  DustTransitionDemoNext,
} from '@uigrove/components/dust-transition'

export function DustTransitionPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 overflow-y-auto [container-type:size]">
      <DustTransition {...values} viewportHeight="100cqh" hero={<DustTransitionDemoHero />}>
        <DustTransitionDemoNext />
      </DustTransition>
    </div>
  )
}
