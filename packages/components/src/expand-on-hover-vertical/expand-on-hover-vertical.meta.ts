import type { ComponentMeta } from '../lib/meta'
import { expandOnHoverVerticalEasings } from './expand-on-hover-vertical.engine'
import type { ExpandOnHoverVerticalProps } from './expand-on-hover-vertical'

export const expandOnHoverVerticalMeta = {
  name: 'expand-on-hover-vertical',
  title: 'Expand on Hover Vertical',
  description:
    'A stack of pill-shaped image rows where the hovered row grows tall and the rest flatten.',
  category: 'galleries',
  usage: { extra: ['items={items}'] },
  props: {
    expandedSize: {
      kind: 'number',
      label: 'Expanded height',
      default: 384,
      min: 120,
      max: 640,
      step: 8,
      unit: 'px',
    },
    collapsedSize: {
      kind: 'number',
      label: 'Collapsed height',
      default: 40,
      min: 16,
      max: 160,
      step: 4,
      unit: 'px',
    },
    width: {
      kind: 'number',
      label: 'Width',
      default: 384,
      min: 120,
      max: 800,
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
      options: expandOnHoverVerticalEasings,
    },
    defaultIndex: { kind: 'number', label: 'Default index', default: 1, min: 0, max: 7, step: 1 },
    expandOn: { kind: 'select', label: 'Expand on', default: 'hover', options: ['hover', 'click'] },
    showLabels: { kind: 'boolean', label: 'Show labels', default: true },
  },
} satisfies ComponentMeta<ExpandOnHoverVerticalProps>
