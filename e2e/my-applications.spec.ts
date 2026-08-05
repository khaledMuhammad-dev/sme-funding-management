import type { Page } from '@playwright/test'
import type { Application } from '../src/data/types'
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
 * "My applications" — the signed-in applicant's own list.
 *
 * The portal presents one person throughout. There is no authentication behind
 * it: which applications are his is still resolved from the references
 * `useApplicantStore` has collected, submitted or looked up on /track. That is
 * plumbing, and none of it may surface as identity management — no "is this
 * you?", no "forget", and no nav entry that appears and disappears.
 *
 * ⚠️ The demo database is in memory: `gotoApp` (and any `page.goto`) resets it to
 * the fixtures. Anything that must survive — two submissions in a row — has to
 * travel through the product's own links (`navigateTo`).
 */

const applicant = {
  fullName: 'Sara Al Otaibi',
  nationalId: '1098765432',
  phone: '0551122334',
  email: 'sara@example.com',
  region: 'Riyadh',
  city: 'Riyadh',
  iban: 'SA4420000001122334455667',
  sector: 'Crafts',
  description:
    'A small workshop producing hand-finished leather goods, adding a cutting table and a ' +
    'second sewing station to take on wholesale orders within the first year.',
  monthlyIncome: '6000',
  experienceYears: '4',
}

const nextStep = (page: Page) => page.getByRole('button', { name: 'Next' }).click()

/** Fills and submits the wizard, returning the reference it produced. */
async function submitApplication(page: Page, projectName: string, amount: string) {
  await page.getByLabel(/Full name/).fill(applicant.fullName)
  await page.getByLabel(/National ID number/).fill(applicant.nationalId)
  await page.getByLabel(/Mobile number/).fill(applicant.phone)
  await page.getByLabel(/Email address/).fill(applicant.email)
  await page.getByLabel(/^City/).fill(applicant.city)
  await page.getByLabel(/IBAN/).fill(applicant.iban)
  await page.getByLabel(/^Region/).click()
  await page.getByRole('option', { name: applicant.region, exact: true }).click()
  await nextStep(page)

  await page.getByLabel(/Project name/).fill(projectName)
  await page.getByLabel(/^Sector/).click()
  await page.getByRole('option', { name: applicant.sector, exact: true }).click()
  await page.getByLabel(/Project description/).fill(applicant.description)
  await page.getByLabel(/Requested amount/).fill(amount)
  await page.getByLabel(/Current monthly income/).fill(applicant.monthlyIncome)
  await page.getByLabel(/Years of experience/).fill(applicant.experienceYears)
  await nextStep(page)

  await attachWizardDocuments(page)
  await nextStep(page)

  await page.getByTestId('terms-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
  const checkbox = page.getByRole('checkbox')
  await expect(checkbox).toBeEnabled()
  await checkbox.click()
  await nextStep(page)

  await page.getByRole('button', { name: 'Submit application' }).click()
  await expect(page.getByTestId('submitted-ref')).toBeVisible()
  return (await page.getByTestId('submitted-ref').innerText()).trim()
}

/** Looks a reference up on /track and waits for it to resolve. */
async function lookUp(page: Page, ref: string, lang: Lang = 'en') {
  const field = page.getByLabel(lang === 'ar' ? 'رقم الطلب' : 'Reference number')
  await expect(field).toBeVisible()
  await field.fill(ref)
  await page.getByRole('button', { name: lang === 'ar' ? 'بحث' : 'Look up' }).click()
  await expect(page.getByTestId('track-ref')).toHaveText(ref)
}

const rows = (page: Page) => page.getByTestId('my-application-row')
const rowFor = (page: Page, ref: string) =>
  page.locator(`[data-testid="my-application-row"][data-ref="${ref}"]`)

/** What the persisted `applicant` key holds right now. */
async function persisted(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('applicant')
    return raw ? (JSON.parse(raw) as { state: { refs?: string[]; ref?: string | null }; version?: number }) : null
  })
}

/** Seeds the persisted store before the app boots. */
async function seedApplicant(page: Page, value: unknown) {
  await page.addInitScript((v) => {
    localStorage.setItem('applicant', JSON.stringify(v))
  }, value)
}

const thisYear = new Date().getFullYear()
const fixtureRef = (n: number) => `APP-${thisYear}-${String(n).padStart(4, '0')}`

/* ── tests ─────────────────────────────────────────────────────────────────── */

