import type { ComponentMeta } from '../lib/meta'
import type { LiquidSmokeProps } from './liquid-smoke'

export const liquidSmokeMeta = {
  name: 'liquid-smoke',
  title: 'Liquid Smoke',
  description:
    'Slow plumes of smoke rising from the bottom of a section, drawn with warped noise on the GPU.',
  category: 'backgrounds',
  registryDependencies: ['@uigrove/dot-canvas'],
  usage: { className: 'absolute inset-0' },
  props: {
    color: {
      kind: 'color',
      label: 'Smoke',
      default: '#f5f5f7',
      description: 'Smoke color at full intensity',
    },
    background: { kind: 'color', label: 'Background', default: '#09090c' },
    intensity: { kind: 'number', label: 'Intensity', default: 0.7, min: 0, max: 2, step: 0.05 },
    scale: {
      kind: 'number',
      label: 'Scale',
      default: 2.2,
      min: 0.5,
      max: 6,
      step: 0.1,
      description: 'Noise frequency, higher is finer',
    },
    speed: { kind: 'number', label: 'Speed', default: 0.35, min: 0, max: 2, step: 0.05 },
    height: {
      kind: 'number',
      label: 'Height',
      default: 0.7,
      min: 0.1,
      max: 1.5,
      step: 0.05,
      description: 'How far up the plumes reach',
    },
    warp: {
      kind: 'number',
      label: 'Warp',
      default: 2.4,
      min: 0,
      max: 6,
      step: 0.1,
      description: 'Domain warping, more turbulence',
    },
    grain: { kind: 'number', label: 'Grain', default: 0.25, min: 0, max: 1, step: 0.05 },
    seed: { kind: 'number', label: 'Seed', default: 3, min: 0, max: 100, step: 1 },
  },
} satisfies ComponentMeta<LiquidSmokeProps>
