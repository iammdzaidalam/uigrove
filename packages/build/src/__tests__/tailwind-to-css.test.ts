import { describe, expect, it } from 'vitest'
import { compileUtilities } from '../transforms/compile-css'
import { extractTailwind } from '../transforms/tailwind-to-css'

const fixture = `'use client'

import { useRef } from 'react'

export function Demo({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  return (
    <div className={['uig-demo', 'relative h-full w-full', className].filter(Boolean).join(' ')}>
      <canvas ref={ref} className="block h-full w-full" />
      <span className={\`mt-2 text-sm\`} />
    </div>
  )
}
`

describe('extractTailwind', () => {
  it('moves utilities into uig- classes and rewrites the JSX', () => {
    const result = extractTailwind('demo.tsx', fixture, 'demo')

    expect(result.classes).toEqual(
      new Map([
        ['uig-demo', ['relative', 'h-full', 'w-full']],
        ['uig-demo__canvas', ['block', 'h-full', 'w-full']],
        ['uig-demo__span', ['mt-2', 'text-sm']],
      ]),
    )
    expect(result.code).toContain("className={['uig-demo', className].filter(Boolean).join(' ')}")
    expect(result.code).toContain('className="uig-demo__canvas"')
    expect(result.code).toContain('className="uig-demo__span"')
    expect(result.code).not.toContain('h-full')
  })

  it('collapses a join over literals only and numbers repeated tags', () => {
    const source = `export const A = () => (
  <div>
    <i className={['uig-a', 'flex'].filter(Boolean).join(' ')} />
    <i className="p-2" />
    <i className="p-4" />
  </div>
)
`
    const result = extractTailwind('a.tsx', source, 'a')

    expect(result.code).toContain('<i className="uig-a" />')
    expect(result.code).toContain('<i className="uig-a__i" />')
    expect(result.code).toContain('<i className="uig-a__i-2" />')
    expect([...result.classes.keys()]).toEqual(['uig-a', 'uig-a__i', 'uig-a__i-2'])
  })
})

describe('compileUtilities', () => {
  it('compiles utilities to plain CSS rules', async () => {
    const css = await compileUtilities(new Map([['uig-x', ['relative', 'h-full']]]))

    expect(css).toContain('.uig-x {')
    expect(css).toContain('position: relative')
    expect(css).toContain('height: 100%')
    expect(css).not.toContain('tailwindcss')
  })

  it('keeps the first rule when tailwind emits a layer statement', async () => {
    const css = await compileUtilities(
      new Map([
        ['uig-x', ['block', 'h-full']],
        ['uig-x__label', ['tracking-tight', 'font-medium']],
      ]),
    )

    expect(css).toContain('.uig-x {')
    expect(css).toContain('.uig-x__label {')
    expect(css).not.toContain('@layer')
    expect(css).not.toContain('@property')
  })
})

describe('compileUtilities defaults', () => {
  it('inlines registered defaults so borders and transforms work alone', async () => {
    const css = await compileUtilities(new Map([['uig-demo', ['border', 'translate-x-2']]]))

    expect(css).toContain('border-style: var(--tw-border-style, solid)')
    expect(css).toContain('translate: var(--tw-translate-x, 0) var(--tw-translate-y, 0)')
    expect(css).not.toContain('@property')
  })
})
