import { test, expect, gotoApp, readStore, settle } from './support/app'
import type { Page } from '@playwright/test'
import type { Application, Disbursement, FollowUp } from '../src/data/types'

/**
 * Module 08 — the client's written KPI list.
 *
 * Point 8 of the requirement asks for: number of applications, acceptance and
 * rejection rates, total disbursed funding, application processing time,
 * struggling/defaulted projects, geographic distribution and employee
 * performance. Each one is asserted against a value recomputed here from the
 * live zustand store, so a hardcoded or drifted figure cannot pass.
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

const card = (page: Page, label: string) =>
  page.locator('[data-morph-host]').filter({ hasText: label }).first()

const cardValue = (page: Page, label: string) => card(page, label).locator('span').last()

const DECIDED = ['approved', 'rejected', 'disbursed', 'follow_up']

/**
 * The same derivation the app uses: the first `status_change` event whose `to`
 * is a decision, measured from `createdAt`. Deliberately not `updatedAt`.
 */
function decisionDays(application: Application): number | null {
  const decision = application.timeline.find(
    (event) =>
      event.kind === 'status_change' && (event.to === 'approved' || event.to === 'rejected'),
  )
  if (!decision) return null
  return Math.max(
    0,
    (new Date(decision.at).getTime() - new Date(application.createdAt).getTime()) / 86_400_000,
  )
}

/** Latest report per funded project — health is judged on the most recent one. */
function strugglingCount(followUps: FollowUp[]) {
  const latest = new Map<string, FollowUp>()
  for (const followUp of followUps) {
    const current = latest.get(followUp.applicationId)
    if (!current || current.dueDate <= followUp.dueDate) latest.set(followUp.applicationId, followUp)
  }
  return [...latest.values()].filter((f) => f.healthStatus !== 'on_track').length
}

async function expectedKpis(page: Page) {
  const applications = await readStore<Application[]>(page, 'applications')
  const disbursements = await readStore<Disbursement[]>(page, 'disbursements')
  const followUps = await readStore<FollowUp[]>(page, 'followUps')

  const decided = applications.filter((a) => DECIDED.includes(a.status))
  const accepted = decided.filter((a) => a.status !== 'rejected')
  const approvalRate = decided.length
    ? Math.round((accepted.length / decided.length) * 100)
    : 0
  const days = applications
    .map(decisionDays)
    .filter((value): value is number => value !== null)

  return {
    total: applications.length,
    approvalRate,
    rejectionRate: decided.length ? 100 - approvalRate : 0,
    disbursed: disbursements
      .filter((d) => d.status === 'paid')
      .reduce((sum, d) => sum + d.amount, 0),
    avgDays: days.length
      ? Math.round(days.reduce((sum, value) => sum + value, 0) / days.length)
      : 0,
    struggling: strugglingCount(followUps),
    active: applications.filter((a) => ['disbursed', 'follow_up'].includes(a.status)).length,
  }
}

/** Formats through the very same Intl call the app makes, inside the page. */
function intlNumber(page: Page, value: number, locale: string) {
  return page.evaluate(
    ([v, l]) => new Intl.NumberFormat(l as string).format(v as number),
    [value, locale] as const,
  )
}

function intlCompactCurrency(page: Page, value: number, locale: string) {
  return page.evaluate(
    ([v, l]) =>
      new Intl.NumberFormat(l as string, {
        style: 'currency',
        currency: 'SAR',
        maximumFractionDigits: 1,
        notation: 'compact',
      }).format(v as number),
    [value, locale] as const,
  )
}

/* ── English ───────────────────────────────────────────────────────────────── */

test('every KPI on the client list renders on the dashboard and matches the store', async ({
  page,
}) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/admin')

  const expected = await expectedKpis(page)

  // 1. Number of applications.
  await expect(cardValue(page, 'Total applications')).toHaveText(
    await intlNumber(page, expected.total, 'en-GB'),
  )

  // 2. Acceptance and rejection rates — complementary, both real.
  await expect(cardValue(page, 'Acceptance rate')).toHaveText(`${expected.approvalRate}%`)
  await expect(cardValue(page, 'Rejection rate')).toHaveText(`${expected.rejectionRate}%`)
  expect(expected.approvalRate + expected.rejectionRate).toBe(100)

  // 3. Total disbursed funding.
  await expect(cardValue(page, 'Total disbursed')).toHaveText(
    await intlCompactCurrency(page, expected.disbursed, 'en-GB'),
  )

  // 4. Application processing time — days from submission to first decision.
  expect(expected.avgDays).toBeGreaterThan(0)
  await expect(cardValue(page, 'Avg. processing time')).toHaveText(
    `${await intlNumber(page, expected.avgDays, 'en-GB')} days`,
  )

  // 5. Struggling / defaulted projects.
  expect(expected.struggling).toBeGreaterThan(0)
  await expect(cardValue(page, 'Struggling projects')).toHaveText(String(expected.struggling))

  // Supporting extras still agree with the store.
  await expect(cardValue(page, 'Active projects')).toHaveText(String(expected.active))

  // 6. Geographic distribution of beneficiaries by region.
  const regionChart = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Applications by region', exact: true }) })
  await expect(regionChart.locator('svg.recharts-surface')).toHaveCount(1)

  // 7. Employee performance.
  const staffCard = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Team performance', exact: true }) })
  expect(await staffCard.locator('tbody tr').count()).toBeGreaterThan(0)

  // Nothing anywhere on the page degenerated into NaN/Infinity.
  await expect(page.locator('main')).not.toContainText(/NaN|Infinity/)

  expect(errors, errors.join('\n')).toEqual([])
})

