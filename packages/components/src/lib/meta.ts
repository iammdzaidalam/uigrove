interface BaseProp {
  label: string
  description?: string
  playground?: false
}

export interface NumberProp extends BaseProp {
  kind: 'number'
  default: number
  min: number
  max: number
  step?: number
  unit?: string
}

export interface ColorProp extends BaseProp {
  kind: 'color'
  default: string
}

export interface BooleanProp extends BaseProp {
  kind: 'boolean'
  default: boolean
}

export interface SelectProp<T extends string = string> extends BaseProp {
  kind: 'select'
  default: T
  options: readonly T[]
}

export interface StringProp extends BaseProp {
  kind: 'string'
  default: string
  multiline?: boolean
}

export type PropMeta = NumberProp | ColorProp | BooleanProp | SelectProp | StringProp

type MetaFor<T> = [T] extends [number]
  ? NumberProp
  : [T] extends [boolean]
    ? BooleanProp
    : [T] extends [string]
      ? ColorProp | SelectProp<T> | StringProp
      : never

type Controllable<P> = {
  [K in keyof P]-?: NonNullable<P[K]> extends number | boolean | string ? K : never
}[keyof P]

type Reserved = 'className' | 'style' | 'children' | 'ref'

export type ComponentCategory =
  'backgrounds' | 'text' | 'effects' | 'media' | 'galleries' | 'navigation'

export interface ComponentMeta<P = Record<string, unknown>> {
  name: string
  title: string
  description: string
  category: ComponentCategory
  props: { [K in Exclude<Controllable<P>, Reserved>]-?: MetaFor<NonNullable<P[K]>> }
  usage?: {
    name?: string
    className?: string
    always?: readonly string[]
    extra?: readonly string[]
  }
  dependencies?: string[]
  registryDependencies?: string[]
}

export type AnyComponentMeta = ComponentMeta<Record<string, unknown>> & {
  props: Record<string, PropMeta>
}

export function defaultsFrom<M extends AnyComponentMeta>(meta: M) {
  const out: Record<string, unknown> = {}
  for (const [key, prop] of Object.entries(meta.props)) out[key] = prop.default
  return out as { [K in keyof M['props']]: M['props'][K]['default'] }
}
