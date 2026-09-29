import type { ComponentMeta } from '../lib/meta'
import type { DevouringSignInProps } from './devouring-sign-in'

export const devouringSignInMeta = {
  name: 'devouring-sign-in',
  title: 'Devouring Sign In',
  description: 'A large email field whose text is eaten into dust from the right when you submit.',
  category: 'effects',
  usage: { extra: ['onSubmit={(email) => console.log(email)}'] },
  props: {
    placeholder: { kind: 'string', label: 'Placeholder', default: 'you@example.com' },
    label: {
      kind: 'string',
      label: 'Label',
      default: 'Email address',
      description: 'Screen reader label for the input',
    },
    hint: { kind: 'string', label: 'Submit hint', default: '[ enter ↵ ]' },
    fontSize: {
      kind: 'number',
      label: 'Font size',
      default: 60,
      min: 24,
      max: 96,
      step: 2,
      unit: 'px',
    },
    speed: { kind: 'number', label: 'Speed', default: 1, min: 0.25, max: 4, step: 0.25 },
  },
} satisfies ComponentMeta<DevouringSignInProps>
