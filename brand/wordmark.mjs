import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(dir, 'source-wordmark-light.svg'), 'utf8')
const ink = '#1d1d1f'
const PITCH = 48

const round = (n, p = 100) => Math.round(n * p) / p
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]))

// Only the glyph ink, not the export background or caption
const rects = [...src.matchAll(/<rect ([^>]*)\/>/g)]
  .map((m) => attrs(m[1]))
  .filter((a) => a.fill === ink && a.x !== undefined)
  .map((a) => ({ x: +a.x, y: +a.y, w: +a.width, h: +a.height, rx: +(a.rx ?? 0) }))
const paths = [...src.matchAll(/<path ([^>]*)\/>/g)]
  .map((m) => attrs(m[1]))
  .filter((a) => a.fill === ink)
  .map((a) => a.d)

function tokens(d) {
  return d.trim().split(/\s+/)
}

function pathBox(d) {
  const t = tokens(d)
  const xs = []
  const ys = []
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 'M' || t[i] === 'L') xs.push(+t[i + 1]), ys.push(+t[i + 2]), (i += 2)
    else if (t[i] === 'A') xs.push(+t[i + 6]), ys.push(+t[i + 7]), (i += 7)
  }
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

// Rewrites a path through fx/fy, arcs scale their radius by k
function mapPath(d, fx, fy, k = 1, p = 100) {
  const t = tokens(d)
  const out = []
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === 'M' || c === 'L') out.push(c, round(fx(+t[i + 1]), p), round(fy(+t[i + 2]), p)), (i += 2)
    else if (c === 'A')
      out.push('A', round(+t[i + 1] * k, p), round(+t[i + 2] * k, p), t[i + 3], t[i + 4], t[i + 5], round(fx(+t[i + 6]), p), round(fy(+t[i + 7]), p)),
        (i += 7)
    else out.push(c)
  }
  return out.join(' ')
}

function rectPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  if (r <= 0) return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
  return [
    `M ${x + r} ${y}`, `L ${x + w - r} ${y}`, `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `L ${x + w} ${y + h - r}`, `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `L ${x + r} ${y + h}`, `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `L ${x} ${y + r}`, `A ${r} ${r} 0 0 1 ${x + r} ${y}`, 'Z',
  ].join(' ')
}

const boxes = [...rects.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })), ...paths.map(pathBox)]
const minX = Math.min(...boxes.map((b) => b.x))
const minY = Math.min(...boxes.map((b) => b.y))
const width = round(Math.max(...boxes.map((b) => b.x + b.w)) - minX)
const height = round(Math.max(...boxes.map((b) => b.y + b.h)) - minY)

const staticRects = rects.map((r) => [round(r.x - minX), round(r.y - minY), round(r.w), round(r.h), round(r.rx)])
const staticPaths = paths.map((d) => mapPath(d, (x) => x - minX, (y) => y - minY))

// Every piece becomes a point at its centre with a shape in grid units
const pieces = [
  ...rects.map((r) => ({ cx: r.x + r.w / 2, cy: r.y + r.h / 2, d: rectPath(-r.w / 2, -r.h / 2, r.w, r.h, r.rx) })),
  ...paths.map((d) => {
    const b = pathBox(d)
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    return { cx, cy, d: mapPath(d, (x) => x - cx, (y) => y - cy) }
  }),
]
const cells = rects.filter((r) => r.w > PITCH * 0.8)
const ox = Math.min(...cells.map((r) => r.x + r.w / 2))
const oy = Math.min(...cells.map((r) => r.y + r.h / 2))
const shapes = []
const shapeIndex = new Map()
const points = pieces.map(({ cx, cy, d }) => {
  const unit = mapPath(d, (x) => x / PITCH, (y) => y / PITCH, 1 / PITCH, 10000)
  if (!shapeIndex.has(unit)) shapeIndex.set(unit, shapes.push(unit) - 1)
  return [round((cx - ox) / PITCH, 10000), round((cy - oy) / PITCH, 10000), 3 + shapeIndex.get(unit)]
})
// Cells first so the goo reads them as the body
points.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0])
const cellSize = round(cells[0].w / PITCH, 10000)

const shapesSvg = [
  ...staticRects.map(([x, y, w, h, rx]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`),
  ...staticPaths.map((d) => `<path d="${d}"/>`),
].join('\n    ')
const svg = (fill) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <g fill="${fill}">
    ${shapesSvg}
  </g>
</svg>
`
writeFileSync(join(dir, 'uigrove-wordmark.svg'), svg('currentColor'))
writeFileSync(join(dir, 'uigrove-wordmark-light.svg'), svg('#1d1d1f'))
writeFileSync(join(dir, 'uigrove-wordmark-dark.svg'), svg('#ffffff'))
for (const name of ['uigrove-wordmark.svg', 'uigrove-wordmark-light.svg', 'uigrove-wordmark-dark.svg']) {
  writeFileSync(join(dir, '..', 'apps', 'web', 'public', 'brand', name), readFileSync(join(dir, name)))
}

writeFileSync(
  join(dir, '..', 'apps', 'web', 'components', 'wordmark-shapes.ts'),
  `export const wordmarkViewBox = [${width}, ${height}] as const\n` +
    `export const wordmarkRects: ReadonlyArray<readonly [number, number, number, number, number]> = ${JSON.stringify(staticRects)}\n` +
    `export const wordmarkPaths: readonly string[] = ${JSON.stringify(staticPaths)}\n` +
    `export const wordmarkShapes: readonly string[] = ${JSON.stringify(shapes)}\n` +
    `export const wordmarkPoints: ReadonlyArray<readonly [number, number, number]> = ${JSON.stringify(points)}\n` +
    `export const wordmarkCell = ${cellSize}\n` +
    `export const wordmarkGrid = { left: ${round((ox - minX) / PITCH, 10000)}, top: ${round((oy - minY) / PITCH, 10000)}, width: ${round(width / PITCH, 10000)}, height: ${round(height / PITCH, 10000)} } as const\n`,
)
console.log({ rects: rects.length, paths: paths.length, width, height, points: points.length, shapes: shapes.length, cellSize })
