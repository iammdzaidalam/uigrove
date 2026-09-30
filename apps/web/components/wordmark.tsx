import { wordmarkPaths, wordmarkRects, wordmarkViewBox } from './wordmark-shapes'

interface WordmarkProps {
  height?: number
  className?: string
}

export function Wordmark({ height = 16, className }: WordmarkProps) {
  const [w, h] = wordmarkViewBox
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={(height * w) / h}
      height={height}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {wordmarkRects.map(([x, y, rw, rh, rx], i) => (
        <rect key={i} x={x} y={y} width={rw} height={rh} rx={rx} />
      ))}
      {wordmarkPaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
