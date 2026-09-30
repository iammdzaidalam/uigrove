import { compile } from '@tailwindcss/node'
import { packageDir } from '../paths'
import { formatCode } from '../prettier'

export async function compileUtilities(classes: Map<string, string[]>) {
  const rules = [...classes].map(([name, utilities]) => {
    return `.${name} { @apply ${[...new Set(utilities)].join(' ')}; }`
  })
  const stylesheet = [
    '@import "tailwindcss/theme.css" theme(inline reference);',
    '@import "tailwindcss/utilities.css";',
    ...rules,
  ].join('\n')
  const compiler = await compile(stylesheet, { base: packageDir, onDependency: () => {} })
  const css = compiler.build([])
  return formatCode(withDefaults(ownRules(css), propertyDefaults(css)), 'css')
}

function propertyDefaults(css: string) {
  const defaults = new Map<string, string>()
  const pattern = /@property\s+(--[\w-]+)\s*\{[^}]*?initial-value:\s*([^;}]+)/g
  for (const match of css.matchAll(pattern)) {
    const [, name, value] = match
    if (name && value) defaults.set(name, value.trim())
  }
  return defaults
}

// Inlines Tailwind's registered defaults so the CSS stands alone
function withDefaults(css: string, defaults: Map<string, string>) {
  return css.replace(/var\((--tw-[\w-]+)\)/g, (whole, name: string) => {
    const value = defaults.get(name)
    return value === undefined ? whole : `var(${name}, ${value})`
  })
}

// Keeps top-level blocks whose selector starts with uig-
function ownRules(css: string) {
  const blocks: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < css.length; i++) {
    const char = css[i]
    if (char === '{') depth++
    if (char !== '}') continue
    depth--
    if (depth > 0) continue
    blocks.push(css.slice(start, i + 1))
    start = i + 1
  }
  return blocks
    .map(withoutLeadingComments)
    .filter((block) => block.startsWith('.uig-'))
    .join('\n\n')
}

// Drops the license comment and bare statements like `@layer properties;`
function withoutLeadingComments(block: string) {
  const brace = block.indexOf('{')
  const head = block.slice(0, brace)
  const cut = Math.max(head.lastIndexOf('*/') + 2, head.lastIndexOf(';') + 1, 0)
  const selector = head.slice(cut).trim()
  return `${selector} ${block.slice(brace).trim()}`
}
