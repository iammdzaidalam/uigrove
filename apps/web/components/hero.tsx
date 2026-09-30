'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { DotMatrixText } from '@uigrove/components/dot-matrix-text'
import { CopyButton } from './copy-button'
import { Vortex } from './hero/vortex'
import { logoLinks, logoPoints } from './logo-shapes'
import { useTheme } from './theme'

const command = 'npx shadcn@latest add @uigrove/dot-grid'

export function Hero() {
  const { fg, theme } = useTheme()
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <section className="relative flex min-h-dvh items-center overflow-hidden">
      <Vortex theme={theme} clearRef={contentRef} className="absolute inset-0" />
      <div className="relative mx-auto flex w-full max-w-[1440px] justify-center px-6 py-32 text-center">
        <div ref={contentRef} className="flex max-w-full flex-col items-center gap-8">
          <DotMatrixText
            text="UIgrove"
            points={logoPoints}
            links={logoLinks}
            gap={21}
            dotSize={20.2}
            goo={0.15}
            color={fg}
            align="center"
            scatter={0}
            duration={1}
            stagger={0}
            radius={57}
            strength={10}
            className="w-[210px]"
            style={{ height: 154 }}
          />
          <div className="flex flex-col items-center gap-6">
            <h1 className="max-w-[16ch] text-[clamp(28px,3.6vw,48px)] font-semibold uppercase leading-[1] tracking-[-0.035em] text-balance sm:max-w-none">
              A grove of UI components
            </h1>
            <span className="label">For shadcn/ui</span>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="flex h-11 max-w-full items-center gap-1 rounded-full border border-line-strong bg-bg py-1 pr-1 pl-4">
              <code className="min-w-0 truncate font-mono text-[12px] text-fg sm:text-[13px]">
                {command}
              </code>
              <CopyButton text={command} />
            </div>
            <Link
              href="/components"
              className="flex h-11 items-center rounded-full bg-fg px-5 text-[13px] font-medium text-bg transition-ui hover:opacity-85"
            >
              Quick start
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
