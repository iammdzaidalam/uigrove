import { logoCircles, logoPaths, logoViewBox } from './logo-shapes'

interface LogoProps {
  size?: number
  className?: string
}

export function Logo({ size = 22, className }: LogoProps) {
  const [w, h] = logoViewBox
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={(size * h) / w}
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {logoCircles.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} />
      ))}
      {logoPaths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  )
}
