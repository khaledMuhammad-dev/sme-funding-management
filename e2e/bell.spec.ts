import { test, expect, gotoApp } from './support/app'

const bell = (page: import('@playwright/test').Page) =>
  page.getByTestId('portal-notification-bell')

const transformOf = (page: import('@playwright/test').Page, part: 'body' | 'clapper') =>
  page.evaluate((name) => {
    const node = document.querySelector(`[data-testid="portal-notification-bell"] [data-part="${name}"]`)
    return node ? getComputedStyle(node).transform : null
  }, part)

test('hovering the bell swings the clapper and the body against it', async ({ page }) => {
  await gotoApp(page, '/')

  expect(await transformOf(page, 'clapper')).not.toBeNull()

  await bell(page).hover()

  // Sample mid-swing: the two parts must be rotating in opposite directions.
  let sawOpposed = false
  for (let i = 0; i < 12 && !sawOpposed; i++) {
    const [bodyT, clapperT] = await Promise.all([
      transformOf(page, 'body'),
      transformOf(page, 'clapper'),
    ])
    const skew = (value: string | null) => {
      // matrix(a, b, c, d, e, f) — `b` carries the sign of the rotation.
      const match = value?.match(/matrix\(([^)]+)\)/)
      return match ? Number(match[1].split(',')[1]) : 0
    }
    const b = skew(bodyT)
    const c = skew(clapperT)
    if (b !== 0 && c !== 0 && Math.sign(b) !== Math.sign(c)) sawOpposed = true
    await page.waitForTimeout(60)
  }

  expect(sawOpposed, 'clapper and body should swing in opposite directions').toBe(true)

  // …and it settles back to rest rather than staying tilted.
  await page.waitForTimeout(1200)
  for (const part of ['body', 'clapper'] as const) {
    const rest = await transformOf(page, part)
    expect(rest === 'none' || /matrix\(1,\s*0,\s*0,\s*1/.test(rest ?? '')).toBe(true)
  }
})

test('the swing plays once per hover, not continuously', async ({ page }) => {
  await gotoApp(page, '/')

  await bell(page).hover()
  await page.waitForTimeout(1300) // let the first swing finish

  // Pointer stays put: nothing should move again.
  const before = await transformOf(page, 'clapper')
  await page.waitForTimeout(700)
  const after = await transformOf(page, 'clapper')
  expect(after).toBe(before)
})

test('reduced motion leaves the bell still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await gotoApp(page, '/')

  await bell(page).hover()
  await page.waitForTimeout(400)

  for (const part of ['body', 'clapper'] as const) {
    const value = await transformOf(page, part)
    expect(value === 'none' || /matrix\(1,\s*0,\s*0,\s*1/.test(value ?? '')).toBe(true)
  }
})