test('two applications submitted in one page load are both listed', async ({ page }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  // THE ONLY PAGE LOAD — a reload would take the first application with it.
  await pinLocale(page, 'en')
  await page.goto('/apply')
  await expect(page.getByRole('heading', { name: 'New funding application' })).toBeVisible()

  // Nothing submitted yet, and the section is still in the nav: a signed-in
  // user's own sections do not appear and disappear underneath him.
  await expect(page.locator('a[href="/my-applications"]').first()).toBeVisible()
  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'false')

  const first = await submitApplication(page, 'Sara Leather Atelier', '70000')
  await page.getByRole('button', { name: 'New application' }).click()
  const second = await submitApplication(page, 'Sara Leather Wholesale', '90000')
  expect(second).not.toBe(first)

  // The header now names him, from the newest application's beneficiary.
  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'true')
  await expect(page.getByTestId('portal-identity-name')).toHaveText(applicant.fullName)

  await navigateTo(page, '/my-applications')
  await expect(rows(page)).toHaveCount(2)

  // Newest first.
  await expect(rows(page).first()).toHaveAttribute('data-ref', second)
  await expect(rows(page).nth(1)).toHaveAttribute('data-ref', first)

  const newest = rows(page).first()
  await expect(newest).toHaveAttribute('data-resolved', 'true')
  await expect(newest).toContainText('Sara Leather Wholesale')
  await expect(newest).toContainText('New')
  await expect(newest).toContainText('90,000')
  await expect(newest.locator('time')).toHaveCount(1)

  await expect(rows(page).nth(1)).toContainText('Sara Leather Atelier')
  await expect(rows(page).nth(1)).toContainText('70,000')

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('a looked-up reference joins the list, and a row opens that application', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoApp(page, '/track')
  const apps = await readStore<Application[]>(page, 'applications')
  const [a, b] = [apps[0], apps[3]]

  await lookUp(page, a.ref)
  await lookUp(page, b.ref)

  await navigateTo(page, '/my-applications')
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page).first()).toHaveAttribute('data-ref', b.ref)

  // Clicking through opens the application that row is about, not the active one.
  await rowFor(page, a.ref).getByTestId('my-application-open').click()

  await expect(page).toHaveURL(new RegExp(`/track\\?ref=${a.ref}`))
  await expect(page.getByTestId('track-ref')).toHaveText(a.ref)

  // …and /track keeps feeding the list rather than replacing what is in it.
  await expect(page.getByTestId('track-my-applications-link')).toBeVisible()
  expect((await persisted(page))?.state.refs).toEqual([b.ref, a.ref])

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the list belongs to one signed-in applicant, with no way to stop being him', async ({
  page,
}) => {
  await seedApplicant(page, {
    state: { refs: [fixtureRef(2), fixtureRef(1)], ref: fixtureRef(2), readIds: [] },
    version: 1,
  })
  await gotoApp(page, '/my-applications')

  await expect(rows(page)).toHaveCount(2)

  // Both applications are his, and the header says whose they are.
  const identity = page.getByTestId('portal-identity')
  await expect(identity).toHaveAttribute('data-named', 'true')
  const apps = await readStore<Application[]>(page, 'applications')
  const newest = apps.find((a) => a.ref === fixtureRef(2))!
  await expect(page.getByTestId('portal-identity-name')).toHaveText(newest.beneficiary.fullNameEn)

  // None of the shared-browser plumbing is offered as a control.
  await expect(page.getByTestId('my-application-forget')).toHaveCount(0)
  await expect(page.getByTestId('my-applications-forget-all')).toHaveCount(0)
  await page.getByTestId('portal-notification-bell').click()
  await expect(page.getByTestId('portal-notification-center')).toBeVisible()
  await expect(page.getByTestId('portal-notification-forget')).toHaveCount(0)
  await page.keyboard.press('Escape')

  // …and nothing anywhere in the portal addresses him as a possible stranger.
  const copy = (await page.locator('body').innerText()).toLowerCase()
  expect(copy).not.toMatch(/not you|forget|this device|this browser/)

  // The references are still his after all of that — the store kept them.
  expect((await persisted(page))?.state.refs).toEqual([fixtureRef(2), fixtureRef(1)])
})

