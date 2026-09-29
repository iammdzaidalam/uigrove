import type { ComponentMeta } from '../lib/meta'
import type { GooeyEffectProps } from './gooey-effect'

export const gooeyEffectMeta = {
  name: 'gooey-effect',
  title: 'Gooey Effect',
  description:
    'Draggable shapes that melt into each other when they touch. Wrap any elements in GooeyEffect.Item; the wrapper and its parent must have no background colour so the filter only sees the shapes.',
  category: 'effects',
  usage: { className: 'h-72 w-full' },
  props: {
    goo: { kind: 'number', label: 'Goo', default: 0.55, min: 0, max: 1, step: 0.05 },
    inertia: { kind: 'boolean', label: 'Inertia', default: true },
    friction: { kind: 'number', label: 'Friction', default: 3.5, min: 1, max: 12, step: 0.5 },
    bounds: { kind: 'boolean', label: 'Bounds', default: true },
  },
} satisfies ComponentMeta<GooeyEffectProps>
