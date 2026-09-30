import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { componentsSrcDir } from './paths'
import { formatCode } from './prettier'
import { rewriteImports } from './transforms/rewrite-imports'
import { tailwindToCss } from './transforms/tailwind-to-css'
import { tsToJs } from './transforms/ts-to-js'

export type Lang = 'tsx' | 'ts' | 'jsx' | 'js' | 'css'

export interface VariantFile {
  name: string
  lang: Lang
  code: string
}

export type VariantKey = 'ts-tailwind' | 'ts-css' | 'js-tailwind' | 'js-css'

export type Variants = Record<VariantKey, VariantFile[]>

export const hookName = 'dot-canvas'
export const hookFileName = 'use-dot-canvas.ts'

export async function buildComponentVariants(slug: string): Promise<Variants> {
  const componentName = `${slug}.tsx`
  const sources = await collectSources(slug, componentName)
  const component = sources.get(componentName)!
  const support = [...sources].filter(([name]) => name !== componentName)

  const tsSupport = await Promise.all(support.map(([name, code]) => tsFile(name, code)))
  const jsSupport = await Promise.all(support.map(([name, code]) => jsFile(name, code)))
  const styled = await tailwindToCss(componentName, component, slug)
  const css = variantFile(`${slug}.css`, styled.css)

  return {
    'ts-tailwind': [await tsFile(componentName, component), ...tsSupport],
    'ts-css': [variantFile(componentName, styled.code), ...tsSupport, css],
    'js-tailwind': [await jsFile(componentName, component), ...jsSupport],
    'js-css': [await jsFile(componentName, styled.code), ...jsSupport, css],
  }
}

const localImport = /from\s+'\.\/([a-z0-9-.]+)'/g
const skipped = new Set(['demo', 'index'])

// Follows relative imports so helper files ship with the component
async function collectSources(slug: string, entry: string) {
  const sources = new Map<string, string>()
  const queue = [entry]
  while (queue.length) {
    const name = queue.shift()!
    if (sources.has(name)) continue
    const code = rewriteImports(name, await readSource(slug, name))
    sources.set(name, code)
    for (const match of code.matchAll(localImport)) {
      const base = match[1]!
      if (skipped.has(base) || base.endsWith('.meta') || base === slug) continue
      const file = await resolveSource(slug, base)
      if (file) queue.push(file)
    }
  }
  return sources
}

async function resolveSource(slug: string, base: string) {
  for (const extension of ['.ts', '.tsx']) {
    const name = `${base}${extension}`
    try {
      await access(path.join(componentsSrcDir, slug, name))
      return name
    } catch {}
  }
  return null
}

export async function buildHookVariants(): Promise<Variants> {
  const source = await readFile(path.join(componentsSrcDir, 'lib', 'dot-canvas.ts'), 'utf8')
  const code = rewriteImports(hookFileName, source)
  const ts = [await tsFile(hookFileName, code)]
  const js = [await jsFile(hookFileName, code)]
  return { 'ts-tailwind': ts, 'ts-css': ts, 'js-tailwind': js, 'js-css': js }
}

function readSource(slug: string, name: string) {
  return readFile(path.join(componentsSrcDir, slug, name), 'utf8')
}

async function tsFile(name: string, code: string) {
  return variantFile(name, await formatCode(code, 'typescript'))
}

async function jsFile(name: string, code: string) {
  const js = await tsToJs(name, code)
  return variantFile(js.name, js.code)
}

function variantFile(name: string, code: string): VariantFile {
  return { name, lang: langOf(name), code }
}

function langOf(name: string): Lang {
  const extension = path.extname(name).slice(1)
  if (isLang(extension)) return extension
  throw new Error(`Unknown file extension: ${name}`)
}

function isLang(value: string): value is Lang {
  return ['tsx', 'ts', 'jsx', 'js', 'css'].includes(value)
}
