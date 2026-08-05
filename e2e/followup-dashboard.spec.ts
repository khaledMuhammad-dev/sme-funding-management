import { test, expect, gotoApp, pinLocale, readStore, settle, clearToasts } from './support/app'
import type { Page } from '@playwright/test'
import type { Application, AppNotification, FollowUp } from '../src/data/types'

/**
 * Module 07 (post-funding follow-up) + module 08 (dashboard & reports).
 *
 * Everything is asserted twice: once in the UI and once against the live zustand
 * demo database, so a rendering that merely *looks* updated cannot pass.
 */

const PHONE = { width: 390, height: 844 }

/** Collects page errors and console errors so a test can fail on either. */
function watchForErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
  })
  return errors
}

/** Boots the app once just to read the deterministic fixtures out of the store. */
async function readFixtures(page: Page) {
  await gotoApp(page, '/')
  const followUps = await readStore<FollowUp[]>(page, 'followUps')
  const applications = await readStore<Application[]>(page, 'applications')
  return { followUps, applications }
}

/** One row of the monitoring table = one funded project, latest report wins. */
function projectRows(followUps: FollowUp[]) {
  const byApplication = new Map<string, FollowUp[]>()
  for (const followUp of followUps) {
    byApplication.set(followUp.applicationId, [
      ...(byApplication.get(followUp.applicationId) ?? []),
      followUp,
    ])
  }
  return [...byApplication.entries()].map(([applicationId, list]) => {
    const sorted = [...list].sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1))
    const latest = sorted[sorted.length - 1]
    return {
      applicationId,
      followUps: sorted,
      latest,
      health: latest.healthStatus,
      overdue: !latest.submittedAt && new Date(latest.dueDate).getTime() < Date.now(),
    }
  })
}

/* ── 1. Beneficiary follow-up form ─────────────────────────────────────────── */

