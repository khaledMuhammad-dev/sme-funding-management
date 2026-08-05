import { test, expect, pinLocale, readStore, attachWizardDocuments, settle } from './support/app'
import { lookupOnTrack, signInPortalUi, PORTAL_SIGN_BUTTON, drawSignature, DEMO_OTP } from './support/esign'
import type { Page } from '@playwright/test'
import type { Application, Contract, Disbursement, FollowUp } from '../src/data/types'

/**
 * Captures the illustrated walkthrough for docs/DEMO.visual.md.
 *
 * Not part of the regression suite — it asserts just enough to keep itself on
 * the rails. Run it on demand:
 *
 *   DEMO_SHOTS=1 npx playwright test e2e/demo-screenshots.spec.ts --workers=1
 *
 * Same golden rule as the demo itself: ONE page load, then client-side
 * navigation only, so the in-memory database survives to the last screen.
 */

test.use({ viewport: { width: 1440, height: 900 } })

const SHOTS = 'docs/screenshots'

async function shot(page: Page, name: string) {
  await settle(page, 600)
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    animations: 'disabled',
    caret: 'hide',
  })
}

const applicant = {
  fullName: 'Hessa Al Dossari',
  nationalId: '1076543210',
  phone: '0553219876',
  email: 'hessa@example.com',
  region: 'Riyadh',
  city: 'Riyadh',
  iban: 'SA4420000009876543219876',
  projectName: 'Hessa Ceramics Studio',
  sector: 'Crafts',
  description:
    'A ceramics studio producing hand-thrown tableware for restaurants and gift shops, ' +
    'expanding with a second kiln and a small retail corner in the first year.',
  requestedAmount: '95000',
  monthlyIncome: '7000',
  experienceYears: '5',
}

async function toastsGone(page: Page) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}

async function showAllRows(page: Page) {
  await page.getByRole('combobox', { name: 'Rows per page' }).click()
  await page.getByRole('option', { name: '50' }).click()
}

