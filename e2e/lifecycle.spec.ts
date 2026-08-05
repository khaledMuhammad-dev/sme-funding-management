import { test, expect, pinLocale, readStore, attachWizardDocuments } from './support/app'
import { lookupOnTrack, signAsBeneficiary } from './support/esign'
import type { Page } from '@playwright/test'
import type {
  Application,
  AppNotification,
  Contract,
  Disbursement,
  FollowUp,
  Interview,
} from '../src/data/types'

/**
 * The demo dry-run: the entire funding lifecycle, in the order the presenter
 * will walk it on stage, in a SINGLE browser session.
 *
 * ⚠️ The demo database lives in memory, so `page.goto` throws away everything
 * built so far. This file loads the app exactly once, at the very top, and then
 * moves between screens only through the product's own links and buttons. A
 * reload anywhere in here would silently reset the story and let the test pass
 * for the wrong reason.
 *
 * Every step is asserted twice — on the surface the audience sees, and against
 * the live zustand store — so a screen that merely repaints cannot pass.
 */

const applicant = {
  fullName: 'Hessa Al Dossari',
  nationalId: '1076543210',
  phone: '0553219876',
  email: 'hessa@example.com',
  region: 'Riyadh',
  regionAr: 'الرياض',
  city: 'Riyadh',
  iban: 'SA4420000009876543219876',
  projectName: 'Hessa Ceramics Studio',
  sector: 'Crafts',
  sectorAr: 'حرف يدوية',
  description:
    'A ceramics studio producing hand-thrown tableware for restaurants and gift shops, ' +
    'expanding with a second kiln and a small retail corner in the first year.',
  requestedAmount: '95000',
  monthlyIncome: '7000',
  experienceYears: '5',
}

/* ── presentability ────────────────────────────────────────────────────────── */

/**
 * i18n namespaces that must never reach the screen as a raw key.
 * A missing translation renders the key itself, which on stage reads as a bug.
 */
const KEY_NAMESPACES = [
  'common',
  'applications',
  'contracts',
  'disbursement',
  'followUp',
  'interviews',
  'scoring',
  'timeline',
  'docKind',
  'table',
  'dashboard',
  'nav',
  'track',
  'region',
  'sector',
  'apply',
].join('|')

const RAW_KEY = new RegExp(`\\b(${KEY_NAMESPACES})\\.[a-z][a-zA-Z_]+\\b`)

/**
 * Fails if the screen the presenter is standing on shows unfinished plumbing.
 * Called at every stop of the walkthrough, not just at the end.
 */
async function assertPresentable(page: Page, where: string) {
  const text = await page.locator('body').innerText()

  expect(text, `${where}: an unrendered {{placeholder}} is on screen`).not.toMatch(/\{\{|\}\}/)
  expect(text, `${where}: "undefined" is on screen`).not.toMatch(/\bundefined\b/)
  expect(text, `${where}: "NaN" is on screen`).not.toMatch(/\bNaN\b/)

  const rawKey = RAW_KEY.exec(text)
  expect(rawKey?.[0], `${where}: raw i18n key "${rawKey?.[0]}" is on screen`).toBeUndefined()
}

/* ── small helpers ─────────────────────────────────────────────────────────── */

/**
 * Waits for sonner to retire its toasts on its own.
 *
 * Deliberately passive: removing the toast nodes behind sonner's back makes its
 * next render crash React and blanks the whole app.
 */
async function toastsGone(page: Page) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}

/** Widens the page so a target row cannot be hiding behind the 10-row default. */
async function showAllRows(page: Page) {
  await page.getByRole('combobox', { name: 'Rows per page' }).click()
  await page.getByRole('option', { name: '50' }).click()
}

