import { test, expect, gotoApp, readStore, attachWizardDocuments, type Lang } from './support/app'

/**
 * Applicant portal happy path: landing → 5-step wizard → submit → track.
 *
 * Assertions go against the live demo store (`readStore`) wherever a mutation is
 * involved, so "the screen looks right" can never be mistaken for "the data changed".
 */

interface StoredApplication {
  id: string
  ref: string
  status: string
  beneficiary: { fullName: string; region: string; city: string }
  project: { name: string; requestedAmount: number }
}

interface StoredNotification {
  id: string
  applicationId: string
  trigger: string
  body: string
  bodyEn: string
}

const applicant = {
  fullName: 'Nora Al Qahtani',
  nationalId: '1098765432',
  phone: '0551234567',
  email: 'nora@example.com',
  region: 'Riyadh',
  regionAr: 'الرياض',
  city: 'Riyadh',
  iban: 'SA4420000001234567891234',
  projectName: 'Nora Artisan Bakery',
  sector: 'Food',
  sectorAr: 'أغذية',
  description:
    'A small artisan bakery producing fresh sourdough bread and pastries for local cafes, ' +
    'with a plan to add a second oven and hire two more bakers within the first year.',
  requestedAmount: '80000',
  monthlyIncome: '9000',
  experienceYears: '4',
}

/** Step 1 — personal details. */
async function fillPersonalStep(page: import('@playwright/test').Page, lang: Lang = 'en') {
  const labels =
    lang === 'ar'
      ? {
          fullName: /الاسم الرباعي/,
          nationalId: /رقم الهوية/,
          phone: /رقم الجوال/,
          email: /البريد الإلكتروني/,
          region: /المنطقة/,
          city: /المدينة/,
          iban: /رقم الآيبان/,
        }
      : {
          fullName: /Full name/,
          nationalId: /National ID number/,
          phone: /Mobile number/,
          email: /Email address/,
          region: /^Region/,
          city: /^City/,
          iban: /IBAN/,
        }

  await page.getByLabel(labels.fullName).fill(applicant.fullName)
  await page.getByLabel(labels.nationalId).fill(applicant.nationalId)
  await page.getByLabel(labels.phone).fill(applicant.phone)
  await page.getByLabel(labels.email).fill(applicant.email)
  await page.getByLabel(labels.city).fill(applicant.city)
  await page.getByLabel(labels.iban).fill(applicant.iban)

  await page.getByLabel(labels.region).click()
  await page
    .getByRole('option', { name: lang === 'ar' ? applicant.regionAr : applicant.region, exact: true })
    .click()
}

/** Step 2 — project details. */
async function fillProjectStep(page: import('@playwright/test').Page, lang: Lang = 'en') {
  const labels =
    lang === 'ar'
      ? {
          name: /اسم المشروع/,
          sector: /قطاع المشروع/,
          description: /وصف المشروع/,
          amount: /المبلغ المطلوب/,
          income: /الدخل الشهري/,
          experience: /سنوات الخبرة/,
        }
      : {
          name: /Project name/,
          sector: /^Sector/,
          description: /Project description/,
          amount: /Requested amount/,
          income: /Current monthly income/,
          experience: /Years of experience/,
        }

  await page.getByLabel(labels.name).fill(applicant.projectName)
  await page.getByLabel(labels.sector).click()
  await page
    .getByRole('option', { name: lang === 'ar' ? applicant.sectorAr : applicant.sector, exact: true })
    .click()
  await page.getByLabel(labels.description).fill(applicant.description)
  await page.getByLabel(labels.amount).fill(applicant.requestedAmount)
  await page.getByLabel(labels.income).fill(applicant.monthlyIncome)
  await page.getByLabel(labels.experience).fill(applicant.experienceYears)
}

/** Step 3 — the three required document kinds. */
async function fillDocumentsStep(page: import('@playwright/test').Page) {
  // The upload control is a real file input — hand it real bytes.
  await attachWizardDocuments(page)
}

/** Step 4 — read to the end, then accept. */
async function acceptTerms(page: import('@playwright/test').Page) {
  const scroller = page.getByTestId('terms-scroll')
  await scroller.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const checkbox = page.getByRole('checkbox')
  await expect(checkbox).toBeEnabled()
  await checkbox.click()
  await expect(checkbox).toBeChecked()
}

const next = (page: import('@playwright/test').Page, lang: Lang = 'en') =>
  page.getByRole('button', { name: lang === 'ar' ? 'التالي' : 'Next' }).click()