test.describe('beneficiary follow-up form', () => {
  test('submits a report from a phone and writes the figures to the store', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const errors = watchForErrors(page)

    const { followUps } = await readFixtures(page)
    const pending = followUps.find((f) => !f.submittedAt)
    expect(pending, 'fixtures must contain an unsubmitted follow-up').toBeTruthy()

    await gotoApp(page, `/follow-up/${pending!.id}`)

    await expect(page.getByRole('heading', { name: 'Periodic follow-up report' })).toBeVisible()

    await page.getByLabel(/Revenue this period/).fill('48500')
    await page.getByLabel(/Current number of employees/).fill('6')
    await page.getByLabel(/Estimated growth/).fill('23')
    await page.getByLabel(/Key challenges/).fill('Opened a second kitchen and hired two staff.')

    await page.getByRole('button', { name: 'Submit report' }).click()

    // Success state, not just a toast.
    await expect(page.getByTestId('follow-up-success')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Thank you — your report has been received' }),
    ).toBeVisible()

    const after = await readStore<FollowUp[]>(page, 'followUps')
    const saved = after.find((f) => f.id === pending!.id)!
    expect(saved.performance).toEqual({ revenue: 48500, employees: 6, growthPct: 23 })
    expect(saved.submittedAt).toBeTruthy()
    expect(Number.isNaN(Date.parse(saved.submittedAt!))).toBe(false)
    expect(saved.healthStatus).toBe('on_track')

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('rejects nonsense input with localized errors', async ({ page }) => {
    await page.setViewportSize(PHONE)
    const { followUps } = await readFixtures(page)
    const pending = followUps.find((f) => !f.submittedAt)!

    await gotoApp(page, `/follow-up/${pending.id}`)

    // Empty submit — every required numeric field complains in the UI locale.
    await page.getByRole('button', { name: 'Submit report' }).click()
    await expect(page.getByText('This field is required')).toHaveCount(3)
    await expect(page.getByTestId('follow-up-success')).toHaveCount(0)

    // Out-of-range and non-integer values.
    await page.getByLabel(/Revenue this period/).fill('-5')
    await page.getByLabel(/Current number of employees/).fill('2.5')
    await page.getByLabel(/Estimated growth/).fill('9000')
    await page.getByRole('button', { name: 'Submit report' }).click()

    await expect(page.getByText('Minimum allowed value is 0')).toBeVisible()
    await expect(page.getByText('Enter a whole number')).toBeVisible()
    await expect(page.getByText('Maximum allowed value is 500')).toBeVisible()
    await expect(page.getByTestId('follow-up-success')).toHaveCount(0)

    // Nothing was written.
    const after = await readStore<FollowUp[]>(page, 'followUps')
    expect(after.find((f) => f.id === pending.id)!.submittedAt).toBeFalsy()
  })

  test('shows a not-found state for an unknown id instead of spinning forever', async ({
    page,
  }) => {
    await page.setViewportSize(PHONE)
    const errors = watchForErrors(page)

    await gotoApp(page, '/follow-up/FUP-does-not-exist')

    await expect(
      page.getByText('No application found with that reference'),
    ).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Submit report' })).toHaveCount(0)

    expect(errors, errors.join('\n')).toEqual([])
  })
})

/* ── 2 & 3. Monitoring table and project detail sheet ──────────────────────── */

test.describe('project monitoring', () => {
  test('table counts, health badges, overdue flags and sparklines match the store', async ({
    page,
  }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/follow-up')

    const followUps = await readStore<FollowUp[]>(page, 'followUps')
    const rows = projectRows(followUps)

    await expect(page.getByRole('status')).toHaveText(
      `Showing 1–${rows.length} of ${rows.length}`,
    )

    // Health summary cards are store-derived.
    const card = (label: string) =>
      page.locator('[data-morph-host]').filter({ hasText: label }).first()
    await expect(card('Active projects')).toContainText(String(rows.length))
    await expect(card('At risk')).toContainText(
      String(rows.filter((r) => r.health === 'at_risk').length),
    )
    await expect(card('Defaulted')).toContainText(
      String(rows.filter((r) => r.health === 'defaulted').length),
    )

    // Every row carries a health badge…
    const badges = page.locator('tbody').getByText(/^(On track|At risk|Defaulted)$/)
    await expect(badges).toHaveCount(rows.length)

    // …and a revenue sparkline (projects with ≥2 reports).
    const withTrend = rows.filter((r) => r.followUps.length >= 2).length
    await expect(page.locator('tbody svg polyline')).toHaveCount(withTrend)

    // Overdue rows are flagged in red, not merely dated.
    const overdue = rows.filter((r) => r.overdue).length
    expect(overdue).toBeGreaterThan(0)
    await expect(page.locator('tbody .text-destructive').filter({ hasText: 'Overdue' })).toHaveCount(
      overdue,
    )

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('detail sheet shows history, impact chart and photos; reminder hits the store', async ({
    page,
  }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/follow-up')

    const followUps = await readStore<FollowUp[]>(page, 'followUps')
    const applications = await readStore<Application[]>(page, 'applications')
    const notificationsBefore = await readStore<AppNotification[]>(page, 'notifications')

    const target = projectRows(followUps).find((r) => r.followUps.length >= 2)!
    const application = applications.find((a) => a.id === target.applicationId)!

    await page.getByRole('row').filter({ hasText: application.project.name }).first().click()

    const sheet = page.getByRole('dialog')
    await expect(sheet.getByText(application.project.name).first()).toBeVisible()

    // Report history — one entry per submitted/overdue period.
    for (const followUp of target.followUps) {
      await expect(sheet.getByText(followUp.period, { exact: true }).first()).toBeVisible()
    }

    // Impact chart really mounts an SVG, not just a title.
    await expect(sheet.getByTestId('impact-chart').locator('svg')).toBeVisible()
    await expect(
      sheet.getByTestId('impact-chart').locator('path.recharts-line-curve'),
    ).toHaveCount(1)

    // Photo gallery.
    const photoCount = target.followUps.flatMap((f) => f.photos).length
    await expect(sheet.getByTestId('photo-gallery').locator('li')).toHaveCount(photoCount)

    // Send reminder → notification appended to the store.
    await sheet.getByRole('button', { name: 'Send reminder' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Reminder sent')

    const notificationsAfter = await readStore<AppNotification[]>(page, 'notifications')
    expect(notificationsAfter.length).toBe(notificationsBefore.length + 1)
    expect(notificationsAfter[0].trigger).toBe('follow_up_due')
    expect(notificationsAfter[0].applicationId).toBe(target.applicationId)

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('mark defaulted moves the project through a legal status transition', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/follow-up')

    const followUps = await readStore<FollowUp[]>(page, 'followUps')
    const applications = await readStore<Application[]>(page, 'applications')

    // Pick a project still in `disbursed` — `disbursed → follow_up` is the only
    // transition statusFlow permits from here, so the move must be observable.
    const target = projectRows(followUps).find((row) => {
      const app = applications.find((a) => a.id === row.applicationId)
      return row.health !== 'defaulted' && app?.status === 'disbursed'
    })
    expect(target, 'need a disbursed, non-defaulted project').toBeTruthy()
    const application = applications.find((a) => a.id === target!.applicationId)!

    const row = page.getByRole('row').filter({ hasText: application.project.name }).first()
    await row.getByRole('button', { name: 'Open menu' }).click()
    await page.getByRole('menuitem', { name: 'Mark as defaulted' }).click()

    const dialog = page.getByRole('dialog')
    const confirm = dialog.getByRole('button', { name: 'Mark as defaulted' })
    // A reason is mandatory.
    await expect(confirm).toBeDisabled()
    await dialog.getByLabel('Reason').fill('Revenue collapsed for two consecutive quarters.')
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect(page.locator('[data-sonner-toast]')).toContainText('Project marked as defaulted')
    await clearToasts(page)

    // UI: the row now reads Defaulted.
    await expect(
      page.getByRole('row').filter({ hasText: application.project.name }).first(),
    ).toContainText('Defaulted')

    // Store: health flipped and the application took the legal transition.
    const followUpsAfter = await readStore<FollowUp[]>(page, 'followUps')
    expect(
      followUpsAfter
        .filter((f) => f.applicationId === target!.applicationId)
        .every((f) => f.healthStatus === 'defaulted'),
    ).toBe(true)

    const applicationsAfter = await readStore<Application[]>(page, 'applications')
    const updated = applicationsAfter.find((a) => a.id === target!.applicationId)!
    expect(updated.status).toBe('follow_up')
    const transition = updated.timeline.filter((e) => e.kind === 'status_change').at(-1)!
    expect(transition.from).toBe('disbursed')
    expect(transition.to).toBe('follow_up')

    expect(errors, errors.join('\n')).toEqual([])
  })
})

/* ── 4. Live propagation across pages ──────────────────────────────────────── */

test('a submitted report propagates to the monitoring table and the dashboard', async ({
  page,
}) => {
  const errors = watchForErrors(page)

  const { followUps, applications } = await readFixtures(page)
  const pending = followUps.find((f) => !f.submittedAt)!
  const application = applications.find((a) => a.id === pending.applicationId)!

  const activeBefore = applications.filter((a) =>
    ['disbursed', 'follow_up'].includes(a.status),
  ).length
  const submittedBefore = followUps.filter((f) => f.submittedAt).length

  await gotoApp(page, `/follow-up/${pending.id}`)
  await page.getByLabel(/Revenue this period/).fill('77777')
  await page.getByLabel(/Current number of employees/).fill('9')
  await page.getByLabel(/Estimated growth/).fill('31')
  await page.getByRole('button', { name: 'Submit report' }).click()
  await expect(page.getByTestId('follow-up-success')).toBeVisible()
  await clearToasts(page)

  // Navigate in-app: a full page load would reset the in-memory demo database.
  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  // Dashboard KPIs recompute from the mutated store.
  const dashboardCard = (label: string) =>
    page.locator('[data-morph-host]').filter({ hasText: label }).first()
  await expect(dashboardCard('Active projects')).toContainText(String(activeBefore))

  /*
    The activity feed is ordered by `updatedAt`; submitting the report appended a
    timeline event, so this project must now lead the list. A cached dashboard
    query would still show the old head — this is the stale-data canary.
  */
  const activityCard = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Recent activity' }) })
  await expect(activityCard.locator('li').first()).toContainText(application.ref)

  // The impact report picks up the new figures too.
  await page.getByRole('link', { name: 'Reports' }).first().click()
  await page.getByRole('tab', { name: 'Impact' }).click()
  await expect(page.locator('table tbody tr')).toHaveCount(submittedBefore + 1)
  await expect(
    page.getByRole('row').filter({ hasText: application.project.name }).first(),
  ).toContainText('77,777')

  await page.getByRole('link', { name: 'Follow-up' }).first().click()
  await expect(page.getByRole('heading', { name: 'Project monitoring' })).toBeVisible()

  // The monitoring table shows the new revenue — no stale cached figure.
  const row = page.getByRole('row').filter({ hasText: application.project.name }).first()
  await expect(row).toContainText('77,777')
  await expect(row).not.toContainText('Overdue')

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── 5, 6 & 8. Dashboard ───────────────────────────────────────────────────── */

test('dashboard KPIs, charts, staff table and activity feed are real and error-free', async ({
  page,
}) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/admin')

  const applications = await readStore<Application[]>(page, 'applications')
  const expectedTotal = applications.length
  const expectedActive = applications.filter((a) =>
    ['disbursed', 'follow_up'].includes(a.status),
  ).length

  const card = (label: string) =>
    page.locator('[data-morph-host]').filter({ hasText: label }).first()

  // The client's written KPI list, plus the two supporting extras.
  const labels = [
    'Total applications',
    'Acceptance rate',
    'Rejection rate',
    'Total disbursed',
    'Avg. processing time',
    'Struggling projects',
    'Active projects',
    'Average score',
  ]

  for (const label of labels) {
    await expect(card(label)).toBeVisible()
    // The count-up must settle on a finite value, never NaN or a blank tile.
    const value = card(label).locator('span').last()
    await expect(value).not.toHaveText(/NaN|Infinity|^\s*$/)
    await expect(value).toHaveText(/\d/)
  }

  // Two KPIs are checked against the store, including the settled count-up value.
  await expect(card('Total applications').locator('span').last()).toHaveText(
    String(expectedTotal),
  )
  await expect(card('Active projects').locator('span').last()).toHaveText(String(expectedActive))

  // All five charts mount an SVG.
  const chartTitles = [
    'Applications by status',
    'Applications over time',
    'Applications by region',
    'Monthly disbursement',
    'Impact of funded projects',
  ]
  for (const title of chartTitles) {
    const card = page
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
    await expect(card).toHaveCount(1)
    await expect(card.locator('svg.recharts-surface')).toHaveCount(1)
  }
  await expect(page.locator('.recharts-surface')).toHaveCount(5)

  // Staff performance — real names from timeline actors, not placeholders.
  const staffTable = page.locator('table').first()
  const staffRows = staffTable.locator('tbody tr')
  expect(await staffRows.count()).toBeGreaterThan(0)
  const assignees = new Set(applications.map((a) => a.assignee).filter(Boolean))
  await expect(staffRows).toHaveCount(assignees.size)
  await expect(staffRows.first()).not.toContainText(/—|N\/A|undefined|NaN/)

  // Recent activity feed — real application refs.
  const recent = [...applications].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, 6)
  for (const application of recent.slice(0, 3)) {
    await expect(page.getByText(application.ref, { exact: false }).first()).toBeVisible()
  }

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── 7. Reports ────────────────────────────────────────────────────────────── */

test('reports: filters, all four tabs, CSV download and print', async ({ page }) => {
  const errors = watchForErrors(page)

  // A native print dialog would freeze the session — stub it and record calls.
  await page.addInitScript(() => {
    const w = window as unknown as { __printed?: number }
    w.__printed = 0
    window.print = () => {
      w.__printed = (w.__printed ?? 0) + 1
    }
  })

  await gotoApp(page, '/admin/reports')

  const applications = await readStore<Application[]>(page, 'applications')
  const rowCount = page.locator('table tbody tr')

  await expect(rowCount).toHaveCount(applications.length)

  // Region filter changes the rendered report.
  const riyadh = applications.filter((a) => a.beneficiary.region === 'riyadh').length
  expect(riyadh).toBeGreaterThan(0)
  expect(riyadh).toBeLessThan(applications.length)

  await page.getByLabel('Region').click()
  await page.getByRole('option', { name: 'Riyadh' }).click()
  await expect(rowCount).toHaveCount(riyadh)
  await expect(page.getByText('Records:')).toContainText(String(riyadh))

  // Status filter stacks on top of it.
  const riyadhNew = applications.filter(
    (a) => a.beneficiary.region === 'riyadh' && a.status === 'new',
  ).length
  await page.getByLabel('Status').click()
  await page.getByRole('option', { name: 'New', exact: true }).click()
  await expect(rowCount).toHaveCount(riyadhNew)

  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(rowCount).toHaveCount(applications.length)

  // Every report tab renders a populated table.
  for (const tab of ['Applications', 'Financial', 'Impact', 'Geographic', 'Performance']) {
    await page.getByRole('tab', { name: tab }).click()
    await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('data-state', 'active')
    expect(await rowCount.count(), `${tab} tab must render rows`).toBeGreaterThan(0)
  }

  await page.getByRole('tab', { name: 'Applications' }).click()
  await expect(rowCount).toHaveCount(applications.length)

  // CSV export produces a real download with a sane header row.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^applications-report-\d{4}-\d{2}-\d{2}\.csv$/)

  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  const csv = Buffer.concat(chunks).toString('utf8').replace(/^﻿/, '')
  const [header, first] = csv.split('\n')
  expect(header).toBe(
    '"Reference","Applicant","Region","Amount","Status","Submitted","Days to decision"',
  )
  expect(first).toContain(`"${applications[0].ref}"`)
  expect(csv.trim().split('\n')).toHaveLength(applications.length + 1)

  // Print fires without a crash (and without a native dialog).
  await page.getByRole('button', { name: 'Print' }).click()
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1)

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── 9. Arabic / RTL ───────────────────────────────────────────────────────── */

test('dashboard and reports render correctly in Arabic RTL', async ({ page }) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/admin', 'ar')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByRole('heading', { name: 'لوحة المؤشرات' })).toBeVisible()
  await expect(page.getByText('إجمالي الطلبات')).toBeVisible()

  const applications = await readStore<Application[]>(page, 'applications')
  const disbursements = await readStore<{ status: string; amount: number }[]>(
    page,
    'disbursements',
  )
  const paid = disbursements
    .filter((d) => d.status === 'paid')
    .reduce((sum, d) => sum + d.amount, 0)

  const card = (label: string) =>
    page.locator('[data-morph-host]').filter({ hasText: label }).first()

  // Numbers go through Intl for the Arabic locale — compare against Intl itself.
  await expect(card('إجمالي الطلبات').locator('span').last()).toHaveText(
    await page.evaluate(
      (total) => new Intl.NumberFormat('ar-SA-u-nu-latn').format(total),
      applications.length,
    ),
  )
  await expect(card('إجمالي المصروف').locator('span').last()).toHaveText(
    await page.evaluate(
      (amount) =>
        new Intl.NumberFormat('ar-SA-u-nu-latn', {
          style: 'currency',
          currency: 'SAR',
          maximumFractionDigits: 1,
          notation: 'compact',
        }).format(amount),
      paid,
    ),
  )

  // Charts stay inside their cards and the page never scrolls sideways.
  await expect(page.locator('.recharts-surface')).toHaveCount(5)
  const overflow = await page.evaluate(() => {
    const bodyOverflows = document.body.scrollWidth > window.innerWidth + 1
    const charts = [...document.querySelectorAll('.recharts-responsive-container')]
    const chartOverflows = charts.filter((chart) => {
      const parent = chart.parentElement!
      return chart.getBoundingClientRect().width > parent.getBoundingClientRect().width + 1
    }).length
    return { bodyOverflows, chartOverflows, chartCount: charts.length }
  })
  expect(overflow.chartCount).toBe(5)
  expect(overflow.bodyOverflows).toBe(false)
  expect(overflow.chartOverflows).toBe(0)

  // Reports in Arabic.
  await page.getByRole('link', { name: 'التقارير' }).first().click()
  await expect(page.getByRole('heading', { name: 'التقارير' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'الطلبات' })).toBeVisible()
  await expect(page.locator('table tbody tr')).toHaveCount(applications.length)
  expect(
    await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1),
  ).toBe(false)

  // Follow-up monitoring in Arabic — health badges are localized.
  await page.getByRole('link', { name: 'المتابعة' }).first().click()
  await expect(page.getByRole('heading', { name: 'متابعة المشاريع' })).toBeVisible()
  await settle(page)
  await expect(page.locator('tbody').getByText(/^(على المسار|متعثّر|متعثرة|معرّض للخطر)$/).first()).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── Dark mode ─────────────────────────────────────────────────────────────── */

test('dashboard, reports and monitoring render in dark mode without errors', async ({ page }) => {
  const errors = watchForErrors(page)

  await pinLocale(page, 'en', 'dark')
  await page.goto('/admin')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await expect(page.locator('.recharts-surface')).toHaveCount(5)
  await expect(
    page.locator('[data-morph-host]').filter({ hasText: 'Total applications' }).first(),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Reports' }).first().click()
  await expect(page.locator('table tbody tr').first()).toBeVisible()

  await page.getByRole('link', { name: 'Follow-up' }).first().click()
  await expect(page.getByRole('heading', { name: 'Project monitoring' })).toBeVisible()
  await expect(page.locator('tbody svg polyline').first()).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})
