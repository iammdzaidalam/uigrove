'use client'

import { useId } from 'react'

const rays = [0, 45, 90, 135, 180, 225, 270, 315]
const motion =
  'transition-[transform,opacity] duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none'

// Moon in dark, sun in light; the crescent cut slides away
export function ThemeIcon({ theme, size = 16 }: { theme: 'dark' | 'light'; size?: number }) {
  const mask = useId()
  const moon = theme === 'dark'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-icon={moon ? 'moon' : 'sun'}
    >
      <mask id={mask}>
        <rect width="24" height="24" fill="white" />
        <circle
          cx="17"
          cy="7"
          r="7"
          fill="black"
          className={motion}
          style={{ transform: moon ? 'none' : 'translate(10px, -10px)' }}
        />
      </mask>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="currentColor"
        mask={`url(#${mask})`}
        className={`${motion} origin-center [transform-box:fill-box]`}
        style={{ transform: moon ? 'none' : 'scale(0.5)' }}
      />
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className={`${motion} origin-center [transform-box:view-box]`}
        style={{ opacity: moon ? 0 : 1, transform: moon ? 'rotate(-60deg) scale(0.5)' : 'none' }}
      >
        {rays.map((deg) => (
          <line key={deg} x1="12" y1="1.75" x2="12" y2="4" transform={`rotate(${deg} 12 12)`} />
        ))}
      </g>
    </svg>
  )
}
