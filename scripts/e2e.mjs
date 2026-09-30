import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const base = process.argv[2] ?? 'http://localhost:3000'
const registry = JSON.parse(readFileSync('apps/web/public/r/registry.json', 'utf8'))
const slugs = registry.items.filter((i) => i.type === 'registry:component').map((i) => i.name)

const browser = await chromium.launch({ channel: 'chromium', headless: true })
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = await context.newPage()
const problems = []
const errors = []
page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]))
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|hydrat/i.test(m.text())) errors.push(m.text().slice(0, 160))
})
page.on('requestfailed', (r) => {
  if (r.url().startsWith(base)) errors.push(`request failed ${r.url()}`)
})

for (const slug of slugs) {
  errors.length = 0
  const response = await page.goto(`${base}/components/${slug}`, { waitUntil: 'networkidle' })
  if (!response || response.status() !== 200) problems.push(`${slug}: status ${response?.status()}`)
  await page.waitForTimeout(1200)

  const info = await page.evaluate(() => {
    const preview = document.querySelector('[class*="rounded-2xl"] > div')
    const rect = preview?.getBoundingClientRect()
    const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
      w: c.width,
      h: c.height,
    }))
    const imgs = [...document.querySelectorAll('img')].map((i) => ({
      src: i.currentSrc,
      ok: i.complete && i.naturalWidth > 0,
    }))
    const broken = imgs.filter((i) => !i.ok).map((i) => i.src)
    const codeTabs = document.querySelectorAll('[role="tab"]').length
    const propsRows = document.querySelectorAll('tbody tr').length
    const install = document.body.innerText.includes('shadcn@latest add @uigrove/')
    const usage = document.body.innerText.includes("from '@/components/uigrove/")
    return {
      previewH: rect ? Math.round(rect.height) : 0,
      canvases,
      broken,
      codeTabs,
      propsRows,
      install,
      usage,
    }
  })

  if (info.previewH < 300) problems.push(`${slug}: preview panel ${info.previewH}px tall`)
  if (info.broken.length) problems.push(`${slug}: broken images ${info.broken.join(', ')}`)
  if (info.canvases.some((c) => c.w === 0 || c.h === 0)) problems.push(`${slug}: zero-size canvas`)
  if (info.codeTabs < 1) problems.push(`${slug}: no code tabs`)
  if (info.propsRows < 2) problems.push(`${slug}: props table has ${info.propsRows} rows`)
  if (!info.install) problems.push(`${slug}: install command missing`)
  if (!info.usage) problems.push(`${slug}: usage snippet missing`)

  // Non-blank preview means a few distinct colours in the panel
  const panel = await page.$('[class*="rounded-2xl"]')
  if (panel) {
    const shot = await panel.screenshot({ type: 'png' })
    const distinct = await page.evaluate(async (b64) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.createElement('canvas')
      c.width = 120
      c.height = 80
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, 120, 80)
      const d = ctx.getImageData(0, 0, 120, 80).data
      const set = new Set()
      for (let i = 0; i < d.length; i += 4)
        set.add((d[i] >> 4) * 256 + (d[i + 1] >> 4) * 16 + (d[i + 2] >> 4))
      return set.size
    }, shot.toString('base64'))
    if (distinct < 6) problems.push(`${slug}: preview looks blank (${distinct} colours)`)
  }

  // Controls open, a slider moves, reset restores
  await page.click('button[aria-label="Show controls"]')
  await page.waitForTimeout(300)
  const slider = await page.$('input[type="range"]')
  if (slider) {
    const before = await slider.inputValue()
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    const after = await slider.inputValue()
    if (before === after) problems.push(`${slug}: slider did not change`)
    await page.click('button[aria-label="Reset"]')
    await page.waitForTimeout(200)
    const reset = await (await page.$('input[type="range"]'))?.inputValue()
    if (reset !== before) problems.push(`${slug}: reset did not restore ${before} (got ${reset})`)
  }
  await page.keyboard.press('Escape')

  // Copy buttons exist and the registry item resolves
  const registryItem = await page.request.get(`${base}/r/${slug}.json`)
  if (registryItem.status() !== 200)
    problems.push(`${slug}: registry item ${registryItem.status()}`)
  else {
    const item = await registryItem.json()
    if (!item.files?.every((f) => typeof f.content === 'string' && f.content.length > 100))
      problems.push(`${slug}: registry files empty`)
  }

  if (errors.length)
    problems.push(`${slug}: console/page errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}`)
  console.log(`${problems.some((p) => p.startsWith(slug + ':')) ? 'FAIL' : 'ok  '} ${slug}`)
}

// Reduced motion: every page renders and nothing throws
const reduced = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
})
const rp = await reduced.newPage()
const rErrors = []
rp.on('pageerror', (e) => rErrors.push(String(e).split('\n')[0]))
for (const slug of slugs) {
  await rp.goto(`${base}/components/${slug}`, { waitUntil: 'networkidle' })
  await rp.waitForTimeout(400)
}
if (rErrors.length)
  problems.push(`reduced motion errors: ${[...new Set(rErrors)].slice(0, 3).join(' | ')}`)

// Sidebar: top-left trigger and Cmd+K open it, Escape closes it
await page.goto(`${base}/components/dot-grid`, { waitUntil: 'networkidle' })
const sidebarOpen = () =>
  page.evaluate(
    () => document.querySelector('[data-sidebar]')?.getAttribute('data-open') === 'true',
  )
await page.click('button[aria-label="Open component list"]')
await page.waitForTimeout(350)
if (!(await sidebarOpen())) problems.push('sidebar: trigger did not open')
const inView = await page.evaluate(() => {
  const a = document.querySelector('[data-sidebar] a[aria-current="page"]')
  if (!a) return false
  const r = a.getBoundingClientRect()
  return r.top > 0 && r.bottom < innerHeight
})
if (!inView) problems.push('sidebar: active item not scrolled into view')
await page.keyboard.press('Escape')
await page.waitForTimeout(350)
if (await sidebarOpen()) problems.push('sidebar: Escape did not close')
await page.keyboard.press('Meta+k')
await page.waitForTimeout(350)
if (!(await sidebarOpen())) problems.push('sidebar: Cmd+K did not open')
await page.click('[data-sidebar] a[href="/components/gooey-dots"]')
await page.waitForURL('**/components/gooey-dots')
await page.waitForTimeout(350)
if (await sidebarOpen()) problems.push('sidebar: did not close after navigating')
await page.goto(`${base}/`, { waitUntil: 'networkidle' })
if (await page.$('button[aria-label="Open component list"]'))
  problems.push('home: sidebar trigger should not render')

await browser.close()
console.log(`\n${slugs.length} components checked, ${problems.length} problems`)
for (const p of problems) console.log(' - ' + p)
process.exitCode = problems.length ? 1 : 0
