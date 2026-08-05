import type { Page } from '@playwright/test'
import type { Application, AppNotification, Contract } from '../src/data/types'
import {
  test,
  expect,
  gotoApp,
  pinLocale,
  navigateTo,
  readStore,
  attachWizardDocuments,
  type Lang,
} from './support/app'

/**
 * The signed-in applicant's own notification surface, and his copy of the contract.
 *
 * The portal presents one person. The bell is always in the header: before the
 * first application it says there are no messages yet and points at applying or
 * tracking, and afterwards it carries what was actually sent. It never asks who
 * is holding the browser, and offers nothing to "forget". These tests cover that
 * whole story — empty, fills, rings, read, cleared — plus the contract delivery
 * that closes the loop on "sent as PDF".
 *
 * ⚠️ The demo database is in memory: `gotoApp` resets it to fixtures. Anywhere a
 * test has to prove that an admin action reached the applicant, it must travel
 * through the product's own links (`navigateTo`), never through a page load.
 */

const applicant = {
  fullName: 'Reem Al Harbi',
  nationalId: '1054321098',
  phone: '0556677889',
  email: 'reem@example.com',
  region: 'Riyadh',
  regionAr: 'الرياض',
  city: 'Riyadh',
  iban: 'SA4420000005544332211009',
  projectName: 'Reem Tailoring Atelier',
  sector: 'Crafts',
  sectorAr: 'حرف يدوية',
  description:
    'A tailoring atelier making made-to-measure abayas and uniforms for schools and clinics, ' +
    'adding two industrial machines and a fitting room in the first year.',
  requestedAmount: '70000',
  monthlyIncome: '6500',
  experienceYears: '3',
}

/* ── wizard ────────────────────────────────────────────────────────────────── */

const nextStep = (page: Page, lang: Lang = 'en') =>
  page.getByRole('button', { name: lang === 'ar' ? 'التالي' : 'Next' }).click()

async function submitApplication(page: Page, lang: Lang = 'en') {
  const ar = lang === 'ar'

  await page.getByLabel(ar ? /الاسم الرباعي/ : /Full name/).fill(applicant.fullName)
  await page.getByLabel(ar ? /رقم الهوية/ : /National ID number/).fill(applicant.nationalId)
  await page.getByLabel(ar ? /رقم الجوال/ : /Mobile number/).fill(applicant.phone)
  await page.getByLabel(ar ? /البريد الإلكتروني/ : /Email address/).fill(applicant.email)
  await page.getByLabel(ar ? /المدينة/ : /^City/).fill(applicant.city)
  await page.getByLabel(ar ? /رقم الآيبان/ : /IBAN/).fill(applicant.iban)
  await page.getByLabel(ar ? /المنطقة/ : /^Region/).click()
  await page
    .getByRole('option', { name: ar ? applicant.regionAr : applicant.region, exact: true })
    .click()
  await nextStep(page, lang)

  await page.getByLabel(ar ? /اسم المشروع/ : /Project name/).fill(applicant.projectName)
  await page.getByLabel(ar ? /قطاع المشروع/ : /^Sector/).click()
  await page
    .getByRole('option', { name: ar ? applicant.sectorAr : applicant.sector, exact: true })
    .click()
  await page.getByLabel(ar ? /وصف المشروع/ : /Project description/).fill(applicant.description)
  await page.getByLabel(ar ? /المبلغ المطلوب/ : /Requested amount/).fill(applicant.requestedAmount)
  await page.getByLabel(ar ? /الدخل الشهري/ : /Current monthly income/).fill(applicant.monthlyIncome)
  await page.getByLabel(ar ? /سنوات الخبرة/ : /Years of experience/).fill(applicant.experienceYears)
  await nextStep(page, lang)

  await attachWizardDocuments(page)
  await nextStep(page, lang)

  await page.getByTestId('terms-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const checkbox = page.getByRole('checkbox')
  await expect(checkbox).toBeEnabled()
  await checkbox.click()
  await nextStep(page, lang)

  await page.getByRole('button', { name: ar ? 'إرسال الطلب' : 'Submit application' }).click()
  await expect(page.getByTestId('submitted-ref')).toBeVisible()
  return (await page.getByTestId('submitted-ref').innerText()).trim()
}

/* ── small helpers ─────────────────────────────────────────────────────────── */

const bell = (page: Page) => page.getByTestId('portal-notification-bell')

/** Messages the demo database holds for one application — never a literal count. */
async function messagesFor(page: Page, applicationId: string) {
  const all = await readStore<AppNotification[]>(page, 'notifications')
  return all.filter((n) => n.applicationId === applicationId)
}

async function lookUp(page: Page, ref: string, lang: Lang = 'en') {
  const field = page.getByLabel(lang === 'ar' ? 'رقم الطلب' : 'Reference number')
  await expect(field).toBeVisible()
  await field.fill(ref)
  await page.getByRole('button', { name: lang === 'ar' ? 'بحث' : 'Look up' }).click()
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
}

/** Waits out sonner passively — removing its nodes crashes the app. */
async function toastsGone(page: Page) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}