test('landing renders the programme story and its CTA opens the wizard', async ({ page }) => {
  await gotoApp(page, '/')

  await expect(
    page.getByRole('heading', {
      name: 'Funding that starts with your idea and ends with a running business',
      level: 1,
    }),
  ).toBeVisible()

  // Journey section: six ordered stages.
  await expect(page.getByRole('heading', { name: 'The journey', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Automated screening' })).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Disbursement & follow-up' })).toHaveCount(1)

  // Eligibility cards.
  await expect(page.getByRole('heading', { name: 'Who can apply', level: 2 })).toBeVisible()
  for (const card of ['Saudi national', '21 years or older', 'Complete documents']) {
    await expect(page.getByRole('heading', { name: card })).toBeVisible()
  }

  await page.getByRole('link', { name: 'Start your application' }).first().click()
  await expect(page).toHaveURL(/\/apply$/)
  await expect(page.getByRole('heading', { name: 'New funding application' })).toBeVisible()
})

test('an empty first step reports localised errors and does not advance', async ({ page }) => {
  await gotoApp(page, '/apply')

  await next(page)

  await expect(page.getByText('Must be at least 6 characters')).toBeVisible()
  await expect(
    page.getByText('National ID must be 10 digits starting with 1 or 2'),
  ).toBeVisible()
  await expect(page.getByText('Mobile number must start with 05 and be 10 digits')).toBeVisible()
  await expect(page.getByText('Enter a valid email address')).toBeVisible()
  await expect(page.getByText('IBAN must start with SA and be 24 characters')).toBeVisible()

  // Still on step 1.
  await expect(page.getByLabel(/Full name/)).toBeVisible()
  await expect(page.getByLabel(/Project name/)).toHaveCount(0)
})

test('a draft survives moving forward and back between steps', async ({ page }) => {
  await gotoApp(page, '/apply')

  await fillPersonalStep(page)
  await next(page)
  await expect(page.getByLabel(/Project name/)).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()

  await expect(page.getByLabel(/Full name/)).toHaveValue(applicant.fullName)
  await expect(page.getByLabel(/National ID number/)).toHaveValue(applicant.nationalId)
  await expect(page.getByLabel(/Email address/)).toHaveValue(applicant.email)
  await expect(page.getByLabel(/IBAN/)).toHaveValue(applicant.iban)
  await expect(page.getByLabel(/^Region/)).toContainText(applicant.region)

  // …and a refresh mid-wizard does not cost the applicant her answers.
  await page.reload()
  await expect(page.getByLabel(/Full name/)).toHaveValue(applicant.fullName)
  await expect(page.getByLabel(/^Region/)).toContainText(applicant.region)
})

test('the full wizard submits, stores the application and notifies the applicant', async ({
  page,
}) => {
  await gotoApp(page, '/apply')
  const before = await readStore<StoredApplication[]>(page, 'applications')

  await fillPersonalStep(page)
  await next(page)

  await fillProjectStep(page)
  await next(page)

  await fillDocumentsStep(page)
  await next(page)

  await acceptTerms(page)
  await next(page)

  // Review shows what will be submitted.
  await expect(page.getByRole('heading', { name: 'Review your details before submitting' })).toBeVisible()
  await expect(page.getByText(applicant.fullName)).toBeVisible()
  await expect(page.getByText(applicant.projectName)).toBeVisible()

  await page.getByRole('button', { name: 'Submit application' }).click()

  // Success screen with the reference number.
  await expect(page.getByRole('heading', { name: 'Your application has been received' })).toBeVisible()
  const ref = (await page.getByTestId('submitted-ref').innerText()).trim()
  expect(ref).toMatch(/^APP-\d{4}-\d{4}$/)

  // A submitted draft is not left lying around for the next applicant.
  const draft = await page.evaluate(() => localStorage.getItem('apply-draft'))
  expect(draft && JSON.parse(draft).state.personal.fullName).toBe('')

  // The store really grew, with the right ref and the right initial status.
  const after = await readStore<StoredApplication[]>(page, 'applications')
  expect(after.length).toBe(before.length + 1)
  const created = after.find((a) => a.ref === ref)
  expect(created, `no application with ref ${ref} in the store`).toBeTruthy()
  expect(created!.status).toBe('new')
  expect(created!.beneficiary.fullName).toBe(applicant.fullName)
  expect(created!.project.requestedAmount).toBe(Number(applicant.requestedAmount))

  // …and the `received` notification was fired for it.
  const notifications = await readStore<StoredNotification[]>(page, 'notifications')
  const received = notifications.find(
    (n) => n.applicationId === created!.id && n.trigger === 'received',
  )
  expect(received, 'no `received` notification for the new application').toBeTruthy()
  expect(received!.bodyEn).toContain(ref)

  // The applicant can go straight to tracking it.
  await page.getByRole('link', { name: 'Track it now' }).click()
  await expect(page).toHaveURL(new RegExp(`/track\\?ref=${ref}`))
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
  await expect(page.getByTestId('track-applicant')).toContainText(applicant.fullName)
})

