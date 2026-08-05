import { test, expect, gotoApp, navigateTo, readStore } from './support/app'

/** Every table the reset controls clear or restore. */
const TABLES = [
  'applications',
  'interviews',
  'contracts',
  'disbursements',
  'followUps',
  'notifications',
] as const

async function totalRows(page: import('@playwright/test').Page) {
  const counts = await Promise.all(TABLES.map((table) => readStore<unknown[]>(page, table)))
  return counts.reduce((sum, rows) => sum + rows.length, 0)
}

test('Start clean empties the whole demo database, and Restore puts it back', async ({ page }) => {
  await gotoApp(page, '/admin/settings')
  await page.getByRole('tab', { name: 'Demo data' }).click()

  const seeded = await totalRows(page)
  expect(seeded).toBeGreaterThan(0)
  await expect(page.getByTestId('demo-count-applications')).not.toHaveText('0')

  await page.getByRole('button', { name: 'Start clean' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  // Every table empty, and the live counts on screen agree.
  await expect(page.getByTestId('demo-count-applications')).toHaveText('0')
  expect(await totalRows(page)).toBe(0)
  for (const table of TABLES) {
    await expect(page.getByTestId(`demo-count-${table}`)).toHaveText('0')
  }

  await page.getByRole('button', { name: 'Restore demo data' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByTestId('demo-count-applications')).not.toHaveText('0')
  expect(await totalRows(page)).toBe(seeded)
})

test('an emptied platform renders empty states, not crashes or NaN', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await gotoApp(page, '/admin/settings')
  await page.getByRole('tab', { name: 'Demo data' }).click()
  await page.getByRole('button', { name: 'Start clean' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByTestId('demo-count-applications')).toHaveText('0')

  // Client-side navigation only — a reload would re-seed the store and prove nothing.
  for (const path of [
    '/admin',
    '/admin/applications',
    '/admin/interviews',
    '/admin/contracts',
    '/admin/disbursements',
    '/admin/follow-up',
    '/admin/reports',
  ]) {
    await navigateTo(page, path)
    await expect(page.locator('main')).toBeVisible()
    const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
    expect(text, `${path} shows a broken number`).not.toMatch(/NaN|Infinity|undefined/)
    expect(text, `${path} leaks a raw i18n key`).not.toMatch(/\{\{|[a-z]+\.[a-zA-Z]+\.[a-zA-Z]+/)
  }

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('?empty=1 boots with no data at all', async ({ page }) => {
  await gotoApp(page, '/admin/applications?empty=1')
  expect(await totalRows(page)).toBe(0)
  // And the seeded population is still one plain reload away.
  await gotoApp(page, '/admin/applications')
  expect(await totalRows(page)).toBeGreaterThan(0)
})