/* ── tests ─────────────────────────────────────────────────────────────────── */

test('with nothing submitted the bell says so, and never asks who this is', async ({ page }) => {
  await gotoApp(page, '/')

  // The bell is always in the header — an applicant (or a client being shown
  // the portal) must be able to find where messages arrive before there are any.
  await expect(bell(page)).toBeVisible()
  await expect(bell(page)).toHaveAttribute('data-identified', 'false')
  await expect(page.getByTestId('portal-notification-badge')).toHaveCount(0)

  await bell(page).click()
  const empty = page.getByTestId('portal-notification-anonymous')
  await expect(empty).toBeVisible()
  // It reads as "nothing has arrived yet", not "we don't know who you are".
  await expect(empty).toContainText('No messages yet')
  await expect(empty).toContainText('Once you submit an application')
  await expect(page.getByTestId('portal-notification-forget')).toHaveCount(0)

  // The header still presents a signed-in user, with a neutral label.
  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'false')

  // It points at tracking rather than at identifying yourself.
  await page.getByTestId('portal-notification-open').click()
  await expect(page).toHaveURL(/\/track$/)
  await expect(page.getByLabel('Reference number')).toBeVisible()
  await expect(bell(page)).toHaveAttribute('data-identified', 'false')
})

test('submitting the wizard gives the applicant a bell, and an admin action lands in it', async ({
  page,
}) => {
  test.setTimeout(180_000)

  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`${page.url()} → ${error.message}`))

  // THE ONLY PAGE LOAD IN THIS TEST — everything below travels through the UI,
  // or the admin action would be wiped before the applicant could see it.
  await pinLocale(page, 'en')
  await page.goto('/apply')
  await expect(page.getByRole('heading', { name: 'New funding application' })).toBeVisible()
  await expect(bell(page)).toHaveAttribute('data-identified', 'false')

  const ref = await submitApplication(page)
  const application = (await readStore<Application[]>(page, 'applications')).find(
    (a) => a.ref === ref,
  )!
  expect(application).toBeTruthy()

  /* ── the bell appears, carrying the `received` fan-out ─────────────────── */

  await expect(bell(page)).toBeVisible()
  const received = await messagesFor(page, application.id)
  expect(received.length).toBeGreaterThan(0)
  expect(received.every((n) => n.trigger === 'received')).toBe(true)
  await expect(bell(page)).toHaveAttribute('data-unread', String(received.length))
  await expect(page.getByTestId('portal-notification-badge')).toHaveText(String(received.length))

  await bell(page).click()
  const centre = page.getByTestId('portal-notification-center')
  await expect(centre).toBeVisible()
  await expect(centre).toContainText(ref)
  await expect(page.getByTestId('portal-notification-item')).toHaveCount(received.length)

  /* ── a message opens the phone frame it was actually delivered in ──────── */

  const first = page.getByTestId('portal-notification-item').first()
  const channel = await first.getAttribute('data-channel')
  await first.click()

  const preview = page.getByTestId('phone-preview')
  await expect(preview).toBeVisible()
  await expect(preview.locator('[data-channel]')).toHaveAttribute('data-channel', channel!)
  const body = page.getByTestId('phone-preview-body')
  await expect(body).toContainText(ref)
  // English UI renders the English rendering of the template, not the Arabic one.
  await expect(body).toContainText(received.find((n) => n.channel === channel)!.bodyEn)

  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()

  /* ── mark read clears the badge, and it stays cleared across a nav ─────── */

  await bell(page).click()
  await page.getByTestId('portal-notification-mark-read').click()
  await expect(page.getByTestId('portal-notification-badge')).toHaveCount(0)
  await expect(bell(page)).toHaveAttribute('data-unread', '0')
  await page.keyboard.press('Escape')

  await navigateTo(page, '/track')
  await expect(page.getByLabel('Reference number')).toBeVisible()
  await expect(bell(page)).toHaveAttribute('data-unread', '0')

  /* ── an officer asks for documents, in the same page load ──────────────── */

  await navigateTo(page, '/admin')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Admin' })
    .getByRole('link', { name: 'Applications', exact: true })
    .first()
    .click()
  await expect(page).toHaveURL(/\/admin\/applications$/)

  await expect(async () => {
    await page.getByRole('searchbox').fill(ref)
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await page.locator('tbody tr').first().click()
  await expect(page.getByTestId('detail-status')).toContainText('New')

  await page.getByRole('button', { name: 'Change status' }).click()
  const transition = page.getByRole('dialog')
  await transition.getByRole('radio', { name: 'Incomplete' }).click()
  await transition
    .getByLabel(/Reason for the change/)
    .fill('The commercial register copy is unreadable, please send it again.')
  await transition.getByRole('button', { name: 'Confirm change' }).click()
  await expect(page.getByTestId('detail-status')).toContainText('Incomplete')
  await toastsGone(page)

  /* ── …and it is waiting in her bell when she comes back ────────────────── */

  await navigateTo(page, '/')
  // The fan-out is written by the mutation's onSuccess — poll rather than assume
  // it has landed, and never assert a literal number of channels.
  await expect
    .poll(async () => (await messagesFor(page, application.id)).some((n) => n.trigger === 'incomplete'))
    .toBe(true)
  const afterAdmin = await messagesFor(page, application.id)
  const incomplete = afterAdmin.filter((n) => n.trigger === 'incomplete')

  await expect(bell(page)).toBeVisible()
  // Only the new fan-out is unread — the `received` batch was cleared earlier.
  await expect(bell(page)).toHaveAttribute('data-unread', String(incomplete.length))

  await bell(page).click()
  await expect(page.getByTestId('portal-notification-item')).toHaveCount(afterAdmin.length)
  await expect(
    page.getByTestId('portal-notification-item').filter({ hasText: 'Documents requested' }).first(),
  ).toBeVisible()

  /* ── clicking through lands on her application, already looked up ──────── */

  await page.getByTestId('portal-notification-open').click()
  await expect(page).toHaveURL(new RegExp(`/track\\?ref=${ref}`))
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
  await expect(page.getByTestId('track-applicant')).toContainText(applicant.fullName)

  /* ── and it stays his portal, with nothing offering to hand it over ────── */

  // Opening the popover again is only meaningful once the previous one is gone —
  // clicking the bell while it is still open would close it instead.
  await expect(page.getByTestId('portal-notification-center')).toBeHidden()
  await bell(page).click()
  await expect(page.getByTestId('portal-notification-center')).toBeVisible()
  await expect(page.getByTestId('portal-notification-forget')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // The header names him, from the application he just submitted.
  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'true')
  await expect(page.getByTestId('portal-identity-name')).toHaveText(applicant.fullName)

  await navigateTo(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(bell(page)).toHaveAttribute('data-identified', 'true')
  await expect(page.getByTestId('portal-identity-name')).toHaveText(applicant.fullName)

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('looking a reference up fills the bell and names the signed-in applicant', async ({ page }) => {
  await gotoApp(page, '/track')
  await expect(bell(page)).toHaveAttribute('data-identified', 'false')
  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'false')

  const apps = await readStore<Application[]>(page, 'applications')
  const target = apps.find((a) => a.status === 'awaiting_interview') ?? apps[0]

  await lookUp(page, target.ref)

  await expect(bell(page)).toBeVisible()
  const mine = await messagesFor(page, target.id)
  await expect(bell(page)).toHaveAttribute('data-unread', String(mine.length))

  // The header picks the name up from the same application.
  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'true')
  await expect(page.getByTestId('portal-identity-name')).toHaveText(
    target.beneficiary.fullNameEn,
  )

  // The popover carries messages and a way into the application — and nothing
  // that offers to stop being this person.
  await bell(page).click()
  await expect(page.getByTestId('portal-notification-center')).toBeVisible()
  await expect(page.getByTestId('portal-notification-forget')).toHaveCount(0)
  await expect(page.getByTestId('portal-notification-open')).toBeVisible()
  await expect(bell(page)).toHaveAttribute('data-identified', 'true')
})

test('a sent contract is delivered to the applicant and prints; a draft is not', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  // A real print dialog would freeze the session.
  await page.addInitScript(() => {
    window.print = () => {}
  })

  await gotoApp(page, '/track')

  const contracts = await readStore<Contract[]>(page, 'contracts')
  const apps = await readStore<Application[]>(page, 'applications')
  const delivered = contracts.find((c) => c.status === 'signed' || c.status === 'sent')!
  expect(delivered, 'fixtures hold no sent/signed contract').toBeTruthy()
  const owner = apps.find((a) => a.id === delivered.applicationId)!

  await lookUp(page, owner.ref)

  const card = page.getByTestId('track-contract')
  await expect(card).toBeVisible()
  await expect(card).toHaveAttribute('data-status', delivered.status)
  await expect(card).toContainText(delivered.contractNo)
  await expect(card).toContainText(delivered.status === 'signed' ? 'Signed' : 'Sent')

  await page.getByRole('button', { name: 'View contract' }).click()
  const doc = page.getByTestId('track-contract-doc')
  await expect(doc).toBeVisible()
  await expect(doc).toContainText('Project Funding Agreement')
  await expect(doc).toContainText(owner.beneficiary.fullName)
  await expect(doc).toContainText(delivered.contractNo)

  await page.getByTestId('track-contract-print').click()
  await expect(doc).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(doc).toBeHidden()

  /* ── a draft has been sent to nobody, so nobody may read it ────────────── */

  const draft = contracts.find((c) => c.status === 'draft')
  expect(draft, 'fixtures hold no draft contract').toBeTruthy()
  const draftOwner = apps.find((a) => a.id === draft!.applicationId)!

  await lookUp(page, draftOwner.ref)
  await expect(page.getByTestId('track-timeline')).toBeVisible()
  await expect(page.getByTestId('track-contract')).toHaveCount(0)

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the bell, the phone frame and the contract read correctly in Arabic RTL', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.print = () => {}
  })

  await gotoApp(page, '/track', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(bell(page)).toHaveAttribute('data-identified', 'false')

  const contracts = await readStore<Contract[]>(page, 'contracts')
  const apps = await readStore<Application[]>(page, 'applications')
  const delivered = contracts.find((c) => c.status === 'signed' || c.status === 'sent')!
  const owner = apps.find((a) => a.id === delivered.applicationId)!

  await lookUp(page, owner.ref, 'ar')

  /* ── bell, in Arabic ───────────────────────────────────────────────────── */

  const mine = await messagesFor(page, owner.id)
  await expect(bell(page)).toBeVisible()
  await expect(bell(page)).toHaveAttribute('aria-label', 'رسائلك')
  await expect(bell(page)).toHaveAttribute('data-unread', String(mine.length))

  await bell(page).click()
  const centre = page.getByTestId('portal-notification-center')
  await expect(centre).toBeVisible()
  await expect(centre).toContainText('رسائلك')
  await expect(page.getByTestId('portal-notification-item')).toHaveCount(mine.length)

  const first = page.getByTestId('portal-notification-item').first()
  const channel = await first.getAttribute('data-channel')
  await first.click()
  const body = page.getByTestId('phone-preview-body')
  await expect(body).toBeVisible()
  await expect(body).toHaveText(mine.find((n) => n.channel === channel)!.body)
  // Arabic copy, laid out right-to-left.
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('phone-preview')).toBeHidden()

  /* ── contract, in Arabic ───────────────────────────────────────────────── */

  await expect(page.getByRole('heading', { name: 'عقدك' })).toBeVisible()
  await expect(page.getByTestId('track-contract')).toContainText(
    delivered.status === 'signed' ? 'موقّع' : 'مُرسل',
  )

  await page.getByRole('button', { name: 'عرض العقد' }).click()
  const doc = page.getByTestId('track-contract-doc')
  await expect(doc).toBeVisible()
  await expect(doc).toContainText('عقد تمويل مشروع')
  await page.getByRole('button', { name: 'تصدير PDF' }).click()
  await expect(doc).toBeVisible()

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})
