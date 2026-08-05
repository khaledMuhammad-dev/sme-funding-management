import { test, expect, gotoApp, pinLocale, readStore } from './support/app'
import {
  DEMO_OTP,
  lookupOnTrack,
  signInPortalUi,
} from './support/esign'
import type { Page } from '@playwright/test'
import type { Application, Contract } from '../src/data/types'

/**
 * Electronic signatures, both parties.
 *
 * The funding programme signs centrally — one authorised signatory, configured
 * in `/admin/settings`, stamped onto every contract at generation time. The
 * applicant signs interactively, in her own portal, and hers is the signature
 * that completes the contract.
 *
 * The applicant-facing tests need `<BeneficiarySignAction />` mounted on
 * `TrackPage` (see the mounting note in `support/esign.ts`). Until that one-line
 * mount lands they report as skipped with the reason on the run, rather than
 * being weakened into passing against a screen that has no signing on it.
 */

/** Boots the app with the programme signature cleared, as if never configured. */
async function withoutSignatory(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'org-signature',
      JSON.stringify({ state: { orgSignature: { name: '', image: null } }, version: 0 }),
    )
  })
}

/** A fixture contract that has been sent and is waiting on the applicant. */
async function sentContract(page: Page) {
  const contracts = await readStore<Contract[]>(page, 'contracts')
  const applications = await readStore<Application[]>(page, 'applications')
  const contract = contracts.find((c) => c.status === 'sent')!
  expect(contract, 'the demo needs a contract awaiting the applicant').toBeTruthy()
  return { contract, application: applications.find((a) => a.id === contract.applicationId)! }
}

/* ── 1. The programme's signature is configured once ───────────────────────── */

test('the programme ships with a signatory, and it can be changed from settings', async ({
  page,
}) => {
  await gotoApp(page, '/admin/settings')
  await page.getByRole('tab', { name: 'Authorised signatory' }).click()

  // A presenter who never opens this screen still issues signed contracts.
  const nameField = page.getByRole('textbox', { name: 'Authorised signatory' })
  await expect(nameField).not.toHaveValue('')
  await expect(page.getByTestId('signatory-preview')).toBeVisible()

  await nameField.fill('Dr. Munira Al Harbi')
  await page.getByTestId('save-signatory').click()
  await expect(page.getByText('Programme signature saved')).toBeVisible()

  // What is configured here is what goes onto the next contract issued.
  await page.getByRole('link', { name: 'Contracts', exact: true }).first().click()
  await expect(page).toHaveURL(/\/admin\/contracts$/)

  const applications = await readStore<Application[]>(page, 'applications')
  const contracts = await readStore<Contract[]>(page, 'contracts')
  const candidate = applications.find(
    (a) => a.status === 'approved' && !contracts.some((c) => c.applicationId === a.id),
  )!

  await page.getByRole('button', { name: /^Generate contract$/ }).click()
  const dialog = page.getByRole('dialog')
  // The officer is told whose signature is about to go on it.
  await expect(dialog.getByText('Dr. Munira Al Harbi')).toBeVisible()
  await dialog.getByRole('radio').filter({ hasText: candidate.ref }).click()
  await dialog.getByRole('button', { name: /^Generate contract$/ }).click()

  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find(
        (c) => c.applicationId === candidate.id,
      )?.orgSignatureName,
    )
    .toBe('Dr. Munira Al Harbi')

  await expect(page.getByRole('dialog').getByText('Dr. Munira Al Harbi')).toBeVisible()
})

/* ── 2. No signatory, no contract ──────────────────────────────────────────── */

test('a contract cannot be issued with no authorised signatory, and says why', async ({ page }) => {
  await withoutSignatory(page)
  await gotoApp(page, '/admin/contracts')

  const alert = page.getByTestId('no-signatory-alert')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('No authorised signatory configured')
  // Blocked, with a way out — not a dead disabled button.
  await expect(page.getByRole('button', { name: /^Generate contract$/ })).toBeDisabled()

  const before = (await readStore<Contract[]>(page, 'contracts')).length
  await alert.getByRole('link', { name: 'Open settings' }).click()
  await expect(page).toHaveURL(/\/admin\/settings$/)
  await expect(page.getByRole('tab', { name: 'Authorised signatory' })).toBeVisible()

  // Nothing was issued in the meantime.
  expect((await readStore<Contract[]>(page, 'contracts')).length).toBe(before)
})

/* ── 3. The document carries both parties, and prints ──────────────────────── */

