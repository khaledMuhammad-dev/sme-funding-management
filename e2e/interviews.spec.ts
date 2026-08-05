import { test, expect, gotoApp, readStore } from './support/app'
import type { Page } from '@playwright/test'
import type { Application, AppNotification, Interview } from '../src/data/types'

/**
 * Interview lifecycle: schedule → appears everywhere → notes → done/no-show.
 *
 * Every assertion that matters is made twice: once against the rendered UI and
 * once against the live zustand store, because the reported bug ("setting an
 * appointment adds nothing") was exactly a case where the store was right and
 * the UI never caught up.
 *
 * The store is in-memory, so `page.goto` resets it — after a mutation these
 * tests navigate through the app's own links instead.
 */

const DIALOG = { name: /Schedule an interview|تحديد موعد المقابلة/ }

/**
 * Waits for sonner to retire its toasts.
 *
 * Deliberately *not* `clearToasts()`: ripping the toast nodes out of the DOM
 * behind sonner's back makes its next render crash React with
 * `insertBefore … not a child of this node`, which blanks the whole app.
 */
async function settleToasts(page: Page) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}

async function apps(page: Page) {
  return readStore<Application[]>(page, 'applications')
}

async function interviewFor(page: Page, applicationId: string) {
  const interviews = await readStore<Interview[]>(page, 'interviews')
  return interviews.filter((i) => i.applicationId === applicationId).at(-1)
}

/** An application that may legally be sent to interview and has none yet. */
async function schedulableApps(page: Page) {
  const [applications, interviews] = await Promise.all([
    apps(page),
    readStore<Interview[]>(page, 'interviews'),
  ])
  const booked = new Set(interviews.map((i) => i.applicationId))
  const found = applications.filter((a) => a.status === 'under_review' && !booked.has(a.id))
  expect(found.length, 'fixtures must contain under_review applications without an interview')
    .toBeGreaterThan(1)
  return found
}

/**
 * The table paginates at 10 and its search box is broken app-wide (see report),
 * so rows are isolated by widening the page instead of filtering.
 */
async function showAllRows(page: Page) {
  await page.getByRole('combobox', { name: 'Rows per page' }).click()
  await page.getByRole('option', { name: '50' }).click()
  await expect(page.getByRole('status')).toHaveText(/Showing 1–\d+ of \d+/)
}

function rowFor(page: Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text })
}

/** Fills the schedule dialog and confirms. Returns what was actually picked. */
async function scheduleInDialog(
  page: Page,
  opts: { dayIndex?: number; slot?: string; interviewerIndex?: number } = {},
) {
  const { dayIndex = 1, slot = '13:00', interviewerIndex = 1 } = opts
  const dialog = page.getByRole('dialog', DIALOG)
  await expect(dialog).toBeVisible()

  await dialog.locator('#interviewer').click()
  const option = page.getByRole('option').nth(interviewerIndex)
  const interviewer = (await option.textContent())!.trim()
  await option.click()

  const dayChip = dialog.getByRole('radio').nth(dayIndex)
  await dayChip.click()
  await expect(dayChip).toHaveAttribute('aria-checked', 'true')
  const dayOfMonth = Number(await dayChip.getAttribute('data-day'))
  const date = (await dayChip.getAttribute('data-date'))!

  // Slots already held by the selected interviewer are closed; fall back to a
  // free one rather than fighting the double-booking guard.
  const preferred = dialog.getByRole('button', { name: slot, exact: true })
  const slotChip = (await preferred.isDisabled())
    ? dialog.locator('button[aria-pressed]:not([disabled])').first()
    : preferred
  const slotLabel = (await slotChip.textContent())!.trim()
  await slotChip.click()
  await expect(slotChip).toHaveAttribute('aria-pressed', 'true')

  await dialog.getByRole('button', { name: /Confirm slot|تأكيد الموعد/ }).click()
  await expect(dialog).toBeHidden()

  return { date, dayOfMonth, hour: Number(slotLabel.split(':')[0]), interviewer }
}

/* ── 1. The flow the user actually tried ──────────────────────────────────── */

