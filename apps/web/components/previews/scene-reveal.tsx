'use client'

import {
  SceneReveal,
  SceneRevealDemoHero,
  SceneRevealDemoNext,
} from '@uigrove/components/scene-reveal'

export function SceneRevealPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 overflow-y-auto [container-type:size]">
      <SceneReveal {...values} viewportHeight="100cqh" hero={<SceneRevealDemoHero />}>
        <SceneRevealDemoNext />
      </SceneReveal>
    </div>
  )
}
