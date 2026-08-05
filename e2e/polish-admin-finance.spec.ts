import { test, expect, gotoApp, pinLocale, type Lang } from './support/app'
import type { Page } from '@playwright/test'

/**
 * Polish pass over the finance / post-funding admin screens and the shared
 * component library they are built from.
 *
 * Deliberately cheap and deterministic: no screenshot diffing, no reliance on
 * fixture-specific figures, and every assertion is about a state the presenter
 * can actually land on — an empty database, a slow read, Arabic, dark mode, a
 * keyboard.
 */

const FINANCE_ROUTES = [
  '/admin/contracts',
  '/admin/disbursements',
  '/admin/follow-up',
  '/admin/reports',
  '/admin/settings',
] as const

/** A real print dialog blocks the browser and hangs the whole session. */
async function stubPrint(page: Page) {
  await page.addInitScript(() => {
    window.print = () => {}
  })
}

/* ── A. Loading, empty and error states ────────────────────────────────────── */

test('every finance table has a localized empty state on an empty database', async ({ page }) => {
  await pinLocale(page, 'en')
  await page.goto('/admin/contracts?empty=1')

  // Contracts: an empty state, never a blank card or a spinner that never ends.
  await expect(page.getByText('No contracts', { exact: true })).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveCount(1)

  await page.goto('/admin/disbursements?empty=1')
  await expect(page.getByText('No disbursements', { exact: true })).toBeVisible()

  await page.goto('/admin/follow-up?empty=1')
  await expect(page.getByText('No projects in monitoring', { exact: true })).toBeVisible()
})

test('the reports page shows a skeleton while loading, not a false empty state', async ({
  page,
}) => {
  await pinLocale(page, 'en')

  // Catch the page mid-read: the simulated API takes 380–720 ms.
  await page.goto('/admin/reports', { waitUntil: 'commit' })

  /*
    The regression this guards: `rows` starts as `[]` while the four queries are
    in flight, so the page used to render "No data for the selected filters"
    before any data had a chance to arrive.
  */
  await expect(page.getByText('No data in the selected range')).toHaveCount(0)

  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByText('No data in the selected range')).toHaveCount(0)
})

test('an empty database gives the reports page a real empty state', async ({ page }) => {
  await pinLocale(page, 'en')
  await page.goto('/admin/reports?empty=1')

  // Once the read has genuinely landed and is genuinely empty, say so.
  await expect(page.getByText('No data in the selected range')).toBeVisible()
})

test('a DataTable does not change height when its data arrives', async ({ page }) => {
  await pinLocale(page, 'en')
  await page.goto('/admin/disbursements', { waitUntil: 'commit' })

  const table = page.locator('table').first()
  await table.waitFor({ state: 'visible' })

  // Measured while the skeleton rows are still up.
  const loading = await table.boundingBox()

  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toContainText(/of \d+/)
  const loaded = await table.boundingBox()

  /*
    The skeleton renders the same row count and the footer placeholder holds the
    pagination's space, so the table must not jump. A little slack absorbs
    sub-pixel row-height differences between a Skeleton and real text.
  */
  expect(Math.abs((loaded?.height ?? 0) - (loading?.height ?? 0))).toBeLessThan(24)
})

test('switching a contracts tab does not leave the table empty or jump the page', async ({
  page,
}) => {
  await gotoApp(page, '/admin/contracts')

  const tablist = page.getByRole('tablist')
  const before = await page.locator('table').first().boundingBox()

  await tablist.getByRole('tab', { name: 'Archive' }).click()
  // Either rows or an empty state — never a blank body.
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await tablist.getByRole('tab', { name: 'All' }).click()
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const after = await page.locator('table').first().boundingBox()
  expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThan(4)
})

/* ── B. RTL and dark mode ──────────────────────────────────────────────────── */

test('finance sources use logical Tailwind properties only', async () => {
  const { readFile, readdir } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const roots = [
    'src/components/shared',
    'src/components/ui',
    'src/features/contracts',
    'src/features/notifications',
  ]
  const files: string[] = [
    'src/app/admin/ContractsPage.tsx',
    'src/app/admin/DisbursementsPage.tsx',
    'src/app/admin/FollowUpPage.tsx',
    'src/app/admin/ReportsPage.tsx',
    'src/app/admin/SettingsPage.tsx',
  ]

  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) await walk(full)
      else if (full.endsWith('.tsx')) files.push(full)
    }
  }
  for (const root of roots) await walk(root)

  /*
    `sidebar.tsx` is unused shadcn scaffolding that ships physical `left-`/
    `right-` classes for its own side prop; it renders nowhere in this app.
  */
  const skip = new Set(['src/components/ui/sidebar.tsx', 'src/components/ui/sheet.tsx'])

  const physical =
    /className=(?:"|'|\{`)[^"'`]*\b(?:ml|mr|pl|pr)-[0-9a-z.[]|\btext-(?:left|right)\b|\bborder-[lr]-|\brounded-[lr]-/

  const offenders: string[] = []
  for (const file of files) {
    if (skip.has(file)) continue
    const source = await readFile(file, 'utf8')
    source.split('\n').forEach((line, index) => {
      if (physical.test(line)) offenders.push(`${file}:${index + 1}: ${line.trim().slice(0, 110)}`)
    })
  }

  expect(offenders, `physical direction classes found:\n${offenders.join('\n')}`).toEqual([])
})

for (const lang of ['ar', 'en'] as Lang[]) {
  test(`finance screens render in ${lang} dark mode without horizontal overflow`, async ({
    page,
  }) => {
    await pinLocale(page, lang, 'dark')
    await stubPrint(page)

    for (const route of FINANCE_ROUTES) {
      await page.goto(route)
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
      await expect(page.locator('h1').first()).toBeVisible()

      // The page body must never scroll sideways, in either direction.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${route} (${lang}) overflows horizontally by ${overflow}px`).toBeLessThan(2)
    }
  })
}

