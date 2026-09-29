import type { ComponentMeta } from '../lib/meta'
import type { FilmGrainProps } from './film-grain'

export const filmGrainMeta = {
  name: 'film-grain',
  title: 'Film Grain',
  description:
    'An animated film grain overlay for any section, drawn on the GPU and blended with what sits beneath it.',
  category: 'backgrounds',
  registryDependencies: ['@uigrove/dot-canvas'],
  usage: { name: 'FilmGrain', className: 'absolute inset-0' },
  props: {
    intensity: {
      kind: 'number',
      label: 'Intensity',
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'Contrast of the grain against the surface',
    },
    size: {
      kind: 'number',
      label: 'Grain size',
      default: 1,
      min: 0.5,
      max: 4,
      step: 0.5,
      unit: 'px',
      description: 'Grain cell size in CSS pixels',
    },
    speed: {
      kind: 'number',
      label: 'Speed',
      default: 1,
      min: 0,
      max: 1,
      step: 0.05,
      description: 'How fast cells re-roll, 0 freezes the grain',
    },
    blend: {
      kind: 'select',
      label: 'Blend',
      default: 'overlay',
      options: ['overlay', 'soft-light', 'screen', 'normal'],
      description: 'CSS mix-blend-mode applied to the grain layer',
    },
    monochrome: { kind: 'boolean', label: 'Monochrome', default: true },
    fps: {
      kind: 'number',
      label: 'FPS cap',
      default: 24,
      min: 4,
      max: 60,
      step: 1,
      description: 'Maximum redraws per second',
    },
  },
} satisfies ComponentMeta<FilmGrainProps>
