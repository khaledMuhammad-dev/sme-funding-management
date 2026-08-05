import { test, expect, gotoApp, pinLocale, readStore, settle } from './support/app'
import type { Page } from '@playwright/test'
import type { Application } from '../src/data/types'

/**
 * Polish pass over the admin workflow pages — dashboard, applications list,
 * application detail, interviews.
 *
 * These are not feature tests: every assertion here is about the *state around*
 * the feature — what the page shows while data is in flight, what it shows when
 * there is no data at all, whether it survives RTL and dark mode, and whether a
 * keyboard alone can drive it.
 */

/** Collects page errors and console errors so a test can fail on either. */
function watchForErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
  })
  return errors
}

/** True when the document scrolls sideways — the classic RTL layout failure. */
function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1)
}

/** Grabs an application id from the live store, so no fixture ref is hardcoded. */
async function anyApplicationId(page: Page) {
  const applications = await readStore<Application[]>(page, 'applications')
  expect(applications.length).toBeGreaterThan(0)
  return applications[0].id
}

/* ── A. Empty states ───────────────────────────────────────────────────────── */

test('an empty database gives every dashboard panel a localized empty state', async ({
  page,
}) => {
  const errors = watchForErrors(page)

  // `?empty=1` wipes the demo data before the first render, so no seeded row is
  // ever painted and the charts mount against a genuinely empty store.
  await pinLocale(page, 'en')
  await page.goto('/admin?empty=1')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await settle(page)

  // All five chart panels say so in words rather than drawing empty axes.
  await expect(page.getByText('No data to chart yet')).toHaveCount(5)
  await expect(page.locator('.recharts-surface')).toHaveCount(0)

  // The two bottom panels are the ones most likely to render as a bare blank.
  await expect(page.getByText('No applications assigned yet')).toBeVisible()
  await expect(page.getByText('No activity yet')).toBeVisible()

  // A staff table with no rows must not leave a headless, bodyless table behind.
  await expect(page.locator('table')).toHaveCount(0)

  await expect(page.locator('main')).not.toContainText(/NaN|Infinity|undefined/)
  expect(errors, errors.join('\n')).toEqual([])
})

test('the empty-database dashboard is localized in Arabic too', async ({ page }) => {
  const errors = watchForErrors(page)

  await pinLocale(page, 'ar')
  await page.goto('/admin?empty=1')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await settle(page)

  await expect(page.getByText('لا توجد بيانات لعرضها بعد')).toHaveCount(5)
  await expect(page.getByText('لا توجد طلبات مُسندة بعد')).toBeVisible()

  // No untranslated key and no English fallback leaked through.
  await expect(page.locator('main')).not.toContainText(/dashboard\.|No data to chart/)
  expect(errors, errors.join('\n')).toEqual([])
})