async function searchToSingleRow(page: Page, term: string) {
  await expect(async () => {
    await page.getByRole('searchbox').fill(term)
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}

const rowFor = (page: Page, text: string) =>
  page.locator('tbody tr').filter({ hasText: text }).first()

async function openRowMenu(page: Page, rowText: string) {
  await rowFor(page, rowText).getByRole('button', { name: 'Open menu' }).click()
}

async function sidebar(page: Page, name: string, path: string) {
  await page
    .getByRole('navigation', { name: 'Admin' })
    .getByRole('link', { name, exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
}

const appById = async (page: Page, id: string) =>
  (await readStore<Application[]>(page, 'applications')).find((a) => a.id === id)!

test('capture the illustrated demo walkthrough', async ({ page }) => {
  test.skip(!process.env.DEMO_SHOTS, 'screenshot capture — run with DEMO_SHOTS=1')
  test.setTimeout(360_000)

  await page.addInitScript(() => {
    window.print = () => {}
  })

  /* ── 1 · The applicant submits ── */

  await pinLocale(page, 'en')
  await page.goto('/apply')
  await expect(page.getByRole('heading', { name: 'New funding application' })).toBeVisible()

  await page.getByLabel(/Full name/).fill(applicant.fullName)
  await page.getByLabel(/National ID number/).fill(applicant.nationalId)
  await page.getByLabel(/Mobile number/).fill(applicant.phone)
  await page.getByLabel(/Email address/).fill(applicant.email)
  await page.getByLabel(/^City/).fill(applicant.city)
  await page.getByLabel(/IBAN/).fill(applicant.iban)
  await page.getByLabel(/^Region/).click()
  await page.getByRole('option', { name: applicant.region, exact: true }).click()
  await shot(page, '01-apply-personal')
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByLabel(/Project name/).fill(applicant.projectName)
  await page.getByLabel(/^Sector/).click()
  await page.getByRole('option', { name: applicant.sector, exact: true }).click()
  await page.getByLabel(/Project description/).fill(applicant.description)
  await page.getByLabel(/Requested amount/).fill(applicant.requestedAmount)
  await page.getByLabel(/Current monthly income/).fill(applicant.monthlyIncome)
  await page.getByLabel(/Years of experience/).fill(applicant.experienceYears)
  await shot(page, '02-apply-project')
  await page.getByRole('button', { name: 'Next' }).click()

  await attachWizardDocuments(page)
  await shot(page, '03-apply-documents')
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByTestId('terms-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const checkbox = page.getByRole('checkbox')
  await expect(checkbox).toBeEnabled()
  await checkbox.click()
  await shot(page, '04-apply-terms')
  await page.getByRole('button', { name: 'Next' }).click()

  await shot(page, '05-apply-review')
  await page.getByRole('button', { name: 'Submit application' }).click()
  await expect(page.getByTestId('submitted-ref')).toBeVisible()
  const ref = (await page.getByTestId('submitted-ref').innerText()).trim()
  await shot(page, '06-apply-confirmation')

  const created = (await readStore<Application[]>(page, 'applications')).find((a) => a.ref === ref)!
  const id = created.id

  /* ── 2 · …and tracks it ── */

  await page.getByRole('link', { name: 'Track it now' }).click()
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
  await shot(page, '07-track-new')

  // Phone-frame preview of the "application received" notification.
  await page.getByTestId('track-notifications').getByRole('listitem').first().click()
  await shot(page, '08-track-notification-preview')
  await page.keyboard.press('Escape')

  /* ── 3 · It reaches the officer ── */

  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await sidebar(page, 'Applications', '/admin/applications')
  await searchToSingleRow(page, ref)
  await shot(page, '09-admin-applications-new')

  /* ── 4 · Screening: score and assign ── */

  await rowFor(page, ref).click()
  await expect(page.getByTestId('detail-status')).toContainText('New')
  await page.getByRole('tab', { name: 'Score' }).click()
  await expect(page.getByText('Eligibility checks')).toBeVisible()
  await page.getByRole('button', { name: 'Recalculate' }).first().click()
  await expect(page.getByTestId('score-total')).toBeVisible()
  await toastsGone(page)
  await shot(page, '10-admin-score')

  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  const assignDialog = page.getByRole('dialog')
  await assignDialog.getByRole('radio').first().click()
  await shot(page, '11-admin-assign')
  await assignDialog.getByRole('button', { name: 'Confirm assignment' }).click()
  await expect.poll(async () => (await appById(page, id)).assignee).toBeTruthy()
  await toastsGone(page)

  /* ── 5 · New → Under review → interview booked ── */

  await page.getByRole('button', { name: 'Change status' }).click()
  const transition = page.getByRole('dialog')
  await expect(transition.getByRole('radio')).toHaveCount(2)
  await shot(page, '12-admin-change-status')
  await transition.getByRole('radio', { name: 'Under review' }).click()
  await transition.getByRole('button', { name: 'Confirm change' }).click()
  await expect(page.getByTestId('detail-status')).toContainText('Under review')
  await toastsGone(page)

  await page.getByRole('button', { name: 'Schedule', exact: true }).first().click()
  const schedule = page.getByRole('dialog', { name: /Schedule an interview/ })
  await expect(schedule).toBeVisible()
  await schedule.locator('#interviewer').click()
  await page.getByRole('option').nth(1).click()
  const dayChip = schedule.getByRole('radio').nth(1)
  await dayChip.click()
  const slotChip = schedule.locator('button[aria-pressed]:not([disabled])').first()
  await slotChip.click()
  await shot(page, '13-admin-schedule-interview')
  await schedule.getByRole('button', { name: 'Confirm slot' }).click()
  await expect(schedule).toBeHidden()
  await expect(page.getByTestId('detail-status')).toContainText('Awaiting interview')
  await toastsGone(page)

  /* ── 6 · The interview happens ── */

  await sidebar(page, 'Interviews', '/admin/interviews')
  await showAllRows(page)
  await openRowMenu(page, applicant.fullName)
  await page.getByRole('menuitem', { name: 'Interview notes' }).click()
  const notes = page.getByRole('dialog', { name: 'Interview notes' })
  await notes.getByRole('button', { name: 'Recommend', exact: true }).click()
  await notes
    .getByLabel('Notes')
    .fill('Clear production plan and existing wholesale buyers. Recommended for funding.')
  await shot(page, '14-admin-interview-notes')
  await notes.getByRole('button', { name: 'Mark completed' }).click()
  await expect(notes).toBeHidden()
  await toastsGone(page)
  await expect(rowFor(page, applicant.fullName)).toContainText('Completed')
  await shot(page, '15-admin-interviews-completed')

  /* ── 7 · Approval ── */

  await sidebar(page, 'Applications', '/admin/applications')
  await searchToSingleRow(page, ref)
  await rowFor(page, ref).click()
  await page.getByRole('button', { name: 'Change status' }).click()
  const approve = page.getByRole('dialog')
  await approve.getByRole('radio', { name: 'Approved' }).click()
  await approve.getByRole('button', { name: 'Confirm change' }).click()
  await expect(page.getByTestId('detail-status')).toContainText('Approved')
  await toastsGone(page)
  await shot(page, '16-admin-approved')

  /* ── 8 · Contract: generate → send ── */

  await sidebar(page, 'Contracts', '/admin/contracts')
  await page.getByRole('button', { name: /^Generate contract$/ }).click()
  const generate = page.getByRole('dialog')
  await generate.getByRole('radio').filter({ hasText: ref }).click()
  await generate.getByRole('button', { name: /^Generate contract$/ }).click()

  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).some((c) => c.applicationId === id),
    )
    .toBe(true)
  const contract = (await readStore<Contract[]>(page, 'contracts')).find(
    (c) => c.applicationId === id,
  )!

  const preview = page.getByRole('dialog')
  await expect(preview.getByText('Project Funding Agreement')).toBeVisible()
  await shot(page, '17-admin-contract-preview')
  await preview.getByRole('button', { name: 'Close' }).click()
  await toastsGone(page)

  await searchToSingleRow(page, contract.contractNo)
  await openRowMenu(page, contract.contractNo)
  await page.getByRole('menuitem', { name: 'Send for signature' }).click()
  await expect(rowFor(page, contract.contractNo)).toContainText('Sent')
  await toastsGone(page)
  await shot(page, '18-admin-contract-sent')

  /* ── 8b · The applicant signs in her portal ── */

  await page.getByRole('link', { name: 'Applicant portal' }).click()
  await page.getByRole('link', { name: 'Track application' }).click()
  await expect(page.getByRole('heading', { name: 'Track your application' })).toBeVisible()
  await lookupOnTrack(page, ref)
  await expect(page.getByTestId('track-contract')).toHaveAttribute('data-status', 'sent')

  await page.locator(PORTAL_SIGN_BUTTON).click()
  const signing = page.getByTestId('beneficiary-signing-dialog')
  await expect(signing).toBeVisible()
  await signing
    .getByLabel(/Full name as on your ID/)
    .fill(created.beneficiary.fullNameEn)
  await drawSignature(page)
  await signing.getByLabel(/Verification code/).fill(DEMO_OTP)
  await shot(page, '19-portal-signing-dialog')
  await signing.getByRole('button', { name: /Sign and confirm/ }).click()
  await expect(signing).toBeHidden()

  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)?.status,
    )
    .toBe('signed')
  await toastsGone(page)
  await shot(page, '20-portal-contract-signed')

  /* ── 9 · The money moves ── */

  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const disbursement = (await readStore<Disbursement[]>(page, 'disbursements')).find(
    (d) => d.applicationId === id,
  )!
  await sidebar(page, 'Disbursement', '/admin/disbursements')
  await page.getByRole('tab', { name: 'Awaiting order', exact: true }).click()
  await searchToSingleRow(page, disbursement.orderNo)
  await shot(page, '21-admin-disbursement-queue')

  await openRowMenu(page, disbursement.orderNo)
  await page.getByRole('menuitem', { name: 'Issue payment order' }).click()
  const order = page.getByRole('dialog')
  await expect(order.getByText(disbursement.orderNo)).toBeVisible()
  await shot(page, '22-admin-payment-order')
  await order.getByRole('button', { name: 'Issue order' }).click()
  await toastsGone(page)

  await page.getByRole('tab', { name: 'Order issued', exact: true }).click()
  await searchToSingleRow(page, disbursement.orderNo)
  await openRowMenu(page, disbursement.orderNo)
  await page.getByRole('menuitem', { name: 'Confirm payment' }).click()
  const payment = page.getByRole('dialog')
  await payment.getByRole('button', { name: 'Confirm payment' }).click()
  await expect(payment).toBeHidden()
  await expect
    .poll(async () =>
      (await readStore<Disbursement[]>(page, 'disbursements')).find(
        (d) => d.id === disbursement.id,
      )?.status,
    )
    .toBe('paid')
  await toastsGone(page)

  /* ── 10 · Disbursed, monitoring opens ── */

  const followUp = (await readStore<FollowUp[]>(page, 'followUps')).find(
    (f) => f.applicationId === id,
  )!
  await sidebar(page, 'Follow-up', '/admin/follow-up')
  await expect(page.getByRole('heading', { name: 'Project monitoring' })).toBeVisible()
  await expect(rowFor(page, applicant.projectName)).toBeVisible()
  await shot(page, '23-admin-monitoring')

  /* ── 11 · The beneficiary reports back ── */

  await openRowMenu(page, applicant.projectName)
  await page.getByRole('menuitem', { name: 'Open beneficiary form' }).click()
  await expect(page.getByRole('heading', { name: 'Periodic follow-up report' })).toBeVisible()
  await page.getByLabel(/Revenue this period/).fill('64000')
  await page.getByLabel(/Current number of employees/).fill('7')
  await page.getByLabel(/Estimated growth/).fill('28')
  await page.getByLabel(/Key challenges/).fill('Second kiln installed; wholesale orders doubled.')
  await shot(page, '24-beneficiary-report-form')
  await page.getByRole('button', { name: 'Submit report' }).click()
  await expect(page.getByTestId('follow-up-success')).toBeVisible()
  await expect
    .poll(async () =>
      (await readStore<FollowUp[]>(page, 'followUps')).find((f) => f.id === followUp.id)
        ?.submittedAt,
    )
    .toBeTruthy()
  await toastsGone(page)

  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  // The charts animate in on mount; give them time to finish drawing.
  await settle(page, 2500)
  await shot(page, '25-admin-dashboard')

  await sidebar(page, 'Follow-up', '/admin/follow-up')
  await expect(rowFor(page, applicant.projectName)).toContainText('On track')
  await shot(page, '26-admin-monitoring-on-track')

  /* ── 12 · Close the loop ── */

  await page.getByRole('link', { name: 'Applicant portal' }).click()
  await page.getByRole('link', { name: 'Track application' }).click()
  await expect(page.getByRole('heading', { name: 'Track your application' })).toBeVisible()
  await lookupOnTrack(page, ref)
  await expect(page.getByTestId('track-stepper').locator('[data-current="true"]')).toContainText(
    'Follow-up',
  )
  await shot(page, '27-track-follow-up')
})

test('capture the encore: Arabic RTL and dark mode', async ({ page }) => {
  test.skip(!process.env.DEMO_SHOTS, 'screenshot capture — run with DEMO_SHOTS=1')
  test.setTimeout(120_000)

  await pinLocale(page, 'ar')
  await page.goto('/apply')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'طلب تمويل جديد' })).toBeVisible()
  await shot(page, '28-encore-arabic-apply')

  await pinLocale(page, 'en', 'dark')
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await settle(page, 2500)
  await shot(page, '29-encore-dark-dashboard')
})
