import type { ComponentMeta } from '../lib/meta'
import { expandOnHoverEasings } from './expand-on-hover.engine'
import type { ExpandOnHoverProps } from './expand-on-hover'

export const expandOnHoverMeta = {
  name: 'expand-on-hover',
  title: 'Expand on Hover',
  description:
    'A row of tall pill-shaped image strips where the hovered strip widens and the rest shrink.',
  category: 'galleries',
  usage: { extra: ['items={items}'] },
  props: {
    expandedSize: {
      kind: 'number',
      label: 'Expanded width',
      default: 384,
      min: 120,
      max: 640,
      step: 8,
      unit: 'px',
    },
    collapsedSize: {
      kind: 'number',
      label: 'Collapsed width',
      default: 80,
      min: 24,
      max: 200,
      step: 4,
      unit: 'px',
    },
    height: {
      kind: 'number',
      label: 'Height',
      default: 384,
      min: 120,
      max: 640,
      step: 8,
      unit: 'px',
    },
    gap: { kind: 'number', label: 'Gap', default: 4, min: 0, max: 32, step: 1, unit: 'px' },
    radius: { kind: 'number', label: 'Radius', default: 24, min: 0, max: 64, step: 1, unit: 'px' },
    duration: {
      kind: 'number',
      label: 'Duration',
      default: 300,
      min: 0,
      max: 1200,
      step: 50,
      unit: 'ms',
    },
    easing: {
      kind: 'select',
      label: 'Easing',
      default: 'ease-in-out',
      options: expandOnHoverEasings,
    },
    defaultIndex: { kind: 'number', label: 'Default index', default: 1, min: 0, max: 8, step: 1 },
    expandOn: { kind: 'select', label: 'Expand on', default: 'hover', options: ['hover', 'click'] },
    showLabels: { kind: 'boolean', label: 'Show labels', default: true },
  },
} satisfies ComponentMeta<ExpandOnHoverProps>
