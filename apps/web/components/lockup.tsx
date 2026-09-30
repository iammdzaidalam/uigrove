'use client'

import { useEffect, useRef, useState } from 'react'
import { DotMatrixText, type DotMatrixPoint } from '@uigrove/components/dot-matrix-text'
import { logoLinks, logoPoints } from './logo-shapes'
import { useTheme } from './theme'
import { wordmarkGrid, wordmarkPoints, wordmarkShapes } from './wordmark-shapes'

const DOT = 0.9725
const GOO = 0.13
const WORD_COL = 10
// Six word rows centred on the seven tree rows
const WORD_ROW = 0.5

// Tree and wordmark share one grid, so they render as one canvas
const points: DotMatrixPoint[] = [
  ...logoPoints.map(([c, r]) => [c, r] as const),
  ...wordmarkPoints.map(([c, r, shape]) => [c + WORD_COL, r + WORD_ROW, shape] as const),
]
const spanCols = DOT / 2 + WORD_COL + wordmarkGrid.width - wordmarkGrid.left
const spanRows = Math.max(...logoPoints.map((p) => p[1])) + DOT

export function Lockup() {
  const { fg } = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const [gap, setGap] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setGap(entry.contentRect.width / spanCols)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      role="img"
      aria-label="UIgrove"
      className="w-full"
      style={{ aspectRatio: `${spanCols} / ${spanRows}` }}
    >
      {gap > 0 ? (
        <DotMatrixText
          text="UIgrove"
          points={points}
          links={logoLinks}
          shapes={wordmarkShapes}
          gap={gap}
          dotSize={gap * DOT}
          goo={GOO}
          color={fg}
          align="left"
          scatter={0}
          duration={1}
          stagger={0}
          radius={gap * 3}
          strength={gap * 0.45}
          fitWidth={false}
          className="h-full w-full"
          style={{ height: '100%' }}
        />
      ) : null}
    </div>
  )
}
