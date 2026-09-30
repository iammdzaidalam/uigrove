import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { componentsSrcDir } from '../paths'
import { tsToJs } from '../transforms/ts-to-js'

describe('tsToJs', () => {
  it('strips types from the real dot-grid component and keeps JSX', async () => {
    const source = await readFile(path.join(componentsSrcDir, 'dot-grid', 'dot-grid.tsx'), 'utf8')
    const result = await tsToJs('dot-grid.tsx', source)

    expect(result.name).toBe('dot-grid.jsx')
    expect(result.code.split('\n')[0]).toBe("'use client'")
    expect(result.code).not.toContain(': DotGridProps')
    expect(result.code).not.toContain('interface ')
    expect(result.code).not.toContain('type CSSProperties')
    expect(result.code).toContain('export function DotGrid(')
    expect(result.code).toContain('<canvas ref={canvasRef}')
    expect(result.code).toContain("import { useEffect, useRef } from 'react'")
  })

  it('emits .js and keeps blank lines at the top level, in bodies, and in classes', async () => {
    const source = [
      "import { a } from './a'",
      '',
      'export const b: number = a',
      '',
      'export function c(x: number) {',
      '  const y = x + b',
      '',
      '  if (y > 1) return y',
      '',
      '  return b',
      '}',
      '',
      'export class D {',
      '  size = 0',
      '',
      '  constructor(size: number) {',
      '    this.size = size',
      '  }',
      '',
      '  grow() {',
      '    this.size++',
      '  }',
      '}',
      '',
    ].join('\n')
    const result = await tsToJs('demo.ts', source)

    expect(result.name).toBe('demo.js')
    expect(result.code).toBe(source.replace(': number = a', ' = a').replaceAll(': number', ''))
  })
})
