import { describe, expect, it } from 'vitest'
import { rewriteImports } from '../transforms/rewrite-imports'

describe('rewriteImports', () => {
  it('points shared lib imports at the hooks alias and keeps the rest', () => {
    const source = [
      "import { useRef } from 'react'",
      "import { useDotCanvas } from '../lib/dot-canvas'",
      "import type { DotCanvasEngine } from '../lib/dot-canvas'",
      "import { DemoEngine } from './demo.engine'",
      '',
    ].join('\n')

    expect(rewriteImports('demo.tsx', source)).toBe(
      [
        "import { useRef } from 'react'",
        "import { useDotCanvas } from '@/hooks/use-dot-canvas'",
        "import type { DotCanvasEngine } from '@/hooks/use-dot-canvas'",
        "import { DemoEngine } from './demo.engine'",
        '',
      ].join('\n'),
    )
  })
})
