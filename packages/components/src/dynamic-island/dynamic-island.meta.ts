import type { ComponentMeta } from '../lib/meta'
import type { DynamicIslandProps } from './dynamic-island'

export const dynamicIslandMeta = {
  name: 'dynamic-island',
  title: 'Dynamic Island',
  description:
    'A black pill that springs between a compact idle shape and richer live activity states.',
  category: 'effects',
  usage: { extra: ['states={states}'] },
  props: {
    bounce: {
      kind: 'number',
      label: 'Bounce',
      default: 0.2,
      min: 0,
      max: 0.8,
      step: 0.05,
      description: 'Overshoot of the size spring; a state can set its own',
    },
    duration: {
      kind: 'number',
      label: 'Duration',
      default: 800,
      min: 200,
      max: 2000,
      step: 50,
      unit: 'ms',
      description: 'Time for the size spring to settle',
    },
    radius: {
      kind: 'number',
      label: 'Radius',
      default: 32,
      min: 0,
      max: 64,
      step: 1,
      unit: 'px',
      description: 'Corner radius for states without their own, capped at half the height',
    },
    background: { kind: 'color', label: 'Background', default: '#000000' },
    state: {
      kind: 'string',
      label: 'State',
      default: '',
      playground: false,
      description: 'Key of the state to show; leave empty to let the island own it',
    },
    defaultState: {
      kind: 'string',
      label: 'Default state',
      default: '',
      playground: false,
      description: 'Starting key when uncontrolled; empty starts on the first state',
    },
  },
} satisfies ComponentMeta<DynamicIslandProps>
