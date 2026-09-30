'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { AnyComponentMeta } from '@uigrove/components/meta'
import { defaultsFrom } from '@uigrove/components/meta'
import { useTheme } from '../theme'

interface PlaygroundValue {
  meta: AnyComponentMeta
  values: Record<string, unknown>
  defaults: Record<string, unknown>
  previewKey: number
  setValue: (key: string, value: unknown) => void
  reset: () => void
}

const PlaygroundContext = createContext<PlaygroundValue | null>(null)

export function withThemeColor(
  values: Record<string, unknown>,
  meta: AnyComponentMeta,
  fg: string,
) {
  const out = { ...values }
  for (const [key, prop] of Object.entries(meta.props)) {
    if (prop.kind === 'color' && prop.default === '#ffffff') out[key] = fg
  }
  return out
}

export function PlaygroundProvider({
  meta,
  children,
}: {
  meta: AnyComponentMeta
  children: ReactNode
}) {
  const { fg } = useTheme()
  const defaults = useMemo(() => withThemeColor(defaultsFrom(meta), meta, fg), [meta, fg])
  const [overrides, setOverrides] = useState<Record<string, unknown>>({})
  const [previewKey, setPreviewKey] = useState(0)
  const values = useMemo(() => ({ ...defaults, ...overrides }), [defaults, overrides])

  const setValue = useCallback((key: string, value: unknown) => {
    setOverrides((current) => ({ ...current, [key]: value }))
  }, [])

  const reset = useCallback(() => {
    setOverrides({})
    setPreviewKey((k) => k + 1)
  }, [])

  const value = useMemo(
    () => ({ meta, values, defaults, previewKey, setValue, reset }),
    [meta, values, defaults, previewKey, setValue, reset],
  )

  return <PlaygroundContext.Provider value={value}>{children}</PlaygroundContext.Provider>
}

export function usePlayground() {
  const context = useContext(PlaygroundContext)
  if (!context) throw new Error('usePlayground needs a PlaygroundProvider')
  return context
}
