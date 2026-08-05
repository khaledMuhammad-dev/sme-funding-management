import { test, expect, gotoApp, readStore, clearToasts } from './support/app'
import type { Page } from '@playwright/test'

/**
 * Workflow & scoring happy paths.
 *
 * Every mutation is asserted twice: once on the surface the officer looks at,
 * and once against `window.__demoStore`. A change that only repaints, or only
 * lands in the store, is the exact failure this suite exists to catch.
 */

type Status =
  | 'new'
  | 'incomplete'
  | 'under_review'
  | 'awaiting_interview'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'follow_up'

interface StoreApp {
  id: string
  ref: string
  status: Status
  assignee?: string
  documents: { id: string; kind: string; missing?: boolean }[]
  score?: { total: number; criteria: { key: string; weight: number; value: number }[] }
  timeline: { kind: string; params?: Record<string, string | number> }[]
  project: { requestedAmount: number }
}

const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  incomplete: 'Incomplete',
  under_review: 'Under review',
  awaiting_interview: 'Awaiting interview',
  approved: 'Approved',
  rejected: 'Rejected',
  disbursed: 'Disbursed',
  follow_up: 'Follow-up',
}

const apps = (page: Page) => readStore<StoreApp[]>(page, 'applications')
const appById = async (page: Page, id: string) =>
  (await apps(page)).find((a) => a.id === id)!

/** The sr-only live region that reports the *filtered* row total, not the page. */
function rowSummary(page: Page) {
  return page.locator('span[role="status"]').first()
}

/** `Showing 1–10 of 25` → 25 */
async function totalRows(page: Page): Promise<number> {
  const text = (await rowSummary(page).textContent()) ?? ''
  const match = text.match(/(\d+)\s*$/)
  return match ? Number(match[1]) : -1
}

async function expectTotalRows(page: Page, expected: number) {
  await expect
    .poll(() => totalRows(page), { message: `filtered row total should be ${expected}` })
    .toBe(expected)
}

/**
 * Client-side navigation.
 *
 * `page.goto` reloads the SPA, which throws the in-memory demo database away —
 * any test that asserts a mutation survived a screen change has to travel the
 * way the officer does, through the sidebar.
 */
async function navigateTo(page: Page, link: string) {
  await page
    .getByRole('navigation', { name: 'Admin' })
    .getByRole('link', { name: link, exact: true })
    .first()
    .click()
}

/**
 * Types a reference into the table search and waits for the single match.
 *
 * Retried as a unit: the search field is debounced and the list is still
 * settling right after a route change, so a keystroke can land on a node the
 * page transition then replaces.
 */