test('tracking a seeded reference shows the stepper, details, timeline and messages', async ({
  page,
}) => {
  await gotoApp(page, '/track')

  const apps = await readStore<StoredApplication[]>(page, 'applications')
  const target = apps.find((a) => a.status === 'awaiting_interview') ?? apps[0]

  await page.getByLabel('Reference number').fill(target.ref)
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page.getByTestId('track-ref')).toHaveText(target.ref)
  await expect(page.getByTestId('track-applicant')).toContainText(target.beneficiary.fullName)
  await expect(page.getByText(target.project.name).first()).toBeVisible()

  // Status stepper: every happy-path stage, current one marked.
  const stepper = page.getByTestId('track-stepper')
  await expect(stepper.getByRole('listitem')).toHaveCount(6)
  await expect(stepper.locator('[data-current="true"]')).toHaveCount(1)
  await expect(stepper.locator('[data-current="true"]')).toContainText('Awaiting interview')

  // Timeline of stages.
  await expect(page.getByRole('heading', { name: 'Stage history' })).toBeVisible()
  await expect(page.getByTestId('track-timeline').getByRole('listitem').first()).toBeVisible()

  // F9.4 — the beneficiary sees her own notification history.
  const notifications = await readStore<StoredNotification[]>(page, 'notifications')
  const mine = notifications.filter((n) => n.applicationId === target.id)
  expect(mine.length).toBeGreaterThan(0)

  const list = page.getByTestId('track-notifications')
  await expect(page.getByRole('heading', { name: 'My messages' })).toBeVisible()
  await expect(list.getByRole('listitem')).toHaveCount(mine.length)
  await expect(list).toContainText(target.ref)
})

test('an unknown reference shows the empty state instead of a spinner or a crash', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await gotoApp(page, '/track')
  await page.getByLabel('Reference number').fill('APP-1999-9999')
  await page.getByRole('button', { name: 'Look up' }).click()

  await expect(page.getByText('No application found with that reference')).toBeVisible()
  await expect(
    page.getByText('Check the number exactly as it appeared in your confirmation message.'),
  ).toBeVisible()
  await expect(page.getByTestId('track-ref')).toHaveCount(0)
  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the wizard works end to end in Arabic with RTL layout', async ({ page }) => {
  await gotoApp(page, '/apply', 'ar')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'طلب تمويل جديد' })).toBeVisible()

  await fillPersonalStep(page, 'ar')
  await next(page, 'ar')

  await expect(page.getByLabel(/اسم المشروع/)).toBeVisible()
  await fillProjectStep(page, 'ar')
  await next(page, 'ar')

  await fillDocumentsStep(page)
  await next(page, 'ar')

  await expect(page.getByRole('heading', { name: 'الشروط والأحكام' })).toBeVisible()
  await acceptTerms(page)
  await next(page, 'ar')

  await expect(page.getByRole('heading', { name: 'راجع بياناتك قبل الإرسال' })).toBeVisible()
  await page.getByRole('button', { name: 'إرسال الطلب' }).click()

  await expect(page.getByRole('heading', { name: 'تم استلام طلبك بنجاح' })).toBeVisible()
  const ref = (await page.getByTestId('submitted-ref').innerText()).trim()
  expect(ref).toMatch(/^APP-\d{4}-\d{4}$/)

  const apps = await readStore<StoredApplication[]>(page, 'applications')
  const created = apps.find((a) => a.ref === ref)
  expect(created?.status).toBe('new')

  // Arabic tracking view, still RTL.
  await page.getByRole('link', { name: 'تتبّع الطلب الآن' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
  await expect(page.getByTestId('track-notifications')).toContainText('تم استلام طلبك')
})
