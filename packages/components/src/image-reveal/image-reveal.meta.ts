import type { ComponentMeta } from '../lib/meta'
import type { ImageRevealProps } from './image-reveal'

export const imageRevealMeta = {
  name: 'image-reveal',
  title: 'Image Reveal',
  description:
    'A sticky stage where each image wipes up from the bottom as you scroll, then settles back.',
  category: 'galleries',
  usage: { extra: ['items={items}'] },
  props: {
    scrollPerItem: {
      kind: 'number',
      label: 'Scroll per item',
      default: 1600,
      min: 400,
      max: 3000,
      step: 50,
      unit: 'px',
    },
    stageSize: {
      kind: 'string',
      label: 'Stage size',
      default: '576px',
      description: 'Square stage side in px or percent of the viewport height',
    },
    startInset: {
      kind: 'number',
      label: 'Start inset',
      default: 0,
      min: 0,
      max: 0.5,
      step: 0.05,
      description: 'Side inset the wipe starts from, 0 is a full-width curtain',
    },
    grain: { kind: 'number', label: 'Grain', default: 0.35, min: 0, max: 1, step: 0.05 },
    showProgress: { kind: 'boolean', label: 'Show progress', default: true },
    label: { kind: 'string', label: 'Label', default: 'Scroll down to reveal the images' },
    smoothing: { kind: 'number', label: 'Smoothing', default: 0.15, min: 0.02, max: 1, step: 0.02 },
    viewportHeight: {
      kind: 'string',
      label: 'Viewport height',
      default: '100dvh',
      playground: false,
      description: 'CSS height of the sticky stage, 100cqh inside a sized container',
    },
  },
} satisfies ComponentMeta<ImageRevealProps>
