'use client'

import Image from 'next/image'
import { useState } from 'react'
import { WindowTransition } from '@uigrove/components/window-transition'

const buttonClass =
  'rounded-full border border-current/20 px-4 py-2 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors duration-200 hover:bg-current/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current'

export function WindowPageTransitionPreview({ values }: { values: Record<string, unknown> }) {
  const [page, setPage] = useState<'a' | 'b'>('a')
  return (
    <WindowTransition {...values} transitionKey={page} className="absolute inset-0">
      {page === 'a' ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-8 bg-bg px-8 text-center text-fg">
          <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">Page one</p>
          <h2 className="text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
            Masked Window
            <br />
            Transition
          </h2>
          <button type="button" className={buttonClass} onClick={() => setPage('b')}>
            Open page two
          </button>
        </div>
      ) : (
        <div className="relative h-full w-full text-[#f5f5f7]">
          <Image src="/demo/arches.jpg" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-8 px-8 text-center">
            <p className="font-mono text-[11px] tracking-[0.08em] uppercase opacity-70">Page two</p>
            <h2 className="text-4xl font-medium tracking-[-0.03em] sm:text-5xl">
              And here is
              <br />
              page two
            </h2>
            <button type="button" className={buttonClass} onClick={() => setPage('a')}>
              Back to page one
            </button>
          </div>
        </div>
      )}
    </WindowTransition>
  )
}