test('the applications and interviews lists have empty states on an empty database', async ({
  page,
}) => {
  const errors = watchForErrors(page)

  await pinLocale(page, 'en')
  await page.goto('/admin/applications?empty=1')
  await settle(page)

  // The table keeps its frame and puts the empty state in a single spanning row,
  // so there is never a bare blank and never a permanent spinner.
  await expect(page.locator('main')).toContainText('No results')
  await expect(page.locator('tbody tr')).toHaveCount(1)

  await page.getByRole('link', { name: 'Interviews' }).first().click()
  await expect(page.getByRole('heading', { name: 'Interviews' })).toBeVisible()
  await settle(page)
  await expect(page.getByText('No interviews scheduled')).toBeVisible()

  // The week board must be empty-but-shaped, not blank: seven day cells remain.
  await page.getByRole('tab', { name: 'Week' }).click()
  await expect(page.locator('[data-day-cell]')).toHaveCount(7)
  await expect(page.locator('[data-day-cell]').first()).toContainText('None')

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── B. Loading states and layout shift ────────────────────────────────────── */

test('the dashboard reserves the loaded layout while its data is in flight', async ({
  page,
}) => {
  await gotoApp(page, '/')

  // Client-side navigation, so the dashboard query really runs (380–720 ms).
  await page.getByRole('link', { name: 'Admin' }).first().click()

  const busy = page.locator('[aria-busy="true"]').first()
  await expect(busy).toBeVisible()
  const skeletonHeight = (await busy.boundingBox())!.height

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await settle(page)
  const loadedHeight = (await page.locator('main').boundingBox())!.height

  /*
    The skeleton is meant to stand in for the whole page, not just the KPI row.
    Anything below ~0.7 means a section — charts or the bottom panels — has no
    placeholder and pops the page open when its data lands.
  */
  expect(skeletonHeight / loadedHeight).toBeGreaterThan(0.7)
})

test('switching detail tabs renders settled content, never a skeleton or false empty state', async ({
  page,
}) => {
  await gotoApp(page, '/admin/applications')
  const id = await anyApplicationId(page)

  await gotoApp(page, `/admin/applications/${id}`)

  /*
    Tab content unmounts when inactive, so every switch re-renders from scratch.
    With the related queries already cached that must be instantaneous — a
    skeleton or a "nothing here yet" panel appearing on switch would mean the
    tab is re-reading rather than reusing, and the panel would visibly jump.
  */
  for (const tab of ['Contract', 'Interview', 'Disbursement', 'Follow-up']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await expect(page.getByTestId('panel-skeleton')).toHaveCount(0)
    await expect(page.getByRole('tabpanel')).toBeVisible()
  }
})

/* ── C. RTL and dark mode ──────────────────────────────────────────────────── */

const ADMIN_PAGES = ['/admin', '/admin/applications', '/admin/interviews'] as const

for (const path of ADMIN_PAGES) {
  test(`${path} survives Arabic RTL in dark mode`, async ({ page }) => {
    const errors = watchForErrors(page)

    await pinLocale(page, 'ar', 'dark')
    await page.goto(path)
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
    await settle(page)

    // The dark class really landed — otherwise this test proves nothing.
    await expect(page.locator('html')).toHaveClass(/dark/)

    expect(await hasHorizontalOverflow(page), `${path} scrolls sideways in RTL`).toBe(false)
    await expect(page.locator('main')).not.toContainText(/NaN|undefined/)
    expect(errors, errors.join('\n')).toEqual([])
  })
}

test('dashboard charts stay inside their cards in Arabic', async ({ page }) => {
  await pinLocale(page, 'ar', 'dark')
  await page.goto('/admin')
  await settle(page)

  // Recharts lays out in LTR regardless of `dir`, so a chart can quietly spill
  // past the card that holds it. Every surface must sit within its own section.
  const surfaces = page.locator('.recharts-surface')
  const count = await surfaces.count()
  expect(count).toBe(5)

  for (let i = 0; i < count; i++) {
    const surface = surfaces.nth(i)
    const card = surface.locator('xpath=ancestor::section[1]')
    const surfaceBox = (await surface.boundingBox())!
    const cardBox = (await card.boundingBox())!

    expect(surfaceBox.x, `chart ${i} spills past the start edge`).toBeGreaterThanOrEqual(
      cardBox.x - 1,
    )
    expect(
      surfaceBox.x + surfaceBox.width,
      `chart ${i} spills past the end edge`,
    ).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1)
  }
})

/* ── D. Keyboard and focus ─────────────────────────────────────────────────── */

/*
  NOTE: closing a Dialog or Sheet leaves focus on <body> rather than returning it
  to the trigger. That is a shared-overlay defect (`src/components/ui/dialog.tsx`
  and `sheet.tsx` take no `onCloseAutoFocus`), not a defect of these pages, so it
  is reported rather than asserted here. The dropdown menu below *does* restore
  focus, which is what makes the dialog behaviour clearly a bug.
*/
test('the status transition dialog opens from the keyboard and traps focus', async ({
  page,
}) => {
  await gotoApp(page, '/admin/applications')
  const id = await anyApplicationId(page)

  await gotoApp(page, `/admin/applications/${id}`)

  const trigger = page.getByRole('button', { name: 'Change status' })
  await trigger.focus();
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Focus is inside the dialog and stays there while tabbing.
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    const inside = await dialog.evaluate((node) => node.contains(document.activeElement))
    expect(inside, `Tab ${i + 1} escaped the dialog`).toBe(true)
  }

  // Escape must at least dismiss it from the keyboard alone.
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('a DataTable row menu opens from the keyboard on the interviews page', async ({ page }) => {
  await gotoApp(page, '/admin/interviews')

  const trigger = page.getByRole('button', { name: 'Open menu' }).first()
  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem').first()).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('the applications status tabs are named and reachable by keyboard', async ({ page }) => {
  await gotoApp(page, '/admin/applications')

  // Icon-free but still a control group — it needs a name of its own.
  const tablist = page.getByRole('tablist', { name: 'Status' })
  await expect(tablist).toBeVisible()

  const underReview = tablist.getByRole('tab', { name: /Under review/i })
  await underReview.focus()
  await expect(underReview).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(underReview).toHaveAttribute('aria-selected', 'true')
})

/* ── E. Reduced motion ─────────────────────────────────────────────────────── */

test('the score panel renders fully with reduced motion requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })

  await gotoApp(page, '/admin/applications')
  const applications = await readStore<Application[]>(page, 'applications')
  const scored = applications.find((a) => a.score)!
  expect(scored, 'no scored application in the fixtures').toBeTruthy()

  await gotoApp(page, `/admin/applications/${scored.id}?tab=score`)

  // The gauge and the criteria bars must be at their final values immediately,
  // not mid-sweep — a reduced-motion user never sees the animation land.
  await expect(page.getByTestId('score-total')).toHaveText(String(scored.score!.total))
  await expect(page.getByTestId('criterion-row').first()).toBeVisible()

  const barWidth = await page
    .getByTestId('criterion-row')
    .first()
    .locator('div[style]')
    .evaluate((node) => (node as HTMLElement).getBoundingClientRect().width)
  expect(barWidth, 'the criteria bar is still animating from zero').toBeGreaterThan(0)
})
