'use client'

import { pascalCase } from '@/lib/component-name'
import { CopyButton } from '../copy-button'
import { usePlayground } from './playground-context'

export function UsageSnippet() {
  const { meta, values, defaults } = usePlayground()
  const name = meta.usage?.name ?? pascalCase(meta.name)
  const always = meta.usage?.always ?? []
  const props = Object.entries(values)
    .filter(([key, value]) => always.includes(key) || value !== defaults[key])
    .map(([key, value]) => `${key}=${formatValue(value === '' ? '/path/to/file' : value)}`)
  props.push(...(meta.usage?.extra ?? []))
  if (meta.usage?.className) props.push(`className="${meta.usage.className}"`)
  const jsx =
    props.length <= 1
      ? `<${name}${props.length ? ' ' + props[0] : ''} />`
      : `<${name}\n${props.map((p) => `  ${p}`).join('\n')}\n/>`
  const code = `import { ${name} } from '@/components/uigrove/${meta.name}'\n\n${jsx}`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-8 items-center justify-between">
        <span className="label">Usage</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto rounded-lg border border-line px-5 py-4 font-mono text-[13px] leading-relaxed text-fg">
        {code}
      </pre>
    </div>
  )
}

function formatValue(value: unknown) {
  if (typeof value === 'string') return `"${value}"`
  return `{${String(value)}}`
}
