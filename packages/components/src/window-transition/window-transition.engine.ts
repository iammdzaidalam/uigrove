export type WindowEasing = 'expo' | 'ui' | 'ease-in-out' | 'circ'
export type WindowOrigin = 'center' | 'bottom' | 'top'

export interface WindowEngineOptions {
  width: number
  height: number
  windowSize: number
  radius: number
  origin: WindowOrigin
  zoom: number
  dim: number
  shrink: number
  easing: WindowEasing
}

export interface WindowKeyframes {
  window: Keyframe[]
  content: Keyframe[]
  back: Keyframe[]
}

export const windowEasings: Record<WindowEasing, string> = {
  expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  ui: 'cubic-bezier(0.32, 0.72, 0, 1)',
  'ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
  circ: 'cubic-bezier(0, 0.55, 0.45, 1)',
}

const WINDOW_ASPECT = 0.62
const PILL_SCALE = 0.12
const EDGE_INSET = 40
const RISE_END = 0.3
const RISE_EASING = 'cubic-bezier(0.45, 0, 0.2, 1)'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

// Inset rectangle centered on cx, cy in the box
function insetRect(
  width: number,
  height: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
  radius: number,
) {
  const top = cy - h / 2
  const left = cx - w / 2
  return `inset(${top}px ${width - left - w}px ${height - top - h}px ${left}px round ${radius}px)`
}

// Keyframes carry their own easing so the timeline runs linear
export function windowKeyframes(options: WindowEngineOptions): WindowKeyframes {
  const { width, height, radius, origin, zoom, dim, shrink } = options
  const easing = windowEasings[options.easing]
  const w0 = clamp(options.windowSize, 8, width)
  const h0 = clamp(options.windowSize * WINDOW_ASPECT, 8, height)
  const cx = width / 2
  const cy = height / 2
  const full = `inset(0px 0px 0px 0px round 0px)`
  const back: Keyframe[] = [
    { opacity: 1, transform: 'scale(1)', easing },
    { opacity: 1 - clamp(dim, 0, 1), transform: `scale(${1 - clamp(shrink, 0, 0.5)})` },
  ]
  if (origin === 'center') {
    return {
      window: [
        { clipPath: insetRect(width, height, cx, cy, w0, h0, radius), easing },
        { clipPath: full },
      ],
      content: [{ transform: `scale(${zoom})`, easing }, { transform: 'scale(1)' }],
      back,
    }
  }
  const startY = origin === 'bottom' ? height - EDGE_INSET : EDGE_INSET
  const pillW = Math.max(12, w0 * PILL_SCALE)
  const pillH = Math.max(8, h0 * PILL_SCALE)
  const midZoom = 1 + (zoom - 1) * (1 - RISE_END)
  return {
    window: [
      {
        clipPath: insetRect(width, height, cx, startY, pillW, pillH, radius),
        offset: 0,
        easing: RISE_EASING,
      },
      { clipPath: insetRect(width, height, cx, cy, w0, h0, radius), offset: RISE_END, easing },
      { clipPath: full, offset: 1 },
    ],
    content: [
      {
        transform: `translate3d(0, ${startY - cy}px, 0) scale(${zoom})`,
        offset: 0,
        easing: RISE_EASING,
      },
      { transform: `translate3d(0, 0, 0) scale(${midZoom})`, offset: RISE_END, easing },
      { transform: 'translate3d(0, 0, 0) scale(1)', offset: 1 },
    ],
    back,
  }
}
