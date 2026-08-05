import type { Locator, Page } from '@playwright/test'
import type { Application, Contract } from '../src/data/types'
import { test, expect, gotoApp, pinLocale, navigateTo, readStore } from './support/app'
import { DEMO_OTP } from './support/esign'

/**
 * "My contracts" — every contract issued across the signed-in applicant's
 * applications, in one place.
 *
 * `/track` only ever shows one application's contract, which leaves an applicant
 * with several files no way to see what is waiting on his signature. This screen
 * is that list: three tabs (awaiting signature / signed / all) with counts read
 * off the data, signing reachable straight from a row, and drafts — which have
 * been sent to nobody — never visible at all.
 *
 * ⚠️ The demo database is in memory: every `gotoApp` resets it to the fixtures.
 * Seeding runs through `addInitScript`, so the seed survives the reload while
 * the data underneath it is always the same fixtures.
 */

/** Seeds the persisted applicant store before the app boots. */
async function seedApplicant(page: Page, refs: string[]) {
  await page.addInitScript((value) => {
    localStorage.setItem('applicant', JSON.stringify(value))
  }, { state: { refs, ref: refs[0] ?? null, readIds: [] }, version: 1 })
}

interface Fixtures {
  contracts: Contract[]
  applications: Application[]
  refFor: (contract: Contract) => string
}

/** Reads the fixture contracts once, from a throwaway load. */
async function fixtures(page: Page): Promise<Fixtures> {
  await gotoApp(page, '/')
  const contracts = await readStore<Contract[]>(page, 'contracts')
  const applications = await readStore<Application[]>(page, 'applications')
  return {
    contracts,
    applications,
    refFor: (contract) => applications.find((a) => a.id === contract.applicationId)!.ref,
  }
}

const rows = (page: Page) => page.getByTestId('my-contract-row')
const rowFor = (page: Page, contractNo: string) =>
  page.locator(`[data-testid="my-contract-row"][data-contract="${contractNo}"]`)

async function openTab(page: Page, name: string | RegExp) {
  await page.getByRole('tab', { name }).click()
}

/** Signs one row's contract through the applicant's own dialog. */
async function signRow(page: Page, row: Locator, signatureName: string) {
  await row.getByTestId('track-contract-sign').click()
  const dialog = page.getByTestId('beneficiary-signing-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Full name as on your ID').fill(signatureName)
  await dialog.getByTestId('signature-use-typed-name').click()
  await dialog.getByLabel('Verification code').fill(DEMO_OTP)
  await dialog.getByRole('button', { name: 'Sign and confirm' }).click()
  await expect(dialog).toBeHidden()
}

/* ── tests ─────────────────────────────────────────────────────────────────── */

test('the tabs count what the applicant actually has, and drafts are not among it', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  const { contracts, refFor } = await fixtures(page)
  const sent = contracts.filter((c) => c.status === 'sent')
  const signed = contracts.filter((c) => c.status === 'signed')
  const drafts = contracts.filter((c) => c.status === 'draft')
  expect(sent.length, 'the demo needs a contract awaiting signature').toBeGreaterThan(0)
  expect(signed.length, 'the demo needs a signed contract').toBeGreaterThan(0)
  expect(drafts.length, 'the demo needs a draft contract').toBeGreaterThan(0)

  // Every application that has a contract of any kind, drafts included — the
  // page must drop those itself rather than never being handed them.
  await seedApplicant(page, [...new Set(contracts.map(refFor))])
  await gotoApp(page, '/my-contracts')

  // Counts come off the data, never a literal.
  await expect(page.getByTestId('my-contracts-count-awaiting')).toHaveText(String(sent.length))
  await expect(page.getByTestId('my-contracts-count-signed')).toHaveText(String(signed.length))
  await expect(page.getByTestId('my-contracts-count-all')).toHaveText(
    String(sent.length + signed.length),
  )

  // It opens on what needs him.
  await expect(rows(page)).toHaveCount(sent.length)
  for (const contract of sent) {
    await expect(rowFor(page, contract.contractNo)).toHaveAttribute('data-status', 'sent')
  }

  await openTab(page, 'Signed')
  await expect(rows(page)).toHaveCount(signed.length)

  await openTab(page, 'All')
  await expect(rows(page)).toHaveCount(sent.length + signed.length)

  // A draft has been sent to nobody, so it is on none of the three tabs.
  for (const draft of drafts) {
    await expect(rowFor(page, draft.contractNo)).toHaveCount(0)
  }

  // A row carries what identifies the contract: number, project, reference,
  // amount, when it was sent, and its status.
  const example = sent[0]
  const application = (await readStore<Application[]>(page, 'applications')).find(
    (a) => a.id === example.applicationId,
  )!
  const row = rowFor(page, example.contractNo)
  await expect(row).toContainText(example.contractNo)
  await expect(row).toContainText(application.project.name)
  await expect(row).toContainText(application.ref)
  await expect(row).toContainText('Sent')
  await expect(row.locator('time')).not.toHaveCount(0)

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('a contract awaiting signature is signed from the list and moves to Signed', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  const { contracts, applications, refFor } = await fixtures(page)
  const target = contracts.find((c) => c.status === 'sent')!
  const application = applications.find((a) => a.id === target.applicationId)!
  const alreadySigned = contracts.filter((c) => c.status === 'signed').length

  // Only his one application, so the list is unambiguous about what is signed.
  await seedApplicant(page, [refFor(target)])
  await gotoApp(page, '/my-contracts')

  await expect(rows(page)).toHaveCount(1)
  const row = rowFor(page, target.contractNo)
  await expect(row).toHaveAttribute('data-status', 'sent')

  await signRow(page, row, application.beneficiary.fullNameEn)

  // The signature reached the demo database, with his mark on it.
  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === target.id)?.status,
    )
    .toBe('signed')
  const stored = (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === target.id)!
  expect(stored.signatureName).toBe(application.beneficiary.fullNameEn)
  expect(stored.signedAt).toBeTruthy()

  // …and the list it was signed from has moved it across, without a reload.
  await expect(page.getByTestId('my-contracts-count-awaiting')).toHaveText('0')
  await expect(page.getByTestId('my-contracts-empty-awaiting')).toBeVisible()

  await openTab(page, 'Signed')
  await expect(rowFor(page, target.contractNo)).toHaveAttribute('data-status', 'signed')
  await expect(rowFor(page, target.contractNo).getByTestId('track-contract-sign')).toHaveCount(0)

  // The rest of the demo agrees — nothing about the count was local to this page.
  const nowSigned = (await readStore<Contract[]>(page, 'contracts')).filter(
    (c) => c.status === 'signed',
  )
  expect(nowSigned.length).toBe(alreadySigned + 1)

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('a contract can be read and printed from the list', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as unknown as { __printCalls: number }).__printCalls = 0
    window.print = () => {
      ;(window as unknown as { __printCalls: number }).__printCalls += 1
    }
  })

  const { contracts, applications, refFor } = await fixtures(page)
  const target = contracts.find((c) => c.status === 'signed')!
  const application = applications.find((a) => a.id === target.applicationId)!

  await seedApplicant(page, [refFor(target)])
  await gotoApp(page, '/my-contracts')

  await openTab(page, 'Signed')
  await rowFor(page, target.contractNo).getByTestId('my-contract-view').click()

  const doc = page.getByTestId('my-contracts-doc')
  await expect(doc).toBeVisible()
  await expect(doc).toContainText('Project Funding Agreement')
  await expect(doc).toContainText(target.contractNo)
  await expect(doc).toContainText(application.beneficiary.fullName)

  await page.getByTestId('my-contracts-print').click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls))
    .toBe(1)

  await page.keyboard.press('Escape')
  await expect(doc).toBeHidden()
})

