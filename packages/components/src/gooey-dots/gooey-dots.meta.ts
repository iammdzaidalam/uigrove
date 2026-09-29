import type { ComponentMeta } from '../lib/meta'
import type { GooeyDotsProps } from './gooey-dots'

export const gooeyDotsMeta = {
  name: 'gooey-dots',
  title: 'Gooey Dots',
  description: 'Drifting dots that merge into one liquid shape when they come close.',
  category: 'effects',
  registryDependencies: ['@uigrove/dot-canvas'],
  usage: { className: 'absolute inset-0' },
  props: {
    count: { kind: 'number', label: 'Count', default: 24, min: 1, max: 400, step: 1 },
    size: { kind: 'number', label: 'Size', default: 28, min: 4, max: 80, step: 1, unit: 'px' },
    sizeVariance: {
      kind: 'number',
      label: 'Size variance',
      default: 0.4,
      min: 0,
      max: 0.9,
      step: 0.05,
    },
    color: { kind: 'color', label: 'Color', default: '#ffffff' },
    goo: { kind: 'number', label: 'Goo', default: 0.6, min: 0, max: 1, step: 0.05 },
    speed: { kind: 'number', label: 'Speed', default: 1, min: 0, max: 4, step: 0.1 },
    wander: { kind: 'number', label: 'Wander', default: 60, min: 0, max: 200, step: 5 },
    cursorRadius: {
      kind: 'number',
      label: 'Cursor radius',
      default: 220,
      min: 40,
      max: 500,
      step: 10,
      unit: 'px',
    },
    cursorMode: {
      kind: 'select',
      label: 'Cursor',
      default: 'attract',
      options: ['attract', 'repel', 'none'],
    },
    cursorStrength: {
      kind: 'number',
      label: 'Cursor strength',
      default: 260,
      min: 0,
      max: 800,
      step: 10,
    },
    seed: { kind: 'number', label: 'Seed', default: 7, min: 1, max: 99, step: 1 },
  },
} satisfies ComponentMeta<GooeyDotsProps>