test('schedules an interview from the application detail page', async ({ page }) => {
  await gotoApp(page, '/admin/applications')
  const [app] = await schedulableApps(page)
  const before = (await readStore<Interview[]>(page, 'interviews')).length

  await gotoApp(page, `/admin/applications/${app.id}`)
  await page.getByRole('button', { name: 'Schedule', exact: true }).first().click()

  const chosen = await scheduleInDialog(page)
  await expect(page.locator('[data-sonner-toast]')).toContainText('Interview scheduled')

  // ── store: the interview exists with exactly what was picked
  await expect
    .poll(async () => (await interviewFor(page, app.id))?.interviewer)
    .toBe(chosen.interviewer)

  const interview = (await interviewFor(page, app.id))!
  const at = new Date(interview.scheduledAt)
  expect(at.getDate()).toBe(chosen.dayOfMonth)
  expect(at.getHours()).toBe(chosen.hour)
  expect(at.getTime()).toBeGreaterThan(Date.now())
  expect(interview.status).toBe('scheduled')
  expect(interview.meetingUrl).toMatch(/^https:\/\//)

  // ── store: the application moved on, with a timeline entry and a notification
  const updated = (await apps(page)).find((a) => a.id === app.id)!
  expect(updated.status).toBe('awaiting_interview')
  expect(updated.timeline.some((e) => e.kind === 'interview')).toBe(true)

  const notifications = await readStore<AppNotification[]>(page, 'notifications')
  expect(
    notifications.some((n) => n.applicationId === app.id && n.trigger === 'interview_scheduled'),
  ).toBe(true)

  // ── UI: the detail page's interview tab shows it without a reload
  await settleToasts(page)
  await page.getByRole('tab', { name: 'Interview', exact: true }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel).toContainText(chosen.interviewer)
  await expect(panel).toContainText('Scheduled')
  await expect(panel).toContainText(String(chosen.dayOfMonth))

  // ── UI: and so does the interviews board
  await page.getByRole('link', { name: 'Interviews', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText(new RegExp(`of ${before + 1}$`))
  await showAllRows(page)

  const row = rowFor(page, app.beneficiary.fullName)
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(chosen.interviewer)
  await expect(row).toContainText('Scheduled')
  await expect(row.getByRole('link', { name: 'Open meeting' })).toHaveAttribute(
    'href',
    /^https:\/\//,
  )
})

/* ── 2. Reschedule from the interviews list ───────────────────────────────── */

test('reschedules an interview from the interviews list', async ({ page }) => {
  await gotoApp(page, '/admin/interviews')

  const interviews = await readStore<Interview[]>(page, 'interviews')
  const target = interviews.find((i) => i.status === 'scheduled')!
  expect(target, 'fixtures must contain a scheduled interview').toBeTruthy()
  const app = (await apps(page)).find((a) => a.id === target.applicationId)!

  await showAllRows(page)
  const total = (await page.getByRole('status').textContent())!
  const row = rowFor(page, app.beneficiary.fullName)
  await expect(row).toHaveCount(1)

  await row.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Reschedule' }).click()

  const chosen = await scheduleInDialog(page, { dayIndex: 3, slot: '15:00', interviewerIndex: 2 })
  await settleToasts(page)

  // Rescheduling replaces the live slot rather than stacking a second one.
  await expect
    .poll(async () => (await interviewFor(page, app.id))?.interviewer)
    .toBe(chosen.interviewer)
  await expect
    .poll(async () =>
      (await readStore<Interview[]>(page, 'interviews')).filter(
        (i) => i.applicationId === app.id && i.status === 'scheduled',
      ).length,
    )
    .toBe(1)

  await expect(page.getByRole('status')).toHaveText(total)
  await expect(row).toHaveCount(1)
  await expect(row).toContainText(chosen.interviewer)
  await expect(row).toContainText(String(chosen.dayOfMonth))
})

/* ── 3. Week calendar ─────────────────────────────────────────────────────── */

test('shows a newly scheduled interview in the right week-view day cell', async ({ page }) => {
  await gotoApp(page, '/admin/applications')
  const [app] = await schedulableApps(page)

  await gotoApp(page, `/admin/applications/${app.id}`)
  await page.getByRole('button', { name: 'Schedule', exact: true }).first().click()
  const chosen = await scheduleInDialog(page, { dayIndex: 0, slot: '09:00' })
  await expect.poll(async () => (await interviewFor(page, app.id))?.status).toBe('scheduled')
  await settleToasts(page)

  await page.getByRole('link', { name: 'Interviews', exact: true }).click()
  await page.getByRole('tab', { name: 'Week' }).click()

  const cell = page.locator(`[data-day-cell="${chosen.date}"]`)
  await expect(cell).toBeVisible()
  await expect(cell).toContainText(app.beneficiary.fullName)

  // Only that cell holds it.
  await expect(
    page.locator('[data-day-cell]').filter({ hasText: app.beneficiary.fullName }),
  ).toHaveCount(1)

  // Switching views must not drop it.
  await page.getByRole('tab', { name: 'List' }).click()
  await showAllRows(page)
  await expect(rowFor(page, app.beneficiary.fullName)).toHaveCount(1)
  await page.getByRole('tab', { name: 'Week' }).click()
  await expect(page.locator(`[data-day-cell="${chosen.date}"]`)).toContainText(
    app.beneficiary.fullName,
  )
})

/* ── 4. Notes sheet ───────────────────────────────────────────────────────── */

test('records notes, a verdict and completion from the notes sheet', async ({ page }) => {
  await gotoApp(page, '/admin/interviews')

  const interviews = await readStore<Interview[]>(page, 'interviews')
  const target = interviews.find((i) => i.status === 'scheduled')!
  const app = (await apps(page)).find((a) => a.id === target.applicationId)!

  await showAllRows(page)
  const row = rowFor(page, app.beneficiary.fullName)
  await expect(row).toHaveCount(1)

  await row.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Interview notes' }).click()

  const sheet = page.getByRole('dialog', { name: 'Interview notes' })
  await expect(sheet).toBeVisible()

  await sheet.getByRole('button', { name: 'Conditional' }).click()
  await expect(sheet.getByRole('button', { name: 'Conditional' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await sheet.getByLabel('Notes').fill('Strong operating plan; approve once the lease is signed.')
  await sheet.getByRole('button', { name: 'Mark completed' }).click()

  await expect(sheet).toBeHidden()
  await expect.poll(async () => (await interviewFor(page, app.id))?.status).toBe('done')
  const saved = (await interviewFor(page, app.id))!
  expect(saved.verdict).toBe('conditional')
  expect(saved.notes).toContain('Strong operating plan')

  await settleToasts(page)
  await expect(row).toContainText('Completed')

  // Reopening must show what was saved, not a blank form.
  await row.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Interview notes' }).click()
  await expect(sheet.getByLabel('Notes')).toHaveValue(/Strong operating plan/)
  await expect(sheet.getByRole('button', { name: 'Conditional' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // No-show is a distinct outcome.
  await sheet.getByRole('button', { name: 'Mark no-show' }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(async () => (await interviewFor(page, app.id))?.status).toBe('no_show')
  await settleToasts(page)
  await expect(row).toContainText('No show')
  await expect(row).not.toContainText('Completed')
})

/* ── 5. Empty state + no past slots ───────────────────────────────────────── */

test('shows an empty state when there is no interview, and never offers a past slot', async ({
  page,
}) => {
  await gotoApp(page, '/admin/applications')
  const [app] = await schedulableApps(page)

  await gotoApp(page, `/admin/applications/${app.id}?tab=interview`)
  const panel = page.getByRole('tabpanel')
  await expect(panel).toContainText('No interview scheduled yet')
  await expect(panel.locator('[data-slot="skeleton"]')).toHaveCount(0)

  await page.getByRole('button', { name: 'Schedule', exact: true }).first().click()
  const dialog = page.getByRole('dialog', DIALOG)

  // Every offered day is in the future…
  const days = await dialog
    .getByRole('radio')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-date')!))
  expect(days.length).toBeGreaterThan(0)
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  for (const day of days) expect(day > todayKey).toBe(true)

  // …and booking the earliest offered slot still lands after now.
  await scheduleInDialog(page, { dayIndex: 0, slot: '09:00' })
  await expect.poll(async () => (await interviewFor(page, app.id))?.status).toBe('scheduled')
  const interview = (await interviewFor(page, app.id))!
  expect(new Date(interview.scheduledAt).getTime()).toBeGreaterThan(Date.now())

  await settleToasts(page)
  await expect(panel).not.toContainText('No interview scheduled yet')
  await expect(panel).toContainText('Scheduled')
})

/* ── 6. No double-booking the same interviewer + slot ─────────────────────── */

test('refuses to double-book the same interviewer at the same time', async ({ page }) => {
  await gotoApp(page, '/admin/interviews')

  const scheduled = (await readStore<Interview[]>(page, 'interviews')).filter(
    (i) => i.status === 'scheduled',
  )
  expect(scheduled.length, 'need two scheduled interviews').toBeGreaterThan(1)
  const applications = await apps(page)
  const first = applications.find((a) => a.id === scheduled[0].applicationId)!
  const second = applications.find((a) => a.id === scheduled[1].applicationId)!

  await showAllRows(page)

  await rowFor(page, first.beneficiary.fullName).getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Reschedule' }).click()
  const taken = await scheduleInDialog(page, { dayIndex: 2, slot: '11:00', interviewerIndex: 0 })
  await settleToasts(page)

  await rowFor(page, second.beneficiary.fullName).getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('menuitem', { name: 'Reschedule' }).click()

  const dialog = page.getByRole('dialog', DIALOG)
  await dialog.locator('#interviewer').click()
  await page.getByRole('option').nth(0).click()
  await dialog.getByRole('radio').nth(2).click()

  const slotLabel = `${String(taken.hour).padStart(2, '0')}:00`
  await expect(dialog.getByRole('button', { name: slotLabel, exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Confirm slot' })).toBeDisabled()

  // A different interviewer is still free at that time.
  await dialog.locator('#interviewer').click()
  await page.getByRole('option').nth(1).click()
  await expect(dialog.getByRole('button', { name: slotLabel, exact: true })).toBeEnabled()
})

/* ── 7. Arabic / RTL ──────────────────────────────────────────────────────── */

test('schedules an interview in Arabic with a correct RTL layout', async ({ page }) => {
  await gotoApp(page, '/admin/applications', 'ar')
  const [app] = await schedulableApps(page)

  await gotoApp(page, `/admin/applications/${app.id}`, 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

  await page.getByRole('button', { name: 'تحديد موعد', exact: true }).first().click()
  const dialog = page.getByRole('dialog', DIALOG)
  await expect(dialog).toContainText('تحديد موعد المقابلة')
  await expect(dialog).toContainText('التاريخ')
  await expect(dialog).toContainText('الوقت')

  // The day strip flows right-to-left: the first chip sits to the *right* of the fourth.
  const chips = dialog.getByRole('radio')
  const first = (await chips.first().boundingBox())!
  const fourth = (await chips.nth(3).boundingBox())!
  expect(first.x).toBeGreaterThan(fourth.x)

  // Slot chips too.
  const slots = dialog.locator('button[aria-pressed]')
  const firstSlot = (await slots.first().boundingBox())!
  const lastSlot = (await slots.last().boundingBox())!
  expect(firstSlot.x).toBeGreaterThan(lastSlot.x)

  await scheduleInDialog(page, { dayIndex: 2, slot: '11:00' })

  await expect(page.locator('[data-sonner-toast]')).toContainText('تم تحديد موعد المقابلة')
  await expect.poll(async () => (await interviewFor(page, app.id))?.status).toBe('scheduled')
  await expect
    .poll(async () => (await apps(page)).find((a) => a.id === app.id)?.status)
    .toBe('awaiting_interview')

  await settleToasts(page)
  await page.getByRole('tab', { name: 'المقابلة' }).click()
  await expect(page.getByRole('tabpanel')).toContainText('مجدولة')
})
