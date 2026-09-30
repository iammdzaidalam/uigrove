import { hookName, type Variants } from './variants'

const siteUrl = process.env.UIGROVE_SITE_URL ?? 'https://uigrove.me'

// Full URLs resolve even without the @uigrove namespace configured
export function resolveDependency(name: string) {
  return name.startsWith('@uigrove/') ? `${siteUrl}/r/${name.slice(9)}.json` : name
}

export interface ComponentInfo {
  name: string
  title: string
  description: string
  dependencies?: readonly string[]
  registryDependencies?: readonly string[]
}

type ItemType = 'registry:component' | 'registry:hook'

export interface RegistryFile {
  path: string
  type: ItemType
  content?: string
}

export interface RegistryItem {
  $schema?: string
  name: string
  type: ItemType
  title: string
  description: string
  dependencies: string[]
  registryDependencies: string[]
  files: RegistryFile[]
}

const itemSchema = 'https://ui.shadcn.com/schema/registry-item.json'
const registrySchema = 'https://ui.shadcn.com/schema/registry.json'

export function componentItem(meta: ComponentInfo, variants: Variants): RegistryItem {
  return {
    $schema: itemSchema,
    name: meta.name,
    type: 'registry:component',
    title: meta.title,
    description: meta.description,
    dependencies: [...(meta.dependencies ?? [])],
    registryDependencies: (meta.registryDependencies ?? []).map(resolveDependency),
    files: variants['ts-tailwind'].map((file) => ({
      path: `components/uigrove/${file.name}`,
      type: 'registry:component',
      content: file.code,
    })),
  }
}

export function hookItem(variants: Variants): RegistryItem {
  return {
    $schema: itemSchema,
    name: hookName,
    type: 'registry:hook',
    title: 'Dot Canvas',
    description:
      'Canvas 2D hook that sizes for high-DPI, pauses offscreen, and tracks the pointer.',
    dependencies: [],
    registryDependencies: [],
    files: variants['ts-tailwind'].map((file) => ({
      path: `hooks/${file.name}`,
      type: 'registry:hook',
      content: file.code,
    })),
  }
}

export function registryIndex(items: RegistryItem[]) {
  return {
    $schema: registrySchema,
    name: 'uigrove',
    homepage: siteUrl,
    items: items.map(withoutContent),
  }
}

function withoutContent(item: RegistryItem): RegistryItem {
  return {
    name: item.name,
    type: item.type,
    title: item.title,
    description: item.description,
    dependencies: item.dependencies,
    registryDependencies: item.registryDependencies,
    files: item.files.map(({ path, type }) => ({ path, type })),
  }
}
