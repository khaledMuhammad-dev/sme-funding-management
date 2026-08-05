import { test, expect, gotoApp, readStore } from './support/app'

test('every route renders without a crash or error boundary', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  for (const path of [
    '/',
    '/apply',
    '/track',
    '/admin',
    '/admin/applications',
    '/admin/interviews',
    '/admin/contracts',
    '/admin/disbursements',
    '/admin/follow-up',
    '/admin/reports',
    '/admin/settings',
  ]) {
    await gotoApp(page, path)
    await expect(page.locator('#root')).not.toBeEmpty()
  }

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the demo store is reachable from tests', async ({ page }) => {
  await gotoApp(page, '/admin/applications')
  const apps = await readStore<{ id: string }[]>(page, 'applications')
  expect(apps.length).toBeGreaterThan(0)
})
