export type SpineGalleryEasing = 'spring' | 'ease' | 'ease-in-out' | 'ease-out' | 'expo-out'

export const spineGalleryEasings: readonly SpineGalleryEasing[] = [
  'spring',
  'ease',
  'ease-in-out',
  'ease-out',
  'expo-out',
]

const SPRING_DAMPING = 0.89
const SPRING_SAMPLES = 40

// Damped spring sampled into a CSS linear() easing curve
export function spineGallerySpring(zeta = SPRING_DAMPING, samples = SPRING_SAMPLES) {
  const omega = 5.3 / zeta
  const damped = omega * Math.sqrt(1 - zeta * zeta)
  const points: string[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const decay = Math.exp(-zeta * omega * t)
    const x = 1 - decay * (Math.cos(damped * t) + ((zeta * omega) / damped) * Math.sin(damped * t))
    points.push(i === samples ? '1' : x.toFixed(4))
  }
  return `linear(${points.join(', ')})`
}

const CURVES: Record<SpineGalleryEasing, string> = {
  spring: spineGallerySpring(),
  ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  'ease-in-out': 'cubic-bezier(0.42, 0, 0.58, 1)',
  'ease-out': 'cubic-bezier(0, 0, 0.58, 1)',
  'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
}

export function spineGalleryTiming(easing: SpineGalleryEasing) {
  return CURVES[easing] ?? CURVES.spring
}

export const LINE_HEIGHT = 1.3
const IMAGE_GAP_RATIO = 0.25

export function spineGalleryTransition(
  properties: readonly string[],
  duration: number,
  easing: SpineGalleryEasing,
) {
  if (duration <= 0) return 'none'
  const curve = spineGalleryTiming(easing)
  return properties.map((property) => `${property} ${duration}ms ${curve}`).join(', ')
}

// Collapsed columns share the leftover width, never below their minimum
export function spineGalleryWidth(
  expanded: boolean,
  expandedSize: number,
  collapsedSize: number,
  count: number,
) {
  if (count < 2) return '100%'
  if (expanded) return `${expandedSize}px`
  return `max(${collapsedSize}px, calc((100% - ${expandedSize}px) / ${count - 1}))`
}

export function spineGalleryRail(labelSize: number, collapsedSize: number) {
  const rail = labelSize * LINE_HEIGHT
  const left = Math.max(4, (collapsedSize - rail) / 2)
  return { left, imageLeft: Math.round(left + rail + labelSize * IMAGE_GAP_RATIO) }
}

export function spineGalleryStep(key: string, active: number, count: number) {
  const last = Math.max(0, count - 1)
  switch (key) {
    case 'ArrowRight':
      return Math.min(active + 1, last)
    case 'ArrowLeft':
      return Math.max(active - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return last
    default:
      return null
  }
}

export function spineGalleryClamp(index: number, count: number) {
  return Math.min(Math.max(index, 0), Math.max(0, count - 1))
}
