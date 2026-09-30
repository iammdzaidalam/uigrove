import { CopyButton } from '../copy-button'

const registry = `"registries": {
  "@uigrove": "https://uigrove.me/r/{name}.json"
}`

const steps = [
  {
    title: 'Add the registry',
    text: 'One entry in components.json, once per project.',
    file: 'components.json',
    code: registry,
  },
  {
    title: 'Install a component',
    text: 'The CLI writes the files and the shared hook it needs.',
    file: 'terminal',
    code: 'npx shadcn@latest add @uigrove/dot-grid',
  },
  {
    title: 'Own the code',
    text: 'It lives in components/uigrove. Change anything, nothing to update.',
    file: 'app/page.tsx',
    code: "import { DotGrid } from '@/components/uigrove/dot-grid'",
  },
]

export function HowItWorks() {
  return (
    <ol className="grid gap-3 lg:grid-cols-3">
      {steps.map((step, index) => (
        <li key={step.title} className="flex flex-col gap-5 rounded-2xl border border-line p-6">
          <span className="label">{String(index + 1).padStart(2, '0')}</span>
          <div className="flex flex-col gap-2">
            <h3 className="text-[18px] font-medium tracking-[-0.02em]">{step.title}</h3>
            <p className="text-[14px] leading-relaxed text-muted">{step.text}</p>
          </div>
          <div className="mt-auto overflow-hidden rounded-xl border border-line bg-bg">
            <div className="flex h-9 items-center justify-between border-b border-line pr-1.5 pl-4">
              <span className="font-mono text-[11px] text-faint">{step.file}</span>
              <CopyButton text={step.code} />
            </div>
            <pre className="px-4 py-3.5 font-mono text-[12px] leading-relaxed break-all whitespace-pre-wrap text-fg">
              {step.code}
            </pre>
          </div>
        </li>
      ))}
    </ol>
  )
}
