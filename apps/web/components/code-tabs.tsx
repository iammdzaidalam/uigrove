'use client'

import { useState } from 'react'
import { CopyButton } from './copy-button'

export interface HighlightedFile {
  name: string
  code: string
  html: string
}

export type VariantKey = 'ts-tailwind' | 'ts-css' | 'js-tailwind' | 'js-css'

export type HighlightedVariants = Record<VariantKey, HighlightedFile[]>

const languages = [
  { id: 'ts', label: 'TypeScript' },
  { id: 'js', label: 'JavaScript' },
] as const

const stylings = [
  { id: 'tailwind', label: 'Tailwind' },
  { id: 'css', label: 'CSS' },
] as const

export function CodeTabs({ variants }: { variants: HighlightedVariants }) {
  const [lang, setLang] = useState<'ts' | 'js'>('ts')
  const [styling, setStyling] = useState<'tailwind' | 'css'>('tailwind')
  const [fileIndex, setFileIndex] = useState(0)
  const files = variants[`${lang}-${styling}`]
  const file = files[Math.min(fileIndex, files.length - 1)]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="label">Code</span>
        <div className="flex items-center gap-2">
          <Segmented options={languages} value={lang} onChange={setLang} label="Language" />
          <Segmented options={stylings} value={styling} onChange={setStyling} label="Styling" />
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="flex items-center justify-between border-b border-line pr-2">
          <div role="tablist" aria-label="Files" className="flex">
            {files.map((f, i) => {
              const active = f === file
              return (
                <button
                  key={f.name}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setFileIndex(i)}
                  className={[
                    'h-10 border-b px-4 font-mono text-[12px] transition-ui',
                    active
                      ? '-mb-px border-fg text-fg'
                      : 'border-transparent text-muted hover:text-fg',
                  ].join(' ')}
                >
                  {f.name}
                </button>
              )
            })}
          </div>
          {file ? <CopyButton text={file.code} /> : null}
        </div>
        {file ? (
          <div
            className="max-h-[560px] overflow-auto px-5 py-4 text-[13px] leading-relaxed [&_pre]:font-mono"
            dangerouslySetInnerHTML={{ __html: file.html }}
          />
        ) : null}
      </div>
    </div>
  )
}

interface SegmentedProps<T extends string> {
  options: ReadonlyArray<{ id: T; label: string }>
  value: T
  onChange: (value: T) => void
  label: string
}

function Segmented<T extends string>({ options, value, onChange, label }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md border border-line p-0.5">
      {options.map((option) => {
        const active = option.id === value
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.id)}
            className={[
              'rounded-[5px] px-2.5 py-1 font-mono text-[12px] transition-ui',
              active ? 'bg-surface-strong text-fg' : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
