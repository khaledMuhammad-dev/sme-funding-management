import { test, expect, gotoApp, pinLocale } from './support/app'
import type { Page } from '@playwright/test'

/**
 * The client's brand mark.
 *
 * The supplied artwork hardcoded a white background rect and `#172D4B` ink, so
 * the risk these tests exist to cover is a mark that quietly becomes an
 * invisible dark-on-dark block in dark mode, or a set of hairlines that collapse
 * at header size. Both are asserted numerically rather than by eyeball.
 */

const MARK = '[data-testid="brand-mark"]'

/** The nine lines, in artwork order — their finished `d` attributes. */
const FINAL_LINES = [
  'M31.5 25 L31.5 93',
  'M74 25 L31 126',
  'M115 25 L31 166',
  'M163 25 L31 206',
  'M218 25 L35 230',
  'M218 79 L68 230',
  'M218 129 L98 230',
  'M218 176 L130 230',
  'M221 212 L169 230',
]

/**
 * Reads the mark's ink colour and the surface behind it as sRGB, using the
 * page's own canvas to normalise whatever colour syntax the tokens resolve to
 * (`oklch()` here), then returns the WCAG contrast ratio between them.
 */
async function inkContrast(page: Page) {
  return page.evaluate((sel) => {
    const svg = document.querySelector(sel)
    if (!svg) throw new Error('brand mark not found')

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const toRgb = (value: string): [number, number, number] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
      return [r / 255, g / 255, b / 255]
    }
    const luminance = (rgb: [number, number, number]) => {
      const [r, g, b] = rgb.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    const ink = toRgb(getComputedStyle(svg).color)
    // The header is `bg-background/85` over page content, so `--background` is
    // what the mark is effectively read against.
    const surface = toRgb(
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
    )

    const [a, b] = [luminance(ink), luminance(surface)].sort((x, y) => y - x)
    return { ratio: (a + 0.05) / (b + 0.05), ink, surface }
  }, MARK)
}

test('the mark renders on both shells with the full nine-line artwork', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  for (const path of ['/', '/admin']) {
    await gotoApp(page, path)
    const mark = page.locator(MARK).first()
    await expect(mark).toBeVisible()

    const paths = mark.locator('[data-brand="lines"] path')
    await expect(paths).toHaveCount(FINAL_LINES.length)

    // The mount morph has long finished by the time `gotoApp` settles: every
    // line must have arrived at the artwork's authoritative coordinates.
    for (let i = 0; i < FINAL_LINES.length; i += 1) {
      await expect(paths.nth(i)).toHaveAttribute('d', FINAL_LINES[i])
    }

    // Nine dots, one per line.
    await expect(mark.locator('circle')).toHaveCount(9)
  }

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the ink stays legible in light and in dark', async ({ page }) => {
  for (const theme of ['light', 'dark'] as const) {
    await pinLocale(page, 'en', theme)
    await page.goto('/')
    await expect(page.locator('html')).toHaveClass(new RegExp(theme === 'dark' ? 'dark' : '^(?!.*dark).*$'))
    await expect(page.locator(MARK).first()).toBeVisible()

    const { ratio } = await inkContrast(page)
    // Far above the 3:1 non-text minimum in both themes — the white rect and the
    // literal navy are gone, so the mark inverts with the surface.
    expect(ratio, `${theme} ink contrast`).toBeGreaterThan(4.5)
  }
})

test('the mark survives header size — strokes and dots are optically boosted', async ({ page }) => {
  await gotoApp(page, '/')
  const mark = page.locator(MARK).first()

  const box = await mark.boundingBox()
  expect(box?.width).toBeGreaterThan(24)
  expect(box?.height).toBeGreaterThan(24)

  const metrics = await mark.evaluate((svg) => {
    const line = svg.querySelector('[data-brand="lines"] path')!
    const dot = svg.querySelector('circle')!
    const scale = svg.getBoundingClientRect().height / (svg as SVGSVGElement).viewBox.baseVal.height
    return {
      strokePx: Number.parseFloat(getComputedStyle(line).strokeWidth) * scale,
      dotRadiusPx: Number(dot.getAttribute('r')) * scale,
      wedgeOpacity: Number(getComputedStyle(svg.querySelector('[data-brand="wedges"] path')!).opacity),
    }
  })

  // The artwork's own 2.2 units would land on ~0.3 px here and disappear.
  expect(metrics.strokePx).toBeGreaterThanOrEqual(1.1)
  expect(metrics.dotRadiusPx).toBeGreaterThanOrEqual(1.1)
  // Shadow wedges are present but stay a shadow, not a shape.
  expect(metrics.wedgeOpacity).toBeGreaterThan(0.05)
  expect(metrics.wedgeOpacity).toBeLessThan(0.3)
})

