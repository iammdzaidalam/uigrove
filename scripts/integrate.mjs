import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const slugs = process.argv.slice(2)
if (!slugs.length) throw new Error('usage: node scripts/integrate.mjs <slug...>')
const pascal = (s) =>
  s
    .split('-')
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('')
const camel = (s) => {
  const p = pascal(s)
  return p[0].toLowerCase() + p.slice(1)
}

const indexPath = 'packages/components/src/index.ts'
const metaPath = 'packages/components/src/meta.ts'
const registryPath = 'apps/web/components/previews/registry.tsx'
let index = readFileSync(indexPath, 'utf8')
let meta = readFileSync(metaPath, 'utf8')
let registry = readFileSync(registryPath, 'utf8')

for (const slug of slugs) {
  if (!existsSync(`packages/components/src/${slug}/index.ts`))
    throw new Error(`missing component ${slug}`)
  if (!existsSync(`apps/web/components/previews/${slug}.tsx`))
    throw new Error(`missing preview ${slug}`)
  const metaName = `${camel(slug)}Meta`
  const previewName = `${pascal(slug)}Preview`

  if (!index.includes(`'./${slug}'`))
    index = index.replace(
      /(export \* from '\.\/[a-z-]+'\n)(?![\s\S]*export \* from '\.\/[a-z-]+'\n)/,
      `$1export * from './${slug}'\n`,
    )
  if (!meta.includes(metaName)) {
    meta = meta.replace(
      /(import \{ [a-zA-Z]+Meta \} from '\.\/[a-z-]+\/[a-z-]+\.meta'\n)(?![\s\S]*import \{ [a-zA-Z]+Meta \})/,
      `$1import { ${metaName} } from './${slug}/${slug}.meta'\n`,
    )
    meta = meta.replace(/\n\] as const/, `\n  ${metaName},\n] as const`)
  }
  if (!registry.includes(previewName)) {
    registry = registry.replace(
      /(import [^\n]+ from '@uigrove\/components\/[a-z-]+'\n)(?![\s\S]*import [^\n]+ from '@uigrove\/components\/[a-z-]+'\n)/,
      `$1import { ${previewName} } from './${slug}'\n`,
    )
    registry = registry.replace(
      /\n    default:\n      return null/,
      `\n    case '${slug}':\n      return <${previewName} values={values} />\n    default:\n      return null`,
    )
  }
  console.log(`integrated ${slug}`)
}
writeFileSync(indexPath, index)
writeFileSync(metaPath, meta)
writeFileSync(registryPath, registry)
