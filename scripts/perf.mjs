import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:3210/'
const shot = process.argv[3]
const seconds = Number(process.argv[4] ?? 3)
const dpr = Number(process.argv[5] ?? 2)

const browser = await chromium.launch({
  channel: 'chromium',
  headless: process.env.HEADED !== '1',
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: dpr,
})
const page = await context.newPage()
const throttle = Number(process.env.THROTTLE ?? 1)
if (throttle > 1) {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
}
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const canvases = await page.evaluate(() =>
  [...document.querySelectorAll('canvas')].map((c) => ({
    w: c.width,
    h: c.height,
    cssW: c.clientWidth,
    cssH: c.clientHeight,
  })),
)

await page.evaluate(() => {
  window.__frames = []
  let last = performance.now()
  const tick = (now) => {
    window.__frames.push(now - last)
    last = now
    window.__raf = requestAnimationFrame(tick)
  }
  window.__raf = requestAnimationFrame(tick)
})

const start = Date.now()
let t = 0
while (Date.now() - start < seconds * 1000) {
  if (process.env.NOMOUSE === '1') {
    await page.waitForTimeout(100)
    continue
  }
  t += 0.05
  const x = 720 + Math.cos(t) * 500
  const y = 450 + Math.sin(t * 1.3) * 300
  await page.mouse.move(x, y)
  if (Math.abs(t % 1.5) < 0.05) await page.mouse.down().then(() => page.mouse.up())
  await page.waitForTimeout(8)
}

const frames = await page.evaluate(() => {
  cancelAnimationFrame(window.__raf)
  return window.__frames.slice(1)
})
frames.sort((a, b) => a - b)
const avg = frames.reduce((a, b) => a + b, 0) / frames.length
const p95 = frames[Math.floor(frames.length * 0.95)]
const max = frames[frames.length - 1]
const dropped = frames.filter((f) => f > 20).length
console.log(
  JSON.stringify(
    {
      url,
      dpr,
      throttle,
      canvases,
      frames: frames.length,
      avgMs: +avg.toFixed(2),
      fps: +(frames.length / seconds).toFixed(1),
      dropped,
      p95Ms: +p95.toFixed(2),
      maxMs: +max.toFixed(2),
      errors,
    },
    null,
    2,
  ),
)

if (shot) await page.screenshot({ path: shot, fullPage: process.env.FULL === '1' })
await browser.close()