test('the reports page covers processing time and geographic distribution', async ({ page }) => {
  const errors = watchForErrors(page)

  // A native print dialog would freeze the session.
  await page.addInitScript(() => {
    window.print = () => {}
  })

  await gotoApp(page, '/admin/reports')

  const applications = await readStore<Application[]>(page, 'applications')

  // Days-to-decision column on the applications report, with `—` for undecided.
  const decidedCount = applications.filter((a) => decisionDays(a) !== null).length
  expect(decidedCount).toBeGreaterThan(0)
  await expect(page.getByRole('columnheader', { name: 'Days to decision' })).toBeVisible()

  const decidedApp = applications.find((a) => decisionDays(a) !== null)!
  await expect(
    page.getByRole('row').filter({ hasText: decidedApp.ref }).first(),
  ).toContainText(String(Math.round(decisionDays(decidedApp)!)))

  const undecided = applications.find((a) => decisionDays(a) === null)!
  await expect(page.getByRole('row').filter({ hasText: undecided.ref }).first()).toContainText('—')

  // Geographic report tab — one row per region that has beneficiaries.
  await page.getByRole('tab', { name: 'Geographic' }).click()
  const regions = new Set(applications.map((a) => a.beneficiary.region))
  await expect(page.locator('table tbody tr')).toHaveCount(regions.size)
  await expect(page.getByText('Records:')).toContainText(String(regions.size))

  const riyadh = applications.filter((a) => a.beneficiary.region === 'riyadh').length
  await expect(page.getByRole('row').filter({ hasText: 'Riyadh' }).first()).toContainText(
    String(riyadh),
  )
  await expect(page.locator('table')).not.toContainText(/NaN|Infinity/)

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── Arabic / RTL ──────────────────────────────────────────────────────────── */

test('the client KPI set renders in Arabic RTL with the same numbers', async ({ page }) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/admin', 'ar')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  const expected = await expectedKpis(page)
  const AR = 'ar-SA-u-nu-latn'

  await expect(cardValue(page, 'إجمالي الطلبات')).toHaveText(
    await intlNumber(page, expected.total, AR),
  )
  await expect(cardValue(page, 'نسبة القبول')).toHaveText(`${expected.approvalRate}%`)
  await expect(cardValue(page, 'نسبة الرفض')).toHaveText(`${expected.rejectionRate}%`)
  await expect(cardValue(page, 'إجمالي المصروف')).toHaveText(
    await intlCompactCurrency(page, expected.disbursed, AR),
  )
  await expect(cardValue(page, 'متوسط مدة المعالجة')).toHaveText(
    `${await intlNumber(page, expected.avgDays, AR)} يوم`,
  )
  await expect(cardValue(page, 'مشاريع متعثرة')).toHaveText(String(expected.struggling))

  await expect(page.locator('main')).not.toContainText(/NaN|Infinity/)
  // The extra KPI tiles must not push the page into a sideways scroll.
  expect(await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1)).toBe(false)

  // Reports: the geographic tab is localized too.
  await page.getByRole('link', { name: 'التقارير' }).first().click()
  await page.getByRole('tab', { name: 'التوزيع الجغرافي' }).click()
  await expect(page.getByRole('columnheader', { name: 'المستفيدات' })).toBeVisible()
  await expect(page.locator('table tbody tr').first()).toBeVisible()

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── Empty database ────────────────────────────────────────────────────────── */

test('a completely empty database renders zeros and dashes, never NaN', async ({ page }) => {
  const errors = watchForErrors(page)

  /*
    Start on the landing page, which never runs the dashboard query, then wipe
    the store. Navigating client-side mounts the dashboard for the first time,
    so its query function reads the emptied database rather than a cached page.
  */
  await gotoApp(page, '/')
  await page.evaluate(() => {
    const store = (window as unknown as {
      __demoStore: { setState: (partial: Record<string, unknown>) => void }
    }).__demoStore
    store.setState({
      applications: [],
      interviews: [],
      contracts: [],
      disbursements: [],
      followUps: [],
      notifications: [],
    })
  })

  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await settle(page)

  const zeroLabels = [
    'Total applications',
    'Acceptance rate',
    'Rejection rate',
    'Struggling projects',
    'Active projects',
  ]
  for (const label of zeroLabels) {
    await expect(cardValue(page, label)).toHaveText(/^0%?$/)
  }

  // No decided application at all — an em dash, not "0 days" and not NaN.
  await expect(cardValue(page, 'Avg. processing time')).toHaveText('—')

  await expect(page.locator('main')).not.toContainText(/NaN|Infinity/)

  // Reports survive the empty store too.
  await page.getByRole('link', { name: 'Reports' }).first().click()
  await expect(page.getByText('No data in the selected range')).toBeVisible()
  await page.getByRole('tab', { name: 'Geographic' }).click()
  await expect(page.getByText('No data in the selected range')).toBeVisible()
  await expect(page.locator('main')).not.toContainText(/NaN|Infinity/)

  expect(errors, errors.join('\n')).toEqual([])
})
