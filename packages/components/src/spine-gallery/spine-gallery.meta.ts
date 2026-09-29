import type { ComponentMeta } from '../lib/meta'
import { spineGalleryEasings } from './spine-gallery.engine'
import type { SpineGalleryProps } from './spine-gallery'

export const spineGalleryMeta = {
  name: 'spine-gallery',
  title: 'Spine Gallery',
  description:
    'Thin ruled columns with vertical names that open wide on hover to reveal a photo and a year.',
  category: 'galleries',
  usage: { className: 'h-[560px]', extra: ['items={items}'] },
  props: {
    expandedSize: {
      kind: 'number',
      label: 'Expanded width',
      default: 448,
      min: 160,
      max: 800,
      step: 8,
      unit: 'px',
    },
    collapsedSize: {
      kind: 'number',
      label: 'Collapsed size',
      default: 64,
      min: 24,
      max: 160,
      step: 2,
      unit: 'px',
      description: 'Minimum width of a closed column, the row clips past the edge',
    },
    labelSize: {
      kind: 'number',
      label: 'Label size',
      default: 28,
      min: 12,
      max: 48,
      step: 1,
      unit: 'px',
    },
    radius: { kind: 'number', label: 'Radius', default: 12, min: 0, max: 40, step: 1, unit: 'px' },
    duration: {
      kind: 'number',
      label: 'Duration',
      default: 400,
      min: 0,
      max: 1200,
      step: 50,
      unit: 'ms',
    },
    easing: { kind: 'select', label: 'Easing', default: 'spring', options: spineGalleryEasings },
    defaultIndex: { kind: 'number', label: 'Default index', default: 0, min: 0, max: 9, step: 1 },
    expandOn: { kind: 'select', label: 'Expand on', default: 'hover', options: ['hover', 'click'] },
    showImages: { kind: 'boolean', label: 'Show images', default: true },
    mutedOpacity: {
      kind: 'number',
      label: 'Muted opacity',
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
    },
    lineOpacity: {
      kind: 'number',
      label: 'Line opacity',
      default: 0.3,
      min: 0,
      max: 1,
      step: 0.05,
    },
  },
} satisfies ComponentMeta<SpineGalleryProps>