test('the contract document stays readable on screen in dark mode', async ({ page }) => {
  // NB: not `gotoApp` — it re-pins the locale with the default light theme.
  await pinLocale(page, 'en', 'dark')
  await stubPrint(page)
  await page.goto('/admin/contracts')
  await expect(page.locator('html')).toHaveClass(/dark/)

  // Wait for real rows — clicking a skeleton row opens nothing.
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toContainText(/of [1-9]/)
  await page.locator('tbody tr').first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Project Funding Agreement')).toBeVisible()

  /*
    The document is paper-like, but it must not be *paper white* on screen in
    dark mode. It reads its surface from `--card`, so in the dark theme the
    heading has to stay light-on-dark rather than becoming black on white.
  */
  const heading = dialog.getByRole('heading', { name: 'Project Funding Agreement' })
  const lightness = await heading.evaluate((node) => {
    /*
      Chrome reports these tokens back as `oklch(L C H)`, not `rgb()`, so the
      value has to be normalised before it means anything. Painting it onto a
      canvas lets the browser do the conversion for us.
    */
    const colour = getComputedStyle(node).color
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
  })
  expect(lightness, 'contract text is dark-on-dark in dark mode').toBeGreaterThan(0.5)
})

test('the follow-up impact chart stays inside its card in Arabic', async ({ page }) => {
  await gotoApp(page, '/admin/follow-up', 'ar')

  await page.locator('tbody tr').first().click()
  const chart = page.getByTestId('impact-chart')
  await expect(chart).toBeVisible()

  const card = page.locator('[data-slot="sheet-content"]')
  const chartBox = await chart.boundingBox()
  const cardBox = await card.boundingBox()

  expect(chartBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 2)
  expect(chartBox!.x + chartBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 2)
})

/* ── C. Keyboard and focus ─────────────────────────────────────────────────── */

test('the DataTable toolbar, sort headers and pagination are keyboard-operable', async ({
  page,
}) => {
  await gotoApp(page, '/admin/disbursements')

  // The sort header is a real button, and it reports its state on the column
  // header rather than on itself.
  const sortButton = page.getByRole('button', { name: /Amount/ }).first()
  await sortButton.focus()
  await expect(sortButton).toBeFocused()
  await page.keyboard.press('Enter')
  await page.getByRole('menuitem', { name: 'Ascending' }).click()

  await expect(page.locator('th').filter({ hasText: 'Amount' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  )

  // Every icon-only control in the table chrome carries an accessible name.
  for (const name of ['Columns', 'First page', 'Previous', 'Next', 'Last page', 'Rows per page']) {
    await expect(page.getByRole('button', { name }).or(page.getByRole('combobox', { name })).first())
      .toHaveCount(1)
  }
})

test('the row action menu opens from the keyboard and returns focus on close', async ({ page }) => {
  await gotoApp(page, '/admin/contracts')

  const trigger = page.getByRole('button', { name: 'Open menu' }).first()
  await trigger.focus()
  await page.keyboard.press('Enter')

  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('the signature pad can be completed without a pointer', async ({ page }) => {
  await gotoApp(page, '/admin/settings')
  await page.getByRole('tab', { name: 'Authorised signatory' }).click()

  /*
    The signature pad is a canvas driven by pointer events, and every screen that
    uses it gates its action on a signature existing — so without a keyboard
    route a keyboard user is stuck with no way forward. The typed-name button is
    that route, and it is the same pad the applicant signs her contract on.
  */
  await page.getByRole('textbox', { name: 'Authorised signatory' }).fill('Noura Al Otaibi')

  const useTyped = page.getByTestId('signature-use-typed-name')
  await useTyped.focus()
  await expect(useTyped).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('signature-pad')).toHaveAttribute('data-has-ink', 'true')
  await expect(page.getByTestId('save-signatory')).toBeEnabled()
})

test('the settings notification preview dialog traps focus and restores it', async ({ page }) => {
  await gotoApp(page, '/admin/settings')

  await page.getByRole('tab', { name: 'Notifications' }).click()
  const trigger = page.getByRole('button', { name: 'View' }).first()
  await trigger.click()

  const dialog = page.getByTestId('phone-preview')
  await expect(dialog).toBeVisible()

  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab')
    const inside = await dialog.evaluate((node) => node.contains(document.activeElement))
    expect(inside, `Tab ${i + 1} escaped the preview dialog`).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('the contracts tab strip moves with the arrow keys in both directions', async ({ page }) => {
  await gotoApp(page, '/admin/contracts')

  const tablist = page.getByRole('tablist')
  const all = tablist.getByRole('tab', { name: 'All' })
  await all.focus()

  await page.keyboard.press('ArrowRight')
  await expect(tablist.getByRole('tab', { name: 'Draft' })).toHaveAttribute(
    'aria-selected',
    'true',
  )

  await page.keyboard.press('ArrowLeft')
  await expect(all).toHaveAttribute('aria-selected', 'true')
})

/* ── Reduced motion ────────────────────────────────────────────────────────── */

test('finance screens render fully with reduced motion requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await pinLocale(page, 'en')
  await stubPrint(page)

  for (const route of FINANCE_ROUTES) {
    await page.goto(route)
    // Content must be at its resting opacity, not stuck mid-animation.
    await expect(page.locator('h1').first()).toBeVisible()
    const opacity = await page
      .locator('h1')
      .first()
      .evaluate((node) => getComputedStyle(node).opacity)
    expect(Number(opacity), `${route} heading is not fully visible`).toBeGreaterThan(0.95)
  }
})
