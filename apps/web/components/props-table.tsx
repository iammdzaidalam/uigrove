import type { AnyComponentMeta, PropMeta } from '@uigrove/components/meta'

export function PropsTable({ meta }: { meta: AnyComponentMeta }) {
  const rows = Object.entries(meta.props)
  return (
    <div className="flex flex-col gap-3">
      <span className="label">Props</span>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label px-4 py-3 font-normal">Name</th>
              <th className="label px-4 py-3 font-normal">Type</th>
              <th className="label px-4 py-3 font-normal">Default</th>
              <th className="label px-4 py-3 font-normal">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(([name, prop]) => (
              <tr key={name} className="align-top">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-fg">{name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted">
                  {typeOf(prop)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted">
                  {defaultOf(prop)}
                </td>
                <td className="min-w-[200px] px-4 py-2.5 text-muted">
                  {prop.description ?? prop.label}
                </td>
              </tr>
            ))}
            <tr className="align-top">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-fg">className</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-muted">string</td>
              <td className="px-4 py-2.5 font-mono text-muted">—</td>
              <td className="px-4 py-2.5 text-muted">
                Classes for the root element. Use it for sizing and position.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function typeOf(prop: PropMeta) {
  switch (prop.kind) {
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'color':
    case 'string':
      return 'string'
    case 'select':
      return prop.options.map((o) => `'${o}'`).join(' | ')
  }
}

function defaultOf(prop: PropMeta) {
  if (prop.kind === 'string' || prop.kind === 'color' || prop.kind === 'select') {
    return prop.default === '' ? "''" : `'${prop.default}'`
  }
  return String(prop.default)
}
