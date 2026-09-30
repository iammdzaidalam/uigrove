import type { ComponentMeta } from '../lib/meta'
import { pillNavPositions } from './pill-nav.engine'
import type { PillNavProps } from './pill-nav'

export const pillNavMeta = {
  name: 'pill-nav',
  title: 'Pill Nav',
  description:
    'A floating pill navigation bar that unfolds into a full-height menu and opens a command search.',
  category: 'navigation',
  usage: { extra: ['brand="Acme"', 'links={links}'] },
  props: {
    brand: { kind: 'string', label: 'Brand', default: 'Acme' },
    brandHref: { kind: 'string', label: 'Brand link', default: '/' },
    hideOnScroll: { kind: 'boolean', label: 'Hide on scroll', default: false },
    blur: { kind: 'number', label: 'Blur', default: 12, min: 0, max: 40, step: 1, unit: 'px' },
    radius: { kind: 'number', label: 'Radius', default: 16, min: 0, max: 32, step: 1, unit: 'px' },
    height: { kind: 'number', label: 'Height', default: 54, min: 44, max: 80, step: 1, unit: 'px' },
    maxWidth: {
      kind: 'number',
      label: 'Max width',
      default: 768,
      min: 360,
      max: 1200,
      step: 8,
      unit: 'px',
    },
    expandDuration: {
      kind: 'number',
      label: 'Expand duration',
      default: 300,
      min: 0,
      max: 1200,
      step: 50,
      unit: 'ms',
    },
    position: { kind: 'select', label: 'Position', default: 'fixed', options: pillNavPositions },
    command: { kind: 'boolean', label: 'Command search', default: true },
    searchPlaceholder: {
      kind: 'string',
      label: 'Search placeholder',
      default: 'Search pages and links',
    },
  },
} satisfies ComponentMeta<PillNavProps>