async function searchFor(page: Page, ref: string) {
  await expect(async () => {
    await page.getByRole('searchbox').fill(ref)
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}

/** Opens an application from the list by reference, without a page reload. */
async function openFromList(page: Page, ref: string) {
  await searchFor(page, ref)
  await page.locator('tbody tr').first().click()
  await expect(page.getByTestId('detail-status')).toBeVisible()
}

const statusTab = (page: Page, status: Status) =>
  page.getByRole('tab').filter({ hasText: STATUS_LABEL[status] })

/** Reads the count chip rendered inside a status tab. */
async function tabCount(page: Page, status: Status): Promise<number> {
  const text = (await statusTab(page, status).textContent()) ?? ''
  return Number(text.replace(STATUS_LABEL[status], '').trim())
}

// ── 1. List: data, tabs, search, sorting, column visibility ─────────────────

test('the applications list renders every fixture and its tab counts match the store', async ({
  page,
}) => {
  await gotoApp(page, '/admin/applications')

  const store = await apps(page)
  expect(store.length).toBeGreaterThan(0)

  await expectTotalRows(page, store.length)

  for (const status of Object.keys(STATUS_LABEL) as Status[]) {
    const expected = store.filter((a) => a.status === status).length
    await expect
      .poll(() => tabCount(page, status), { message: `${status} tab count` })
      .toBe(expected)
  }
})

test('a status tab filters the table down to that status', async ({ page }) => {
  await gotoApp(page, '/admin/applications')
  const store = await apps(page)
  const expected = store.filter((a) => a.status === 'new').length

  await statusTab(page, 'new').click()
  await expectTotalRows(page, expected)

  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(expected)
  for (const row of await rows.all()) {
    await expect(row).toContainText(STATUS_LABEL.new)
  }
})

test('search narrows the table to the matching application', async ({ page }) => {
  await gotoApp(page, '/admin/applications')
  const store = await apps(page)
  const target = store[4]

  await searchFor(page, target.ref)
  await expectTotalRows(page, 1)
  await expect(page.locator('tbody tr').first()).toContainText(target.ref)
})

test('sorting by amount reorders the table', async ({ page }) => {
  await gotoApp(page, '/admin/applications')
  const store = await apps(page)
  const richest = [...store].sort(
    (a, b) => b.project.requestedAmount - a.project.requestedAmount,
  )[0]
  const poorest = [...store].sort(
    (a, b) => a.project.requestedAmount - b.project.requestedAmount,
  )[0]

  await page.getByRole('button', { name: 'Amount' }).click()
  await page.getByRole('menuitem', { name: 'Descending' }).click()
  await expect(page.locator('tbody tr').first()).toContainText(richest.ref)

  await page.getByRole('button', { name: 'Amount' }).click()
  await page.getByRole('menuitem', { name: 'Ascending' }).click()
  await expect(page.locator('tbody tr').first()).toContainText(poorest.ref)
})

test('the column visibility menu hides and restores a column', async ({ page }) => {
  await gotoApp(page, '/admin/applications')

  const header = page.getByRole('columnheader').filter({ hasText: 'Assignee' })
  await expect(header).toHaveCount(1)

  // The menu is modal — the table is hidden from the a11y tree while it is
  // open, so it has to be closed before the header can be asserted on.
  await page.getByRole('button', { name: 'Columns' }).click()
  await page.getByRole('checkbox', { name: 'Assignee' }).click()
  await page.keyboard.press('Escape')
  await expect(header).toHaveCount(0)

  await page.getByRole('button', { name: 'Columns' }).click()
  await page.getByRole('checkbox', { name: 'Assignee' }).click()
  await page.keyboard.press('Escape')
  await expect(header).toHaveCount(1)
})

// ── 2. The status transition engine ─────────────────────────────────────────

test('the transition dialog offers only the transitions statusFlow permits', async ({ page }) => {
  // APP-008 is `rejected` — a terminal status, so nothing may be offered.
  await gotoApp(page, '/admin/applications/APP-008')
  await expect(page.getByTestId('detail-status')).toContainText(STATUS_LABEL.rejected)
  await expect(page.getByRole('button', { name: 'Change status' })).toBeDisabled()

  // APP-004 is `new` → incomplete | under_review, and nothing else.
  await gotoApp(page, '/admin/applications/APP-004')
  await page.getByRole('button', { name: 'Change status' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await expect(dialog.getByRole('radio', { name: STATUS_LABEL.incomplete })).toBeVisible()
  await expect(dialog.getByRole('radio', { name: STATUS_LABEL.under_review })).toBeVisible()
  for (const forbidden of ['approved', 'rejected', 'disbursed', 'follow_up', 'new'] as Status[]) {
    await expect(dialog.getByRole('radio', { name: STATUS_LABEL[forbidden] })).toHaveCount(0)
  }
})

test('a transition with a reason propagates to the badge, the timeline, the store and the list', async ({
  page,
}) => {
  const id = 'APP-003' // under_review → awaiting_interview | rejected
  const reason = 'The feasibility study does not cover the second year.'

  await gotoApp(page, `/admin/applications/${id}`)
  const before = await appById(page, id)
  expect(before.status).toBe('under_review')

  await page.getByRole('button', { name: 'Change status' }).click()
  const dialog = page.getByRole('dialog')

  // Only the two legal targets, and the reason gate holds the confirm button.
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await dialog.getByRole('radio', { name: STATUS_LABEL.rejected }).click()

  const confirm = dialog.getByRole('button', { name: 'Confirm change' })
  await expect(confirm).toBeDisabled()
  await dialog.getByLabel(/Reason for the change/).fill(reason)
  await expect(confirm).toBeEnabled()
  await confirm.click()

  // UI: the header badge.
  await expect(page.getByTestId('detail-status')).toContainText(STATUS_LABEL.rejected)

  // UI: a status_change event carrying the reason.
  await page.getByRole('tab', { name: 'History' }).click()
  const entry = page.getByRole('listitem').filter({ hasText: 'Status changed to Rejected' }).first()
  await expect(entry).toBeVisible()
  await expect(entry).toContainText(reason)

  // Store.
  await expect
    .poll(async () => (await appById(page, id)).status)
    .toBe('rejected')
  const after = await appById(page, id)
  expect(
    after.timeline.some((e) => e.kind === 'status_change' && e.params?.reason === reason),
  ).toBe(true)

  // The list must agree — this is where a stale query closure used to hide.
  const expectedRejected = (await apps(page)).filter((a) => a.status === 'rejected').length
  const expectedUnderReview = (await apps(page)).filter((a) => a.status === 'under_review').length

  await clearToasts(page)
  await navigateTo(page, 'Applications')
  await searchFor(page, before.ref)
  await expect(page.locator('tbody tr').first()).toContainText(STATUS_LABEL.rejected)

  await expect.poll(() => tabCount(page, 'rejected')).toBe(expectedRejected)
  await expect.poll(() => tabCount(page, 'under_review')).toBe(expectedUnderReview)
})

test('a transition runs in Arabic with an RTL layout', async ({ page }) => {
  const id = 'APP-005' // awaiting_interview → approved | rejected
  await gotoApp(page, `/admin/applications/${id}`, 'ar')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('detail-status')).toContainText('بانتظار المقابلة')

  await page.getByRole('button', { name: 'تغيير الحالة' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('تغيير حالة الطلب')
  await expect(dialog.getByRole('radio')).toHaveCount(2)

  await dialog.getByRole('radio', { name: 'معتمد' }).click()
  await dialog.getByRole('button', { name: 'تأكيد التغيير' }).click()

  await expect(page.getByTestId('detail-status')).toContainText('معتمد')
  await expect.poll(async () => (await appById(page, id)).status).toBe('approved')

  await page.getByRole('tab', { name: 'السجل' }).click()
  await expect(page.getByText('تغيّرت الحالة إلى معتمد').first()).toBeVisible()
})

// ── 3. Assign ───────────────────────────────────────────────────────────────

test('assigning an application updates the detail page and the store', async ({ page }) => {
  const id = 'APP-004'
  const officer = 'عمر السالم'

  await gotoApp(page, `/admin/applications/${id}`)
  await expect(page.getByTestId('detail-assignee')).toHaveText('Unassigned')

  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: officer }).click()
  await dialog.getByRole('button', { name: 'Confirm assignment' }).click()

  await expect(page.getByTestId('detail-assignee')).toHaveText(officer)
  await expect.poll(async () => (await appById(page, id)).assignee).toBe(officer)
})

// ── 4. Documents ────────────────────────────────────────────────────────────

test('previewing a document opens the viewer dialog', async ({ page }) => {
  await gotoApp(page, '/admin/applications/APP-004?tab=documents')

  await page.getByRole('button', { name: 'Preview' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('national-id.pdf')
  await expect(dialog).toContainText('National ID copy')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('flagging a document as missing moves the application to incomplete', async ({ page }) => {
  const id = 'APP-012' // `new`, every document present
  await gotoApp(page, `/admin/applications/${id}?tab=documents`)

  const before = await appById(page, id)
  expect(before.status).toBe('new')
  expect(before.documents.every((d) => !d.missing)).toBe(true)

  await page.getByRole('button', { name: 'Flag as missing' }).first().click()

  // UI: the document is flagged and the application is now incomplete.
  await expect(page.getByText('Missing', { exact: true }).first()).toBeVisible()
  await expect(page.getByTestId('detail-status')).toContainText(STATUS_LABEL.incomplete)

  // UI: both events are on the timeline.
  await page.getByRole('tab', { name: 'History' }).click()
  await expect(page.getByText('Flagged as missing: National ID copy').first()).toBeVisible()
  await expect(page.getByText('Status changed to Incomplete').first()).toBeVisible()

  // Store.
  await expect.poll(async () => (await appById(page, id)).status).toBe('incomplete')
  const after = await appById(page, id)
  expect(after.documents.find((d) => d.id === before.documents[0].id)?.missing).toBe(true)
  expect(after.timeline.some((e) => e.kind === 'document')).toBe(true)
  expect(
    after.timeline.some((e) => e.kind === 'status_change' && e.params?.status === 'incomplete'),
  ).toBe(true)
})

// ── 5. Bulk actions ─────────────────────────────────────────────────────────

test('a bulk action moves every selected application', async ({ page }) => {
  await gotoApp(page, '/admin/applications')

  const store = await apps(page)
  const newIds = store.filter((a) => a.status === 'new').map((a) => a.id)
  expect(newIds.length).toBeGreaterThan(1)

  await statusTab(page, 'new').click()
  await expectTotalRows(page, newIds.length)

  const selectAll = page.getByRole('checkbox', { name: 'Select all' })
  await expect(selectAll).toBeVisible()
  await selectAll.click()

  const bulkBar = page.getByText(`${newIds.length} of ${newIds.length} selected`)
  await expect(bulkBar).toBeVisible()

  const moveToReview = page.getByRole('button', { name: 'Move to review' })
  await expect(moveToReview).toBeEnabled()
  await moveToReview.click()

  await expect
    .poll(async () => {
      const now = await apps(page)
      return newIds.every((id) => now.find((a) => a.id === id)?.status === 'under_review')
    }, { timeout: 20_000 })
    .toBe(true)

  // The list agrees: nothing is `new` any more.
  await expect.poll(() => tabCount(page, 'new')).toBe(0)
})

// ── 6. Scoring ──────────────────────────────────────────────────────────────

test('the score panel shows the gauge, the criteria bars and the eligibility checklist', async ({
  page,
}) => {
  const id = 'APP-001'
  await gotoApp(page, `/admin/applications/${id}?tab=score`)

  const stored = await appById(page, id)
  expect(stored.score).toBeTruthy()

  await expect(page.getByTestId('score-total')).toHaveText(String(stored.score!.total))
  await expect(page.getByTestId('score-verdict')).toBeVisible()
  await expect(page.getByTestId('criterion-row')).toHaveCount(stored.score!.criteria.length)

  // Eligibility / completeness checklist.
  await expect(page.getByText('Eligibility checks')).toBeVisible()
  await expect(page.getByText('All documents uploaded')).toBeVisible()
  await expect(page.getByText('Terms accepted')).toBeVisible()
  await expect(page.getByText('Amount within programme cap')).toBeVisible()
  await expect(page.getByText('IBAN on file')).toBeVisible()
  await expect(page.getByText('Monthly income declared')).toBeVisible()
})

test('recalculating a score updates the displayed total to match the store', async ({ page }) => {
  const id = 'APP-001'
  await gotoApp(page, `/admin/applications/${id}?tab=score`)

  await page.getByRole('button', { name: 'Recalculate' }).click()
  await expect(page.getByText('Score updated')).toBeVisible()

  await expect
    .poll(async () => {
      const stored = await appById(page, id)
      return (await page.getByTestId('score-total').textContent())?.trim() ===
        String(stored.score!.total)
    })
    .toBe(true)
})

// ── 7. Settings → live re-scoring ───────────────────────────────────────────

const CRITERIA = [
  'income_stability',
  'project_experience',
  'seriousness',
  'repayment_ability',
  'data_completeness',
] as const

async function setWeights(page: Page, weights: Record<string, number>) {
  for (const key of CRITERIA) {
    await page.locator(`#weight-${key}`).fill(String(weights[key]))
  }
}

test('weights must stay normalised before they can be saved', async ({ page }) => {
  await gotoApp(page, '/admin/settings')

  await page.locator('#weight-income_stability').fill('90')
  await expect(page.getByText('Weights must total 100%').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()

  await page.getByRole('button', { name: 'Reset to defaults' }).click()
  await expect(page.getByText('Total weight: 100%')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('changing a criterion weight in settings re-scores the application, in UI and store', async ({
  page,
}) => {
  const id = 'APP-001'
  await gotoApp(page, '/admin/applications')
  const ref = (await appById(page, id)).ref
  await navigateTo(page, 'Settings')

  // Put the whole weight on one criterion: the total must then *be* that
  // criterion's value, which makes the effect of a weight exactly predictable.
  const first = { ...zeroWeights(), data_completeness: 100 }
  await setWeights(page, first)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Criteria saved and scores recalculated')).toBeVisible()

  const scored = (await appById(page, id)).score!
  const values = Object.fromEntries(scored.criteria.map((c) => [c.key, c.value]))
  expect(scored.total).toBe(values.data_completeness)

  // Now shift the weight onto the criterion whose value differs the most.
  const other = CRITERIA.filter((k) => k !== 'data_completeness').sort(
    (a, b) =>
      Math.abs(values[b] - values.data_completeness) -
      Math.abs(values[a] - values.data_completeness),
  )[0]
  expect(values[other]).not.toBe(values.data_completeness)

  await setWeights(page, { ...zeroWeights(), [other]: 100 })
  await expect(page.getByText('Total weight: 100%')).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()

  // Store: the score followed the weight.
  await expect.poll(async () => (await appById(page, id)).score!.total).toBe(values[other])
  expect(values[other]).not.toBe(scored.total)

  // UI: the score tab shows the new total (walked to, not reloaded).
  await navigateTo(page, 'Applications')
  await openFromList(page, ref)
  await page.getByRole('tab', { name: 'Score' }).click()
  await expect(page.getByTestId('score-total')).toHaveText(String(values[other]))

  // And the criterion weights rendered in the breakdown reflect the new config.
  await expect(page.getByTestId('criterion-row').filter({ hasText: 'Weight 100%' })).toHaveCount(1)
})

function zeroWeights(): Record<string, number> {
  return Object.fromEntries(CRITERIA.map((k) => [k, 0]))
}
