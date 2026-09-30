// Records short loops of real components for the home hero cards.
// Needs the dev server: node scripts/hero-previews.mjs [baseUrl]
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = process.argv[2] ?? 'http://localhost:3000'

const FRAMES = 10
const STEP_MS = 200
const STAGE = { width: 520, height: 390 }
const CELL = { width: 216, height: 164 }
const INNER = { width: 208, height: 156 }

// Slug, lab query, and whether a cursor should wander over it
const shots = [
  ['dot-grid', 'color=%238fd18b&gap=20&dotSize=4&opacity=0.9', true],
  ['gooey-dots', 'color=%23ff9f66', false],
  ['dot-matrix-text', 'color=%2386b8ff&text=grove', true],
  ['dithered-logo', 'color=%23c7abff', true],
  ['ascii-effect', 'color=%23f0cf6e', true],
  ['dot-globe', 'color=%2374dcc9', false],
  ['ink-bleed', 'color=%23ff94a3&fontSize=84', true],
  ['circular-gallery', '', false],
  ['image-wheel-3d', 'mode=animate', false],
  ['orbit-tiles', '', false],
  ['wheel-carousel', '', false],
  ['text-tunnel', 'textColor=%2386b8ff', false],
  ['morphing-text', 'color=%238fd18b', false],
  ['vector-wordmark', 'color=%23c7abff', true],
  ['expand-on-hover', '', true],
  ['spine-gallery', '', true],
  ['liquid-smoke', '', false],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: STAGE, deviceScaleFactor: 1, colorScheme: 'dark' })
const strips = []

for (const [slug, query, wander] of shots) {
  await page.goto(`${base}/lab/${slug}?${query}`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: 'header, footer { display: none !important }' })
  await page.mouse.move(STAGE.width / 2, STAGE.height / 2)
  await page.waitForTimeout(1500)
  const frames = []
  for (let f = 0; f < FRAMES; f++) {
    if (wander) {
      const a = (f / FRAMES) * Math.PI * 2
      await page.mouse.move(
        STAGE.width / 2 + Math.cos(a) * STAGE.width * 0.22,
        STAGE.height / 2 + Math.sin(a) * STAGE.height * 0.2,
        { steps: 6 },
      )
    }
    await page.waitForTimeout(STEP_MS)
    frames.push((await page.screenshot({ type: 'png' })).toString('base64'))
  }
  strips.push({ slug, frames })
  console.log('captured', slug)
}

// Composite every frame into one sheet inside the browser, then encode WebP
await page.goto('about:blank')
const sheet = await page.evaluate(
  async ({ strips, cell, inner, frames }) => {
    const canvas = document.createElement('canvas')
    canvas.width = cell.width * frames
    canvas.height = cell.height * strips.length
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    for (let r = 0; r < strips.length; r++) {
      for (let f = 0; f < frames; f++) {
        const image = new Image()
        image.src = `data:image/png;base64,${strips[r].frames[f]}`
        await image.decode()
        const x = f * cell.width + (cell.width - inner.width) / 2
        const y = r * cell.height + (cell.height - inner.height) / 2
        ctx.drawImage(image, x, y, inner.width, inner.height)
      }
    }
    return canvas.toDataURL('image/webp', 0.78)
  },
  { strips, cell: CELL, inner: INNER, frames: FRAMES },
)
await browser.close()

const out = join(root, 'apps/web/public/hero')
mkdirSync(out, { recursive: true })
writeFileSync(join(out, 'previews.webp'), Buffer.from(sheet.split(',')[1], 'base64'))
writeFileSync(
  join(root, 'apps/web/components/hero/sheet.ts'),
  `export const sheet = ${JSON.stringify({
    src: '/hero/previews.webp',
    frames: FRAMES,
    rows: strips.length,
    cell: CELL,
    inner: INNER,
    names: strips.map((s) => s.slug),
  })} as const\n`,
)
console.log('sheet', CELL.width * FRAMES, 'x', CELL.height * strips.length)
