import type { PillNavLink, PillNavMenuSection } from './pill-nav'

export const pillNavDemoLinks: PillNavLink[] = [
  { label: 'Docs', href: '#docs' },
  { label: 'Components', href: '#components' },
]

export const pillNavDemoMenu: PillNavMenuSection[] = [
  {
    title: 'Explore',
    items: [
      { label: 'Get started', href: '#start', description: '[install guide]' },
      { label: 'Components', href: '#components', description: '[the whole grove]' },
      { label: 'Showcase', href: '#showcase', description: '[built with it]' },
      { label: 'Changelog', href: '#changelog', description: '[what is new]' },
      { label: 'Say hello', href: '#contact', description: '[write to us]' },
      {
        label: 'Source',
        href: 'https://github.com/iammdzaidalam',
        description: '[on github]',
        external: true,
      },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Privacy', href: '#privacy' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Status',
    items: [{ label: 'Free to use' }, { label: 'Built for shadcn' }],
  },
]
