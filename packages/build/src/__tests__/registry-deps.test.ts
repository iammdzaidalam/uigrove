import { describe, expect, it } from 'vitest'
import { resolveDependency } from '../registry'

describe('resolveDependency', () => {
  it('turns our namespace into a full registry url', () => {
    expect(resolveDependency('@uigrove/dot-canvas')).toBe('https://uigrove.me/r/dot-canvas.json')
  })

  it('leaves shadcn items alone', () => {
    expect(resolveDependency('button')).toBe('button')
  })
})
