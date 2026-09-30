import type { ReactNode } from 'react'

// Monochrome marks so they sit quietly in the page ink
const logos: { name: string; mark: ReactNode }[] = [
  {
    name: 'React',
    mark: (
      <svg viewBox="-12 -11 24 22" fill="none" stroke="currentColor" strokeWidth="1">
        <circle r="2.05" fill="currentColor" stroke="none" />
        <ellipse rx="11" ry="4.2" />
        <ellipse rx="11" ry="4.2" transform="rotate(60)" />
        <ellipse rx="11" ry="4.2" transform="rotate(120)" />
      </svg>
    ),
  },
  {
    name: 'Next.js',
    mark: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="currentColor" />
        <path d="M9 7.5v9" stroke="var(--color-bg, #09090c)" strokeWidth="1.6" />
        <path d="M9 7.5 17.6 19" stroke="var(--color-bg, #09090c)" strokeWidth="1.6" />
        <path d="M15.2 7.5v6.6" stroke="var(--color-bg, #09090c)" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    name: 'Tailwind CSS',
    mark: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.91.23 1.57.89 2.29 1.62C13.67 10.62 15.03 12 18 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.91-.23-1.57-.89-2.29-1.62C16.34 6.18 14.98 4.8 12 4.8ZM6 12c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.91.23 1.57.89 2.29 1.62C7.67 17.82 9.03 19.2 12 19.2c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.91-.23-1.57-.89-2.29-1.62C10.34 13.38 8.98 12 6 12Z" />
      </svg>
    ),
  },
  {
    name: 'shadcn/ui',
    mark: (
      <svg
        viewBox="0 0 256 256"
        fill="none"
        stroke="currentColor"
        strokeWidth="26"
        strokeLinecap="round"
      >
        <line x1="208" y1="128" x2="128" y2="208" />
        <line x1="192" y1="40" x2="40" y2="192" />
      </svg>
    ),
  },
  {
    name: 'TypeScript',
    mark: (
      <svg viewBox="0 0 24 24">
        <rect x="1" y="1" width="22" height="22" rx="3" fill="currentColor" />
        <text
          x="21"
          y="20.2"
          textAnchor="end"
          fontSize="10.5"
          fontWeight="700"
          letterSpacing="-0.6"
          fill="var(--color-bg, #09090c)"
          fontFamily="var(--font-sans), system-ui, sans-serif"
        >
          TS
        </text>
      </svg>
    ),
  },
]

export function Stack() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-14 gap-y-8 py-12">
      {logos.map(({ name, mark }) => (
        <li key={name} className="group flex flex-col items-center gap-3 text-muted">
          <span
            aria-hidden="true"
            className="block size-9 transition-ui group-hover:text-fg [&>svg]:size-full"
          >
            {mark}
          </span>
          <span className="label transition-ui group-hover:text-fg">{name}</span>
        </li>
      ))}
    </ul>
  )
}