/** Types into the table's global search and waits for it to narrow to one row. */
async function searchToSingleRow(page: Page, term: string) {
  await expect(async () => {
    await page.getByRole('searchbox').fill(term)
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}

function rowFor(page: Page, text: string) {
  return page.locator('tbody tr').filter({ hasText: text }).first()
}

async function openRowMenu(page: Page, rowText: string) {
  await rowFor(page, rowText).getByRole('button', { name: 'Open menu' }).click()
}

/**
 * Follows an admin sidebar link — client-side, so the demo database survives.
 *
 * Waits on the URL rather than a heading: the outgoing page is still mounted
 * during the transition, so a heading assertion can resolve against the screen
 * being left behind.
 */
async function sidebar(page: Page, name: string, path: string, navLabel = 'Admin') {
  await page
    .getByRole('navigation', { name: navLabel })
    .getByRole('link', { name, exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
}

const appById = async (page: Page, id: string) =>
  (await readStore<Application[]>(page, 'applications')).find((a) => a.id === id)!

/* ── wizard steps ──────────────────────────────────────────────────────────── */

async function fillPersonalStep(page: Page, lang: 'en' | 'ar' = 'en') {
  const ar = lang === 'ar'
  await page.getByLabel(ar ? /الاسم الرباعي/ : /Full name/).fill(applicant.fullName)
  await page.getByLabel(ar ? /رقم الهوية/ : /National ID number/).fill(applicant.nationalId)
  await page.getByLabel(ar ? /رقم الجوال/ : /Mobile number/).fill(applicant.phone)
  await page.getByLabel(ar ? /البريد الإلكتروني/ : /Email address/).fill(applicant.email)
  await page.getByLabel(ar ? /المدينة/ : /^City/).fill(applicant.city)
  await page.getByLabel(ar ? /رقم الآيبان/ : /IBAN/).fill(applicant.iban)

  await page.getByLabel(ar ? /المنطقة/ : /^Region/).click()
  await page.getByRole('option', { name: ar ? applicant.regionAr : applicant.region, exact: true }).click()
}

async function fillProjectStep(page: Page, lang: 'en' | 'ar' = 'en') {
  const ar = lang === 'ar'
  await page.getByLabel(ar ? /اسم المشروع/ : /Project name/).fill(applicant.projectName)
  await page.getByLabel(ar ? /قطاع المشروع/ : /^Sector/).click()
  await page.getByRole('option', { name: ar ? applicant.sectorAr : applicant.sector, exact: true }).click()
  await page.getByLabel(ar ? /وصف المشروع/ : /Project description/).fill(applicant.description)
  await page.getByLabel(ar ? /المبلغ المطلوب/ : /Requested amount/).fill(applicant.requestedAmount)
  await page.getByLabel(ar ? /الدخل الشهري/ : /Current monthly income/).fill(applicant.monthlyIncome)
  await page.getByLabel(ar ? /سنوات الخبرة/ : /Years of experience/).fill(applicant.experienceYears)
}

async function fillDocumentsStep(page: Page) {
  // The upload control is a real file input — hand it real bytes.
  await attachWizardDocuments(page)
}

async function acceptTerms(page: Page) {
  await page.getByTestId('terms-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const checkbox = page.getByRole('checkbox')
  await expect(checkbox).toBeEnabled()
  await checkbox.click()
  await expect(checkbox).toBeChecked()
}

const nextStep = (page: Page, lang: 'en' | 'ar' = 'en') =>
  page.getByRole('button', { name: lang === 'ar' ? 'التالي' : 'Next' }).click()

/** Runs the whole 5-step wizard and returns the reference it was given. */
async function submitApplication(page: Page, lang: 'en' | 'ar' = 'en') {
  await fillPersonalStep(page, lang)
  await nextStep(page, lang)
  await fillProjectStep(page, lang)
  await nextStep(page, lang)
  await fillDocumentsStep(page)
  await nextStep(page, lang)
  await acceptTerms(page)
  await nextStep(page, lang)

  await page.getByRole('button', { name: lang === 'ar' ? 'إرسال الطلب' : 'Submit application' }).click()
  await expect(page.getByTestId('submitted-ref')).toBeVisible()
  const ref = (await page.getByTestId('submitted-ref').innerText()).trim()
  expect(ref).toMatch(/^APP-\d{4}-\d{4}$/)
  return ref
}

/* ── interview + signature helpers ─────────────────────────────────────────── */

async function scheduleInDialog(page: Page) {
  const dialog = page.getByRole('dialog', { name: /Schedule an interview/ })
  await expect(dialog).toBeVisible()

  await dialog.locator('#interviewer').click()
  const option = page.getByRole('option').nth(1)
  const interviewer = (await option.textContent())!.trim()
  await option.click()

  const dayChip = dialog.getByRole('radio').nth(1)
  await dayChip.click()
  await expect(dayChip).toHaveAttribute('aria-checked', 'true')

  // Slots the chosen interviewer already holds are closed; take any free one
  // rather than fighting the double-booking guard.
  const slotChip = dialog.locator('button[aria-pressed]:not([disabled])').first()
  await slotChip.click()
  await expect(slotChip).toHaveAttribute('aria-pressed', 'true')

  await dialog.getByRole('button', { name: 'Confirm slot' }).click()
  await expect(dialog).toBeHidden()
  return { interviewer }
}

/**
 * The applicant goes to her portal and signs the contract she was sent.
 *
 * This is where the demo's signing happens now: staff never sign a contract
 * from the dashboard — the programme's own signature was applied centrally when
 * the contract was drawn up, and hers is what completes it.
 *
 * The walkthrough travels through the product's own links, so the portal is
 * reached the way the audience will see it. `signAsBeneficiary` runs her actual
 * dialog once `<BeneficiarySignAction />` is mounted on `TrackPage`, and until
 * then calls the same store mutation the dialog calls, so the money chain below
 * stays genuinely under test.
 */
async function signOnPortal(page: Page, ref: string, contractId: string, signatureName: string) {
  await page.getByRole('link', { name: 'Applicant portal' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Track application' }).click()
  await expect(page.getByRole('heading', { name: 'Track your application' })).toBeVisible()

  await lookupOnTrack(page, ref)
  await expect(page.getByTestId('track-contract')).toHaveAttribute('data-status', 'sent')

  const path = await signAsBeneficiary(page, { contractId, signatureName })
  test.info().annotations.push({ type: 'signing-path', description: path })
}

/* ── the dry-run ───────────────────────────────────────────────────────────── */

test('the whole funding lifecycle runs end to end in one demo session', async ({ page }) => {
  test.setTimeout(360_000)

  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`${page.url()} → ${error.message}`))

  // A native print dialog would freeze the session mid-demo.
  await page.addInitScript(() => {
    window.print = () => {}
  })

  /* ── 1. The applicant submits ─────────────────────────────────────────── */

  // THE ONLY PAGE LOAD IN THIS TEST. Everything below travels through the UI.
  await pinLocale(page, 'en')
  await page.goto('/apply')
  await expect(page.getByRole('heading', { name: 'New funding application' })).toBeVisible()

  const applicationsBefore = (await readStore<Application[]>(page, 'applications')).length
  const ref = await submitApplication(page)
  await expect(page.getByRole('heading', { name: 'Your application has been received' })).toBeVisible()
  await assertPresentable(page, 'submission confirmation')

  const created = (await readStore<Application[]>(page, 'applications')).find((a) => a.ref === ref)!
  expect(created, `no application with ref ${ref} reached the store`).toBeTruthy()
  const id = created.id
  expect(created.status).toBe('new')
  expect(created.project.requestedAmount).toBe(Number(applicant.requestedAmount))
  expect((await readStore<Application[]>(page, 'applications')).length).toBe(applicationsBefore + 1)

  /* ── 2. …and tracks it ────────────────────────────────────────────────── */

  await page.getByRole('link', { name: 'Track it now' }).click()
  await expect(page).toHaveURL(new RegExp(`/track\\?ref=${ref}`))
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
  await expect(page.getByTestId('track-applicant')).toContainText(applicant.fullName)

  const stepper = page.getByTestId('track-stepper')
  await expect(stepper.getByRole('listitem')).toHaveCount(6)
  await expect(stepper.locator('[data-current="true"]')).toContainText('New')
  await expect(page.getByTestId('track-timeline').getByRole('listitem').first()).toBeVisible()

  // The `received` notification is already in her message history — one record
  // per channel the programme sends on, so the count comes from the store.
  const received = (await readStore<AppNotification[]>(page, 'notifications')).filter(
    (n) => n.applicationId === id,
  )
  expect(received.length).toBeGreaterThan(0)
  expect(received.every((n) => n.trigger === 'received')).toBe(true)
  await expect(page.getByTestId('track-notifications').getByRole('listitem')).toHaveCount(
    received.length,
  )
  await expect(page.getByTestId('track-notifications')).toContainText(ref)
  await assertPresentable(page, '/track (new)')

  /* ── 3. It reaches the officer's list ─────────────────────────────────── */

  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await sidebar(page, 'Applications', '/admin/applications')

  const newTab = page.getByRole('tab').filter({ hasText: 'New' }).first()
  const expectedNew = (await readStore<Application[]>(page, 'applications')).filter(
    (a) => a.status === 'new',
  ).length
  await expect
    .poll(async () => Number(((await newTab.textContent()) ?? '').replace('New', '').trim()))
    .toBe(expectedNew)

  await searchToSingleRow(page, ref)
  await expect(rowFor(page, ref)).toContainText(applicant.fullName)
  await assertPresentable(page, 'applications list')

  /* ── 4. Screening: checklist, score, assignment ───────────────────────── */

  await rowFor(page, ref).click()
  await expect(page.getByTestId('detail-status')).toContainText('New')
  await expect(page.getByRole('heading', { name: applicant.fullName })).toBeVisible()

  await page.getByRole('tab', { name: 'Score' }).click()

  // Completeness + eligibility checklist are rendered for a brand-new file…
  await expect(page.getByText('Eligibility checks')).toBeVisible()
  await expect(page.getByText('All documents uploaded')).toBeVisible()
  await expect(page.getByText('Terms accepted')).toBeVisible()
  await expect(page.getByText('IBAN on file')).toBeVisible()

  // …and the file is unscored until the officer asks for a score.
  expect((await appById(page, id)).score).toBeUndefined()
  await page.getByRole('button', { name: 'Recalculate' }).first().click()
  await expect(page.getByText('Score updated')).toBeVisible()

  await expect.poll(async () => (await appById(page, id)).score?.total).toEqual(expect.any(Number))
  const score = (await appById(page, id)).score!
  await expect(page.getByTestId('score-total')).toHaveText(String(score.total))
  await expect(page.getByTestId('score-verdict')).toBeVisible()
  await expect(page.getByTestId('criterion-row')).toHaveCount(score.criteria.length)
  await assertPresentable(page, 'application detail · score')
  await toastsGone(page)

  // Assign to a reviewer.
  await page.getByRole('button', { name: 'Assign', exact: true }).click()
  const assignDialog = page.getByRole('dialog')
  await assignDialog.getByRole('radio').first().click()
  await assignDialog.getByRole('button', { name: 'Confirm assignment' }).click()

  await expect.poll(async () => (await appById(page, id)).assignee).toBeTruthy()
  const reviewer = (await appById(page, id)).assignee!

  // The assignee is rendered on the Details tab, which is not the one we are on.
  await page.getByRole('tab', { name: 'Details' }).click()
  await expect(page.getByTestId('detail-assignee')).toHaveText(reviewer)
  await toastsGone(page)

  /* ── 5. new → under review, then an interview is booked ───────────────── */

  await page.getByRole('button', { name: 'Change status' }).click()
  const transition = page.getByRole('dialog')
  // statusFlow allows exactly `incomplete` and `under_review` from `new`.
  await expect(transition.getByRole('radio')).toHaveCount(2)
  await transition.getByRole('radio', { name: 'Under review' }).click()
  await transition.getByRole('button', { name: 'Confirm change' }).click()

  await expect(page.getByTestId('detail-status')).toContainText('Under review')
  await expect.poll(async () => (await appById(page, id)).status).toBe('under_review')
  await toastsGone(page)

  await page.getByRole('button', { name: 'Schedule', exact: true }).first().click()
  const { interviewer } = await scheduleInDialog(page)

  await expect
    .poll(async () =>
      (await readStore<Interview[]>(page, 'interviews')).find((i) => i.applicationId === id)?.status,
    )
    .toBe('scheduled')
  // Booking the slot is what moves the file on — no separate status click.
  await expect(page.getByTestId('detail-status')).toContainText('Awaiting interview')
  await expect.poll(async () => (await appById(page, id)).status).toBe('awaiting_interview')

  await toastsGone(page)
  await page.getByRole('tab', { name: 'Interview', exact: true }).click()
  await expect(page.getByRole('tabpanel')).toContainText(interviewer)
  await expect(page.getByRole('tabpanel')).toContainText('Scheduled')
  await assertPresentable(page, 'application detail · interview')

  /* ── 6. The interview happens ─────────────────────────────────────────── */

  await sidebar(page, 'Interviews', '/admin/interviews')
  await showAllRows(page)

  await openRowMenu(page, applicant.fullName)
  await page.getByRole('menuitem', { name: 'Interview notes' }).click()

  const notes = page.getByRole('dialog', { name: 'Interview notes' })
  await expect(notes).toBeVisible()
  await notes.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(notes.getByRole('button', { name: 'Recommend', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await notes
    .getByLabel('Notes')
    .fill('Clear production plan and existing wholesale buyers. Recommended for funding.')
  await notes.getByRole('button', { name: 'Mark completed' }).click()
  await expect(notes).toBeHidden()

  await expect
    .poll(async () =>
      (await readStore<Interview[]>(page, 'interviews')).find((i) => i.applicationId === id)?.status,
    )
    .toBe('done')
  const interview = (await readStore<Interview[]>(page, 'interviews')).find(
    (i) => i.applicationId === id,
  )!
  expect(interview.verdict).toBe('recommend')
  expect(interview.notes).toContain('Clear production plan')

  await toastsGone(page)
  await expect(rowFor(page, applicant.fullName)).toContainText('Completed')
  await assertPresentable(page, 'interviews board')

  /* ── 7. Approval ──────────────────────────────────────────────────────── */

  await sidebar(page, 'Applications', '/admin/applications')
  await searchToSingleRow(page, ref)
  await rowFor(page, ref).click()
  await expect(page.getByTestId('detail-status')).toContainText('Awaiting interview')

  await page.getByRole('button', { name: 'Change status' }).click()
  const approve = page.getByRole('dialog')
  await approve.getByRole('radio', { name: 'Approved' }).click()
  await approve.getByRole('button', { name: 'Confirm change' }).click()

  await expect(page.getByTestId('detail-status')).toContainText('Approved')
  await expect.poll(async () => (await appById(page, id)).status).toBe('approved')
  await toastsGone(page)

  /* ── 8. Contract: generate → send → sign ──────────────────────────────── */

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
  expect(contract.status).toBe('draft')
  expect(contract.amount).toBe(Number(applicant.requestedAmount))
  // It leaves the programme already signed by the configured signatory.
  expect(contract.orgSignatureName).toBeTruthy()
  expect(contract.orgSignedAt).toBeTruthy()

  // The generated document opens for review and reads like a real contract.
  const preview = page.getByRole('dialog')
  await expect(preview.getByText('Project Funding Agreement')).toBeVisible()
  await expect(preview.getByText(contract.contractNo)).toBeVisible()
  await expect(preview.getByText(applicant.nationalId)).toBeVisible()
  await assertPresentable(page, 'contract preview')
  await preview.getByRole('button', { name: 'Close' }).click()
  await expect(preview).toBeHidden()
  await toastsGone(page)

  // Send for signature.
  await searchToSingleRow(page, contract.contractNo)
  await openRowMenu(page, contract.contractNo)
  await page.getByRole('menuitem', { name: 'Send for signature' }).click()
  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)?.status,
    )
    .toBe('sent')
  await expect(rowFor(page, contract.contractNo)).toContainText('Sent')
  // Staff hand it over rather than signing it themselves.
  await expect(rowFor(page, contract.contractNo)).toContainText('Awaiting applicant signature')
  await openRowMenu(page, contract.contractNo)
  await expect(page.getByRole('menuitem', { name: 'Sign contract' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await toastsGone(page)

  /* ── 8b. …and she signs it in her own portal ──────────────────────────── */

  await signOnPortal(page, ref, contract.id, created.beneficiary.fullNameEn)

  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)?.status,
    )
    .toBe('signed')
  const signed = (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)!
  expect(signed.signatureName).toBe(created.beneficiary.fullNameEn)
  expect(signed.signatureImage).toMatch(/^data:image\/png;base64,/)
  expect(signed.signedAt).toBeTruthy()
  // Both parties are now on the contract.
  expect(signed.orgSignatureName).toBe(contract.orgSignatureName)
  await assertPresentable(page, '/track (contract signed)')

  // Back to the officer's screens, still without a reload.
  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  await sidebar(page, 'Contracts', '/admin/contracts')
  await searchToSingleRow(page, contract.contractNo)
  await expect(rowFor(page, contract.contractNo)).toContainText('Signed')
  await assertPresentable(page, 'contracts list')
  await toastsGone(page)

  /* ── 9. The money moves ───────────────────────────────────────────────── */

  // Signing must have opened a finance record, or the file could never reach
  // the queue at all.
  await expect
    .poll(async () =>
      (await readStore<Disbursement[]>(page, 'disbursements')).find(
        (d) => d.applicationId === id,
      )?.status,
    )
    .toBe('pending')
  const disbursement = (await readStore<Disbursement[]>(page, 'disbursements')).find(
    (d) => d.applicationId === id,
  )!

  await sidebar(page, 'Disbursement', '/admin/disbursements')
  await page.getByRole('tab', { name: 'Awaiting order', exact: true }).click()
  await searchToSingleRow(page, disbursement.orderNo)

  // The list never shows a full IBAN.
  await expect(rowFor(page, disbursement.orderNo)).toContainText('••')
  expect(await page.locator('table').innerText()).not.toContain(disbursement.iban)

  await openRowMenu(page, disbursement.orderNo)
  await page.getByRole('menuitem', { name: 'Issue payment order' }).click()
  const order = page.getByRole('dialog')
  await expect(order.getByText(disbursement.orderNo)).toBeVisible()
  await expect(order.getByText('Authorised by')).toBeVisible()
  await assertPresentable(page, 'payment order dialog')
  await order.getByRole('button', { name: 'Issue order' }).click()

  await expect
    .poll(async () =>
      (await readStore<Disbursement[]>(page, 'disbursements')).find(
        (d) => d.id === disbursement.id,
      )?.status,
    )
    .toBe('ordered')
  await toastsGone(page)

  const followUpsBefore = (await readStore<FollowUp[]>(page, 'followUps')).length

  await page.getByRole('tab', { name: 'Order issued', exact: true }).click()
  await searchToSingleRow(page, disbursement.orderNo)
  await openRowMenu(page, disbursement.orderNo)
  await page.getByRole('menuitem', { name: 'Confirm payment' }).click()
  const payment = page.getByRole('dialog')
  await expect(payment.getByText(disbursement.orderNo)).toBeVisible()
  await payment.getByRole('button', { name: 'Confirm payment' }).click()
  await expect(payment).toBeHidden()

  await expect
    .poll(async () =>
      (await readStore<Disbursement[]>(page, 'disbursements')).find(
        (d) => d.id === disbursement.id,
      )?.status,
    )
    .toBe('paid')

  /* ── 10. Disbursed, and monitoring opens ──────────────────────────────── */

  await expect.poll(async () => (await appById(page, id)).status).toBe('disbursed')

  const followUps = (await readStore<FollowUp[]>(page, 'followUps')).filter(
    (f) => f.applicationId === id,
  )
  expect((await readStore<FollowUp[]>(page, 'followUps')).length).toBe(followUpsBefore + 1)
  expect(followUps).toHaveLength(1)
  expect(followUps[0].submittedAt).toBeUndefined()
  expect(new Date(followUps[0].dueDate).getTime()).toBeGreaterThan(Date.now())

  const notifications = await readStore<AppNotification[]>(page, 'notifications')
  expect(notifications.some((n) => n.applicationId === id && n.trigger === 'disbursed')).toBe(true)

  await toastsGone(page)
  await sidebar(page, 'Follow-up', '/admin/follow-up')
  await expect(page.getByRole('heading', { name: 'Project monitoring' })).toBeVisible()
  await expect(rowFor(page, applicant.projectName)).toBeVisible()
  await assertPresentable(page, 'project monitoring')

  /* ── 11. The beneficiary reports back ─────────────────────────────────── */

  // The report form is a deep link the beneficiary receives; the officer needs
  // a way into it from the project she is looking at.
  await openRowMenu(page, applicant.projectName)
  await page.getByRole('menuitem', { name: 'Open beneficiary form' }).click()
  await expect(page).toHaveURL(new RegExp(`/follow-up/${followUps[0].id}$`))
  await expect(page.getByRole('heading', { name: 'Periodic follow-up report' })).toBeVisible()

  await page.getByLabel(/Revenue this period/).fill('64000')
  await page.getByLabel(/Current number of employees/).fill('7')
  await page.getByLabel(/Estimated growth/).fill('28')
  await page.getByLabel(/Key challenges/).fill('Second kiln installed; wholesale orders doubled.')
  await assertPresentable(page, 'beneficiary follow-up form')
  await page.getByRole('button', { name: 'Submit report' }).click()

  await expect(page.getByTestId('follow-up-success')).toBeVisible()
  await expect
    .poll(async () =>
      (await readStore<FollowUp[]>(page, 'followUps')).find((f) => f.id === followUps[0].id)
        ?.performance.revenue,
    )
    .toBe(64000)
  const report = (await readStore<FollowUp[]>(page, 'followUps')).find(
    (f) => f.id === followUps[0].id,
  )!
  expect(report.performance).toEqual({ revenue: 64000, employees: 7, growthPct: 28 })
  expect(report.submittedAt).toBeTruthy()
  await toastsGone(page)

  /* ── …and the figures land on the officer's screens ───────────────────── */

  await page.getByRole('link', { name: 'Admin' }).first().click()
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const activeProjects = (await readStore<Application[]>(page, 'applications')).filter((a) =>
    ['disbursed', 'follow_up'].includes(a.status),
  ).length
  const kpi = (label: string) =>
    page.locator('[data-morph-host]').filter({ hasText: label }).first()
  await expect(kpi('Active projects').locator('span').last()).toHaveText(String(activeProjects))
  await expect(kpi('Total applications').locator('span').last()).toHaveText(
    String((await readStore<Application[]>(page, 'applications')).length),
  )

  // The activity feed is ordered by `updatedAt`, so this project now leads it —
  // a cached dashboard query would still be showing the old head.
  const activity = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Recent activity' }) })
  await expect(activity.locator('li').first()).toContainText(ref)
  await assertPresentable(page, 'dashboard')

  await sidebar(page, 'Follow-up', '/admin/follow-up')
  const monitoringRow = rowFor(page, applicant.projectName)
  await expect(monitoringRow).toContainText('64,000')
  await expect(monitoringRow).not.toContainText('Overdue')
  await expect(monitoringRow).toContainText('On track')

  /* ── 12. Back to the applicant's own view ─────────────────────────────── */

  await page.getByRole('link', { name: 'Applicant portal' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('link', { name: 'Track application' }).click()
  await expect(page.getByRole('heading', { name: 'Track your application' })).toBeVisible()

  // Retried as a unit: the page-transition animation can remount the field and
  // drop a fill that landed mid-flight, which then disables the submit button.
  const refInput = page.getByLabel('Reference number')
  await expect(async () => {
    await refInput.fill(ref)
    await expect(refInput).toHaveValue(ref, { timeout: 2_000 })
    await page.getByRole('button', { name: 'Look up' }).click({ timeout: 5_000 })
    await expect(page.getByTestId('track-ref')).toHaveText(ref, { timeout: 5_000 })
  }).toPass({ timeout: 30_000 })

  // Filing the report took the last legal edge, `disbursed → follow_up`, so the
  // stepper now stands on the final stage of the happy path.
  expect((await appById(page, id)).status).toBe('follow_up')
  await expect(page.getByTestId('track-stepper').locator('[data-current="true"]')).toContainText(
    'Follow-up',
  )

  // The timeline carries every stage the file passed through.
  const finalApp = await appById(page, id)
  expect(finalApp.timeline.length).toBeGreaterThan(6)
  const timeline = page.getByTestId('track-timeline')
  await expect(timeline.getByRole('listitem').first()).toBeVisible()

  // Every notification the journey generated is in her message history.
  const mine = (await readStore<AppNotification[]>(page, 'notifications')).filter(
    (n) => n.applicationId === id,
  )
  expect(mine.length).toBeGreaterThan(1)
  await expect(page.getByTestId('track-notifications').getByRole('listitem')).toHaveCount(mine.length)
  await assertPresentable(page, '/track (disbursed)')

  expect(errors, `runtime errors during the walkthrough: ${errors.join(' | ')}`).toEqual([])
})

/* ── Arabic variant ────────────────────────────────────────────────────────── */

test('the opening of the demo runs in Arabic with an RTL layout', async ({ page }) => {
  test.setTimeout(180_000)

  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await pinLocale(page, 'ar')
  await page.goto('/apply')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'طلب تمويل جديد' })).toBeVisible()

  const ref = await submitApplication(page, 'ar')
  await expect(page.getByRole('heading', { name: 'تم استلام طلبك بنجاح' })).toBeVisible()
  await assertPresentable(page, 'AR submission confirmation')

  const created = (await readStore<Application[]>(page, 'applications')).find((a) => a.ref === ref)!
  expect(created.status).toBe('new')
  const id = created.id

  // Tracking, in Arabic.
  await page.getByRole('link', { name: 'تتبّع الطلب الآن' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
  await expect(page.getByTestId('track-notifications')).toContainText('تم استلام طلبك')
  await assertPresentable(page, 'AR /track')

  // Into the admin side without a reload — the file must still be there.
  await page.getByRole('link', { name: 'لوحة الإدارة' }).first().click()
  await expect(page.getByRole('heading', { name: 'لوحة المؤشرات' })).toBeVisible()

  await sidebar(page, 'الطلبات', '/admin/applications', 'لوحة الإدارة')
  await searchToSingleRow(page, ref)
  await rowFor(page, ref).click()

  await expect(page.getByTestId('detail-status')).toContainText('جديد')

  // …and it can take its first legal transition in Arabic.
  await page.getByRole('button', { name: 'تغيير الحالة' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('radio')).toHaveCount(2)
  await dialog.getByRole('radio', { name: 'تحت الدراسة' }).click()
  await dialog.getByRole('button', { name: 'تأكيد التغيير' }).click()

  await expect(page.getByTestId('detail-status')).toContainText('تحت الدراسة')
  await expect
    .poll(async () => (await appById(page, id)).status)
    .toBe('under_review')

  await assertPresentable(page, 'AR application detail')
  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})