test('the mark is decorative and never mirrored in Arabic', async ({ page }) => {
  await gotoApp(page, '/', 'ar')
  const mark = page.locator(MARK).first()

  // The app name sits beside it as real text, so the mark must not be announced.
  await expect(mark).toHaveAttribute('aria-hidden', 'true')
  await expect(mark).toHaveAttribute('role', 'presentation')

  // A logo is not a directional affordance: `.rtl-flip` is for arrows and
  // chevrons, and mirroring the mark would ship a wrong brand asset.
  await expect(mark).not.toHaveClass(/rtl-flip/)
  const transform = await mark.evaluate((el) => getComputedStyle(el).transform)
  expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
})

test('reduced motion gets the finished mark with no tween', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await pinLocale(page, 'en')
  await page.goto('/')

  const paths = page.locator(MARK).first().locator('[data-brand="lines"] path')
  // No settle: the lines must already be at full length on the very first paint.
  await expect(paths.first()).toHaveAttribute('d', FINAL_LINES[0], { timeout: 5_000 })
  for (let i = 1; i < FINAL_LINES.length; i += 1) {
    await expect(paths.nth(i)).toHaveAttribute('d', FINAL_LINES[i])
  }
})

/* ── Hover morph ───────────────────────────────────────────────────────────
   The mark morphs into a rising bar chart — "funding" as growth — holds, and
   comes back. Nine straight strokes become nine straight bars, so the whole
   transition interpolates cleanly.
   ────────────────────────────────────────────────────────────────────────── */

/** The first bar of the funding shape: same start-point convention as the logo. */
const FIRST_BAR = 'M40 170 L40 212'

/** The wordmark link — mark plus name — is the hover host, not the 32px glyph. */
const WORDMARK = 'header a[href="/"]:has([data-testid="brand-mark"])'

async function firstLine(page: Page) {
  return page
    .locator(MARK)
    .first()
    .locator('[data-brand="lines"] path')
    .first()
    .getAttribute('d')
}

test('hovering the wordmark morphs the mark into the funding shape and back', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await gotoApp(page, '/')
  expect(await firstLine(page)).toBe(FINAL_LINES[0])

  // Hovering the *link* (mark + name) is the interaction, per MorphIcon's host rule.
  await page.locator(WORDMARK).hover()
  await expect.poll(() => firstLine(page), { timeout: 4_000 }).toBe(FIRST_BAR)

  // All nine arrive, and the dots ride the bar tops.
  const paths = page.locator(MARK).first().locator('[data-brand="lines"] path')
  await expect(paths.nth(8)).toHaveAttribute('d', 'M212 39.2 L212 212')

  // …then it comes home on its own, with the pointer still on it.
  await expect.poll(() => firstLine(page), { timeout: 6_000 }).toBe(FINAL_LINES[0])

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the hover morph fires once per hover, and re-arms only after leaving', async ({ page }) => {
  await gotoApp(page, '/')
  await page.locator(WORDMARK).hover()
  await expect.poll(() => firstLine(page), { timeout: 4_000 }).toBe(FIRST_BAR)
  await expect.poll(() => firstLine(page), { timeout: 6_000 }).toBe(FINAL_LINES[0])

  // Pointer has not moved. Nothing may start again — no loop, no ping-pong.
  for (let i = 0; i < 6; i += 1) {
    await page.waitForTimeout(400)
    expect(await firstLine(page)).toBe(FINAL_LINES[0])
  }

  // Leaving and returning re-arms it.
  await page.mouse.move(600, 400)
  await page.locator(WORDMARK).hover()
  await expect.poll(() => firstLine(page), { timeout: 4_000 }).toBe(FIRST_BAR)
})

test('keyboard focus on the wordmark triggers the same morph', async ({ page }) => {
  await gotoApp(page, '/')
  await page.locator(WORDMARK).focus()
  await expect.poll(() => firstLine(page), { timeout: 4_000 }).toBe(FIRST_BAR)
})

test('reduced motion leaves the mark at rest through a hover', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await pinLocale(page, 'en')
  await page.goto('/')
  await expect(page.locator(MARK).first()).toBeVisible()

  await page.locator(WORDMARK).hover()
  // The resting state *is* the end state here — no tween, and no bar chart.
  for (let i = 0; i < 4; i += 1) {
    await page.waitForTimeout(350)
    expect(await firstLine(page)).toBe(FINAL_LINES[0])
  }
})