test('the portal sections are permanent, and empty rather than absent', async ({ page }) => {
  // Nothing submitted, nothing looked up — a freshly signed-in applicant.
  await gotoApp(page, '/')

  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'false')
  await expect(page.getByTestId('portal-identity-name')).toHaveText('My account')

  for (const href of ['/my-applications', '/my-contracts']) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible()
  }

  await navigateTo(page, '/my-applications')
  await expect(page.getByTestId('my-applications-empty')).toBeVisible()

  await navigateTo(page, '/my-contracts')
  await expect(page.getByTestId('my-contracts-empty-all')).toBeVisible()

  // The bell stays in the header throughout, saying there is nothing yet.
  await page.getByTestId('portal-notification-bell').click()
  await expect(page.getByTestId('portal-notification-anonymous')).toContainText('No messages yet')
})

test('the empty state explains how to get on the list', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await gotoApp(page, '/my-applications')

  const empty = page.getByTestId('my-applications-empty')
  await expect(empty).toBeVisible()
  await expect(empty).toContainText('You have no applications yet')
  await expect(rows(page)).toHaveCount(0)
  await expect(page.getByTestId('my-applications-forget-all')).toHaveCount(0)
  // Its own nav entry is still there behind it.
  await expect(page.locator('a[href="/my-applications"]').first()).toBeVisible()

  // Its call to action is the only way onto the list.
  await empty.getByRole('link', { name: 'Track an application' }).click()
  await expect(page).toHaveURL(/\/track$/)

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('a reference that no longer resolves renders as unavailable, not as a crash', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await seedApplicant(page, {
    state: { refs: ['APP-2999-9999', fixtureRef(1)], ref: 'APP-2999-9999', readIds: [] },
    version: 1,
  })
  await gotoApp(page, '/my-applications')

  await expect(rows(page)).toHaveCount(2)
  const stale = rows(page).first()
  await expect(stale).toHaveAttribute('data-resolved', 'false')
  await expect(stale).toContainText('APP-2999-9999')
  await expect(stale).toContainText('No longer available')
  // It is still his, and still listed — it is just not resolvable right now.
  await expect(stale.getByTestId('my-application-forget')).toHaveCount(0)

  // The header falls through to the first reference that does resolve, rather
  // than losing the applicant's name over one stale row.
  await expect(page.getByTestId('portal-identity')).toHaveAttribute('data-named', 'true')

  // The real one beside it is unaffected.
  await expect(rows(page).nth(1)).toHaveAttribute('data-resolved', 'true')

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('a browser holding the old single-reference format keeps its application', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  // Exactly what v0 of the store wrote: one `ref`, no list, no version.
  await seedApplicant(page, { state: { ref: fixtureRef(1), readIds: ['N-1'] } })
  await gotoApp(page, '/')

  // The reference is still the identity the bell works from…
  await expect(page.getByTestId('portal-notification-bell')).toHaveAttribute(
    'data-identified',
    'true',
  )

  // …and it is now the first entry of the list.
  await navigateTo(page, '/my-applications')
  await expect(rows(page)).toHaveCount(1)
  await expect(rows(page).first()).toHaveAttribute('data-ref', fixtureRef(1))
  await expect(rows(page).first()).toHaveAttribute('data-resolved', 'true')

  const stored = await persisted(page)
  expect(stored?.version).toBe(1)
  expect(stored?.state.refs).toEqual([fixtureRef(1)])
  expect(stored?.state.ref).toBe(fixtureRef(1))

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the list reads correctly in Arabic RTL and in dark mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  await seedApplicant(page, {
    state: { refs: ['APP-2999-9999', fixtureRef(1)], ref: fixtureRef(1), readIds: [] },
    version: 1,
  })
  await pinLocale(page, 'ar', 'dark')
  await page.goto('/my-applications')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await expect(page.getByRole('heading', { name: 'طلباتي', level: 1 })).toBeVisible()
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page).first()).toContainText('غير متاح حاليًا')
  await expect(page.getByTestId('my-applications-forget-all')).toHaveCount(0)

  // The Arabic header carries the Arabic name of the same signed-in applicant.
  const arApps = await readStore<Application[]>(page, 'applications')
  await expect(page.getByTestId('portal-identity-name')).toHaveText(
    arApps.find((a) => a.ref === fixtureRef(1))!.beneficiary.fullName,
  )

  // The reference itself stays LTR inside the RTL page.
  await expect(rows(page).nth(1).locator('[dir="ltr"]').first()).toHaveText(fixtureRef(1))

  // Nothing overflows the page horizontally in RTL.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  // The Arabic nav entry is present and leads here.
  await expect(page.locator('a[href="/my-applications"]').first()).toContainText('طلباتي')

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})