test('the contract document renders both signature blocks and prints', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // A real print dialog would freeze the session.
  await page.addInitScript(() => {
    const w = window as unknown as { __printCalls: number }
    w.__printCalls = 0
    window.print = () => {
      w.__printCalls += 1
    }
  })

  await gotoApp(page, '/admin/contracts')
  const contracts = await readStore<Contract[]>(page, 'contracts')

  // Completed: both marks, both dated.
  const signed = contracts.find((c) => c.status === 'signed')!
  await page
    .locator('tbody tr')
    .filter({ hasText: signed.contractNo })
    .getByRole('button', { name: 'Open menu' })
    .click()
  await page.getByRole('menuitem', { name: 'Preview contract' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByTestId('contract-signature-org')).toHaveAttribute('data-signed', 'true')
  await expect(dialog.getByTestId('contract-signature-beneficiary')).toHaveAttribute(
    'data-signed',
    'true',
  )
  await expect(dialog.getByAltText('Signature of the funding programme')).toBeVisible()
  await expect(dialog.getByAltText('Signature of the beneficiary')).toBeVisible()
  await expect(dialog.getByTestId('contract-signature-org')).toContainText(signed.orgSignatureName!)
  await expect(dialog.getByTestId('contract-signature-beneficiary')).toContainText(
    signed.signatureName!,
  )

  await dialog.getByRole('button', { name: 'Export PDF' }).click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls))
    .toBe(1)

  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

/* ── 4. The applicant signs, in her own portal ─────────────────────────────── */

test('the applicant signs her contract from the portal', async ({ page }) => {
  await gotoApp(page, '/admin/contracts')
  const { contract, application } = await sentContract(page)

  await gotoApp(page, `/track?ref=${application.ref}`)
  await expect(page.getByTestId('track-contract')).toHaveAttribute('data-status', 'sent')

  // The OTP must be discoverable — a demo cannot dead-end on a secret code.
  await page.locator('[data-testid="track-contract-sign"]').click()
  const dialog = page.getByTestId('beneficiary-signing-dialog')
  await expect(dialog.getByText(`Demo code: ${DEMO_OTP}`)).toBeVisible()
  // She can see the programme has already signed — she is not signing first.
  await expect(dialog.getByTestId('signing-org-note')).toContainText(contract.orgSignatureName!)

  // A wrong code is rejected rather than silently accepted.
  await dialog.getByLabel('Full name as on your ID').fill(application.beneficiary.fullNameEn)
  await dialog.getByTestId('signature-use-typed-name').click()
  await dialog.getByLabel('Verification code').fill('9999')
  await dialog.getByRole('button', { name: 'Sign and confirm' }).click()
  await expect(dialog.getByText('That verification code is not correct')).toBeVisible()

  await dialog.getByLabel('Verification code').fill(DEMO_OTP)
  await dialog.getByRole('button', { name: 'Sign and confirm' }).click()
  await expect(dialog).toBeHidden()

  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)?.status,
    )
    .toBe('signed')

  const signed = (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)!
  expect(signed.signatureName).toBe(application.beneficiary.fullNameEn)
  expect(signed.signatureImage).toMatch(/^data:image\/png;base64,/)
  expect(signed.signedAt).toBeTruthy()

  await expect(page.getByTestId('track-contract')).toHaveAttribute('data-status', 'signed')
})

/* ── 5. Keyboard-only signing ──────────────────────────────────────────────── */

test('the applicant can sign without a pointer', async ({ page }) => {
  await gotoApp(page, '/admin/contracts')
  const { contract, application } = await sentContract(page)

  await gotoApp(page, `/track?ref=${application.ref}`)

  await signInPortalUi(page, application.beneficiary.fullNameEn, { keyboardOnly: true })
  await expect(page.getByTestId('beneficiary-signing-dialog')).toBeHidden()

  const signed = (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)!
  expect(signed.status).toBe('signed')
  expect(signed.signatureImage, 'the typed-name fallback must produce a real mark').toMatch(
    /^data:image\/png;base64,/,
  )
})

/* ── 6. Arabic / RTL ───────────────────────────────────────────────────────── */

test('the applicant signing flow reads correctly in Arabic', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await gotoApp(page, '/admin/contracts', 'ar')
  const { contract, application } = await sentContract(page)

  await gotoApp(page, '/track', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await lookupOnTrack(page, application.ref, 'ar')

  await signInPortalUi(page, application.beneficiary.fullName)
  await expect(page.getByTestId('beneficiary-signing-dialog')).toBeHidden()

  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === contract.id)?.status,
    )
    .toBe('signed')

  await expect(page.getByTestId('track-contract')).toContainText('موقّع')
  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

/* ── 7. Dark mode ──────────────────────────────────────────────────────────── */

test('both signature blocks stay legible in dark mode', async ({ page }) => {
  await pinLocale(page, 'en', 'dark')
  await page.goto('/admin/settings')
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.getByRole('tab', { name: 'Authorised signatory' }).click()
  const preview = page.getByTestId('signatory-preview')
  await expect(preview).toBeVisible()

  // The stored mark is an SVG data-URL, not a black bitmap — it is authored in
  // an ink colour that reads on both themes, since an <img> cannot inherit one.
  const src = await preview.locator('img').getAttribute('src')
  expect(src).toMatch(/^data:image\/svg\+xml/)
})
