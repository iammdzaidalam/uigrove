import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, 'source-tree-light.svg'), 'utf8')

const ellipses = [...src.matchAll(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)].map(
  (m) => ({ cx: +m[1], cy: +m[2], rx: +m[3], ry: +m[4] }),
)
const paths = [...src.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])

const pitch = 48
const xs = ellipses.map((e) => e.cx)
const ys = ellipses.map((e) => e.cy)
const minCx = Math.min(...xs)
const minCy = Math.min(...ys)
const r = ellipses[0].rx

const minX = minCx - r
const minY = minCy - r
const maxX = Math.max(...xs) + r
const maxY = Math.max(...ys) + r
const w = round(maxX - minX)
const h = round(maxY - minY)

const cols = Math.round((Math.max(...xs) - minCx) / pitch) + 1
const rows = Math.round((Math.max(...ys) - minCy) / pitch) + 1
const points = ellipses
  .map((e) => [Math.round((e.cx - minCx) / pitch), Math.round((e.cy - minCy) / pitch)])
  .sort((a, b) => a[1] - b[1] || a[0] - b[0])

function round(n) {
  return Math.round(n * 100) / 100
}

function shiftPath(d) {
  const t = d.trim().split(/\s+/)
  const out = []
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === 'M') {
      out.push('M', round(+t[i + 1] - minX), round(+t[i + 2] - minY))
      i += 2
    } else if (c === 'A') {
      out.push('A', t[i + 1], t[i + 2], t[i + 3], t[i + 4], t[i + 5], round(+t[i + 6] - minX), round(+t[i + 7] - minY))
      i += 7
    } else out.push(c)
  }
  return out.join(' ')
}

const shapes = [
  ...ellipses.map((e) => `<circle cx="${round(e.cx - minX)}" cy="${round(e.cy - minY)}" r="${round(e.rx)}"/>`),
  ...paths.map((d) => `<path d="${shiftPath(d)}"/>`),
].join('\n    ')

function svg({ fill, background, pad = 0, radius = 0 }) {
  const vw = round(w + pad * 2)
  const vh = round(h + pad * 2)
  const bg = background
    ? `\n  <rect width="${vw}" height="${vh}" rx="${radius}" fill="${background}"/>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}">${bg}
  <g fill="${fill}" transform="translate(${pad} ${pad})">
    ${shapes}
  </g>
</svg>
`
}

writeFileSync(join(dir, 'uigrove-mark.svg'), svg({ fill: 'currentColor' }))
writeFileSync(join(dir, 'uigrove-mark-light.svg'), svg({ fill: '#1d1d1f' }))
writeFileSync(join(dir, 'uigrove-mark-dark.svg'), svg({ fill: '#ffffff' }))

const side = Math.max(w, h)
const favPad = side * 0.18
const favSize = round(side + favPad * 2)
writeFileSync(
  join(dir, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${favSize} ${favSize}" width="${favSize}" height="${favSize}">
  <rect width="${favSize}" height="${favSize}" rx="${round(favSize * 0.22)}" fill="#09090c"/>
  <g fill="#ffffff" transform="translate(${round((favSize - w) / 2)} ${round((favSize - h) / 2)})">
    ${shapes}
  </g>
</svg>
`,
)


console.log({ dots: ellipses.length, blends: paths.length, cols, rows, width: w, height: h })

const bboxOf = (d) => {
  const t = d.trim().split(/\s+/)
  const xs = []
  const ys = []
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 'M') {
      xs.push(+t[i + 1])
      ys.push(+t[i + 2])
      i += 2
    } else if (t[i] === 'A') {
      xs.push(+t[i + 6])
      ys.push(+t[i + 7])
      i += 7
    }
  }
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 }
}
const gridIndex = new Map(points.map((pt, i) => [pt.join(','), i]))
const cellOf = (e) => [Math.round((e.cx - minCx) / pitch), Math.round((e.cy - minCy) / pitch)]
const links = []
for (const d of paths) {
  const b = bboxOf(d)
  let best = null
  for (let i = 0; i < ellipses.length; i++) {
    for (let j = i + 1; j < ellipses.length; j++) {
      const a = ellipses[i]
      const c = ellipses[j]
      if (Math.hypot(a.cx - c.cx, a.cy - c.cy) > pitch * 1.5) continue
      const err = Math.hypot((a.cx + c.cx) / 2 - b.cx, (a.cy + c.cy) / 2 - b.cy)
      if (!best || err < best.err) best = { i, j, err }
    }
  }
  if (best && best.err < 6) {
    links.push([gridIndex.get(cellOf(ellipses[best.i]).join(',')), gridIndex.get(cellOf(ellipses[best.j]).join(','))])
  }
}

const circles = ellipses.map((e) => [round(e.cx - minX), round(e.cy - minY), round(e.rx)])
const shifted = paths.map(shiftPath)
writeFileSync(
  join(dir, '..', 'apps', 'web', 'components', 'logo-shapes.ts'),
  `export const logoViewBox = [${w}, ${h}] as const\n` +
    `export const logoCircles: ReadonlyArray<readonly [number, number, number]> = ${JSON.stringify(circles)}\n` +
    `export const logoPaths: readonly string[] = ${JSON.stringify(shifted)}\n` +
    `export const logoPoints: ReadonlyArray<readonly [number, number]> = ${JSON.stringify(points)}\n` +
    `export const logoLinks: ReadonlyArray<readonly [number, number]> = ${JSON.stringify(links)}\n`,
)

writeFileSync(
  join(dir, 'tree-points.json'),
  JSON.stringify({ cols, rows, pitch, dotRadius: round(r), width: w, height: h, points, links }) + '\n',
)
