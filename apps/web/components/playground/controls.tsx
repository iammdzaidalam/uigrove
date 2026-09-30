'use client'

import type { AnyComponentMeta, PropMeta } from '@uigrove/components/meta'

interface ControlsProps {
  meta: AnyComponentMeta
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  onReset: () => void
}

export function Controls({ meta, values, onChange, onReset }: ControlsProps) {
  const entries = Object.entries(meta.props).filter(([, prop]) => prop.playground !== false)
  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center justify-between">
        <span className="label">Props</span>
        <button type="button" onClick={onReset} className="label transition-ui hover:text-fg">
          Reset
        </button>
      </div>
      <div className="flex flex-col divide-y divide-line border-y border-line">
        {entries.map(([key, prop]) => (
          <Control
            key={key}
            id={key}
            prop={prop}
            value={values[key]}
            onChange={(v) => onChange(key, v)}
          />
        ))}
      </div>
    </div>
  )
}

interface ControlProps {
  id: string
  prop: PropMeta
  value: unknown
  onChange: (value: unknown) => void
}

function Control({ id, prop, value, onChange }: ControlProps) {
  switch (prop.kind) {
    case 'number':
      return (
        <label className="flex flex-col gap-1.5 py-3">
          <span className="flex items-baseline justify-between">
            <span className="text-[13px]">{prop.label}</span>
            <span className="font-mono text-[12px] tabular-nums text-muted">
              {formatNumber(Number(value))}
              {prop.unit ?? ''}
            </span>
          </span>
          <input
            type="range"
            className="range"
            min={prop.min}
            max={prop.max}
            step={prop.step ?? 1}
            value={Number(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={prop.label}
          />
        </label>
      )
    case 'boolean':
      return (
        <div className="flex items-center justify-between py-3">
          <span className="text-[13px]" id={`${id}-label`}>
            {prop.label}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(value)}
            aria-labelledby={`${id}-label`}
            onClick={() => onChange(!value)}
            className={[
              'relative h-4 w-7 rounded-full transition-ui',
              value ? 'bg-fg' : 'bg-line-strong',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 left-0.5 size-3 rounded-full transition-ui',
                value ? 'translate-x-3 bg-bg' : 'bg-fg',
              ].join(' ')}
            />
          </button>
        </div>
      )
    case 'select':
      return (
        <div className="flex flex-col gap-2 py-3">
          <span className="text-[13px]">{prop.label}</span>
          <div
            role="radiogroup"
            aria-label={prop.label}
            className="flex rounded-md border border-line p-0.5"
          >
            {prop.options.map((option) => {
              const active = option === value
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange(option)}
                  className={[
                    'flex-1 rounded-[5px] px-2 py-1 font-mono text-[12px] transition-ui',
                    active ? 'bg-surface-strong text-fg' : 'text-muted hover:text-fg',
                  ].join(' ')}
                >
                  {option}
                </button>
              )
            })}
          </div>
        </div>
      )
    case 'color':
      return (
        <div className="flex items-center justify-between py-3">
          <span className="text-[13px]">{prop.label}</span>
          <span className="flex items-center gap-2">
            <input
              type="text"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${prop.label} hex`}
              spellCheck={false}
              className="h-7 w-[84px] rounded-md border border-line bg-transparent px-2 font-mono text-[12px] text-fg outline-none transition-ui focus:border-line-strong"
            />
            <span className="relative size-7 overflow-hidden rounded-md border border-line">
              <span className="absolute inset-0" style={{ background: String(value) }} />
              <input
                type="color"
                value={toHex(String(value))}
                onChange={(e) => onChange(e.target.value)}
                aria-label={prop.label}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </span>
          </span>
        </div>
      )
    case 'string':
      return (
        <label className="flex flex-col gap-1.5 py-3">
          <span className="text-[13px]">{prop.label}</span>
          {prop.multiline ? (
            <textarea
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              className="rounded-md border border-line bg-transparent px-2 py-1.5 text-[13px] outline-none transition-ui focus:border-line-strong"
            />
          ) : (
            <input
              type="text"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              className="h-8 rounded-md border border-line bg-transparent px-2 text-[13px] outline-none transition-ui focus:border-line-strong"
            />
          )}
        </label>
      )
  }
}

function formatNumber(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function toHex(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'
}
