export type ExpandOnHoverEasing = 'ease-in-out' | 'ease' | 'ease-out' | 'expo-out' | 'spring'

export const expandOnHoverEasings: readonly ExpandOnHoverEasing[] = [
  'ease-in-out',
  'ease',
  'ease-out',
  'expo-out',
  'spring',
]

const SPRING_DAMPING = 0.89
const SPRING_SAMPLES = 40

// Damped spring sampled into a CSS linear() easing curve
export function expandOnHoverSpring(zeta = SPRING_DAMPING, samples = SPRING_SAMPLES) {
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

const CURVES: Record<ExpandOnHoverEasing, string> = {
  'ease-in-out': 'cubic-bezier(0.42, 0, 0.58, 1)',
  ease: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
  'ease-out': 'cubic-bezier(0, 0, 0.58, 1)',
  'expo-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
  spring: expandOnHoverSpring(),
}

export function expandOnHoverTiming(easing: ExpandOnHoverEasing) {
  return CURVES[easing] ?? CURVES['ease-in-out']
}

export function expandOnHoverTransition(
  properties: readonly string[],
  duration: number,
  easing: ExpandOnHoverEasing,
) {
  if (duration <= 0) return 'none'
  const curve = expandOnHoverTiming(easing)
  return properties.map((property) => `${property} ${duration}ms ${curve}`).join(', ')
}

export function expandOnHoverStep(key: string, active: number, count: number) {
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

export function expandOnHoverClamp(index: number, count: number) {
  return Math.min(Math.max(index, 0), Math.max(0, count - 1))
}
