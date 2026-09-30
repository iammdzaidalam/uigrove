'use client'

import { useEffect, useState } from 'react'

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {}
      }}
      className="label flex h-7 items-center rounded-md px-2 transition-ui hover:bg-surface hover:text-fg"
      aria-live="polite"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