test('each tab has its own empty state, and none of them is a blank screen', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  /* ── nothing at all ────────────────────────────────────────────────────── */

  await gotoApp(page, '/my-contracts')
  const nothing = page.getByTestId('my-contracts-empty-all')
  await expect(nothing).toBeVisible()
  await expect(nothing).toContainText('You have no contracts yet')
  await expect(page.getByTestId('my-contracts-count-all')).toHaveText('0')

  // Its call to action leads back into the portal rather than dead-ending.
  await nothing.getByRole('link', { name: 'See my applications' }).click()
  await expect(page).toHaveURL(/\/my-applications$/)

  /* ── contracts, but none of them awaiting him ──────────────────────────── */

  const { contracts, refFor } = await fixtures(page)
  const signed = contracts.find((c) => c.status === 'signed')!
  await seedApplicant(page, [refFor(signed)])
  await gotoApp(page, '/my-contracts')

  // With nothing awaiting, it opens on All rather than on an empty tab.
  await expect(rows(page)).toHaveCount(1)
  await openTab(page, 'Awaiting signature')
  const noneAwaiting = page.getByTestId('my-contracts-empty-awaiting')
  await expect(noneAwaiting).toBeVisible()
  await expect(noneAwaiting).toContainText('Nothing awaiting your signature')

  /* ── and the other way round ───────────────────────────────────────────── */

  const sent = contracts.find((c) => c.status === 'sent')!
  await seedApplicant(page, [refFor(sent)])
  await gotoApp(page, '/my-contracts')

  await openTab(page, 'Signed')
  await expect(page.getByTestId('my-contracts-empty-signed')).toContainText(
    'You have not signed a contract yet',
  )

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

test('the list reads correctly in Arabic RTL and in dark mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  const { contracts, applications, refFor } = await fixtures(page)
  const sent = contracts.find((c) => c.status === 'sent')!
  const signed = contracts.find((c) => c.status === 'signed')!
  const application = applications.find((a) => a.id === sent.applicationId)!

  await seedApplicant(page, [...new Set([sent, signed].map(refFor))])
  await pinLocale(page, 'ar', 'dark')
  await page.goto('/my-contracts')

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await expect(page.getByRole('heading', { name: 'عقودي', level: 1 })).toBeVisible()
  await expect(page.getByRole('tab', { name: /بانتظار التوقيع/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /موقّعة/ })).toBeVisible()

  await expect(rowFor(page, sent.contractNo)).toContainText('مُرسل')

  // The contract number stays LTR inside the RTL page.
  await expect(rowFor(page, sent.contractNo).locator('[dir="ltr"]').first()).toHaveText(
    sent.contractNo,
  )
  await expect(rowFor(page, sent.contractNo)).toContainText(application.ref)

  // Nothing overflows the page horizontally in RTL.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  // The Arabic nav entry is present and leads here.
  await expect(page.locator('a[href="/my-contracts"]').first()).toContainText('عقودي')

  // And it is reachable from the applications list without a reload.
  await navigateTo(page, '/my-applications')
  await navigateTo(page, '/my-contracts')
  await expect(page.getByRole('heading', { name: 'عقودي', level: 1 })).toBeVisible()

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})
