'use client'

import { PillNav, pillNavDemoLinks, pillNavDemoMenu } from '@uigrove/components/pill-nav'
import { Logo } from '../logo'

const lines = Array.from({ length: 56 }, (_, index) => 38 + ((index * 37) % 58))

function stay() {}

export function PillNavPreview({ values }: { values: Record<string, unknown> }) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 overflow-y-auto">
        <div className="mx-auto flex max-w-[560px] flex-col gap-3 px-6 pt-32 pb-24">
          {lines.map((width, index) => (
            <div
              key={index}
              className="h-3 shrink-0 rounded-full bg-surface-strong"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
      <PillNav
        {...values}
        position="absolute"
        logo={<Logo size={24} />}
        links={pillNavDemoLinks}
        menu={pillNavDemoMenu}
        onNavigate={stay}
      />
    </div>
  )
}
