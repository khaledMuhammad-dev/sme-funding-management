import { test, expect, gotoApp, pinLocale, readStore, type Lang } from './support/app'
import { completeContractAsBeneficiary, drawSignature } from './support/esign'
import type { Page } from '@playwright/test'
import type {
  Application,
  Contract,
  Disbursement,
  FollowUp,
  AppNotification,
} from '../src/data/types'

/**
 * Contracts & e-signature (module 05) and the money path (module 06).
 *
 * The programme signs its contracts centrally, from Settings; the applicant is
 * the only party who signs interactively, and she does it in her own portal.
 * This file therefore covers the admin half — generate, send, read, print,
 * archive, and the finance chain her signature releases. Her signing *dialog*
 * is covered in `esign.spec.ts`.
 *
 * Every assertion that matters is made against the live zustand store rather
 * than against the rendered row, so a green run means the demo actually moved
 * data — not that a badge happened to repaint.
 */

/** Reads the DataTable's screen-reader row counter: "Showing 1–10 of 24". */
async function totalRows(page: Page) {
  const text = await page
    .locator('[role="status"]', { hasText: /Showing|عرض/ })
    .first()
    .textContent()
  const match = /(\d+)\s*$/.exec((text ?? '').trim())
  return match ? Number(match[1]) : -1
}

async function openRowMenu(page: Page, rowText: string | RegExp) {
  const row = page.locator('tbody tr').filter({ hasText: rowText }).first()
  await row.getByRole('button', { name: /Open menu|فتح القائمة/ }).click()
}

/**
 * Waits for open toasts to retire on their own.
 *
 * The shared `clearToasts` helper deletes sonner's nodes straight out of the
 * DOM; React then commits against a tree it no longer owns and the whole app
 * unmounts (`insertBefore … is not a child of this node`).
 */
async function toastsGone(page: Page) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout: 15_000 })
}

async function selectTab(page: Page, name: string | RegExp) {
  await page.getByRole('tab', { name, exact: true }).click()
}

/* ── 1. Generation ─────────────────────────────────────────────────────────── */

test('an approved application without a contract can have one generated', async ({ page }) => {
  await gotoApp(page, '/admin/contracts')

  const before = await readStore<Contract[]>(page, 'contracts')
  const applications = await readStore<Application[]>(page, 'applications')
  const candidate = applications.find(
    (a) => a.status === 'approved' && !before.some((c) => c.applicationId === a.id),
  )
  expect(candidate, 'the demo must offer at least one approved file awaiting its contract').toBeTruthy()
  if (!candidate) return

  await page.getByRole('button', { name: /^Generate contract$/ }).click()

  const generateDialog = page.getByRole('dialog')
  await generateDialog.getByRole('radio').filter({ hasText: candidate.ref }).click()
  await generateDialog.getByRole('button', { name: /^Generate contract$/ }).click()

  // The store gained a contract for exactly this application.
  await expect
    .poll(async () => {
      const after = await readStore<Contract[]>(page, 'contracts')
      return after.filter((c) => c.applicationId === candidate.id).length
    })
    .toBe(1)

  const after = await readStore<Contract[]>(page, 'contracts')
  const created = after.find((c) => c.applicationId === candidate.id)!
  expect(after).toHaveLength(before.length + 1)
  expect(created.status).toBe('draft')
  expect(created.amount).toBe(candidate.project.requestedAmount)
  expect(created.contractNo).toMatch(/^CT-\d{4}-\d{4}$/)

  // The programme signs centrally: the signatory configured in Settings is
  // already on the contract the moment it is drawn up, and nobody re-signs it.
  expect(created.orgSignatureName, 'a new contract must carry the programme signature').toBeTruthy()
  expect(created.orgSignatureImage).toMatch(/^data:image\//)
  expect(created.orgSignedAt).toBeTruthy()
  // Hers is not on it yet — that comes back from her portal.
  expect(created.signatureName).toBeUndefined()
  expect(created.signedAt).toBeUndefined()

  // The preview opens on the generated document and reads like a real contract.
  const preview = page.getByRole('dialog')
  await expect(preview).toBeVisible()
  await expect(preview.getByText('Project Funding Agreement')).toBeVisible()
  await expect(preview.getByText(candidate.beneficiary.fullName).first()).toBeVisible()
  await expect(preview.getByText(created.contractNo)).toBeVisible()
  await expect(preview.getByText(candidate.beneficiary.nationalId)).toBeVisible()
  await expect(preview.getByText(/SAR\s*280,000/)).toBeVisible()

  // No template plumbing may leak into the rendered document.
  const documentText = (await preview.textContent()) ?? ''
  expect(documentText).not.toMatch(/\{\{|\}\}|undefined|NaN|contracts\.doc\./)

  await preview.getByRole('button', { name: 'Close' }).click()
  await expect(preview).toBeHidden()

  // …and it is listed on the contracts page.
  await expect(page.getByRole('cell', { name: created.contractNo })).toBeVisible()
  await expect(
    page.locator('tbody tr').filter({ hasText: created.contractNo }).getByText('Draft'),
  ).toBeVisible()
})

/* ── 1b. Picking which application to draw a contract for ──────────────────── */

test('the contract picker lists and searches every approved application', async ({ page }) => {
  await gotoApp(page, '/admin/contracts')

  const applications = await readStore<Application[]>(page, 'applications')
  const contracts = await readStore<Contract[]>(page, 'contracts')
  const approved = applications.filter((a) => a.status === 'approved')
  const eligible = approved.filter((a) => !contracts.some((c) => c.applicationId === a.id))
  const covered = approved.filter((a) => contracts.some((c) => c.applicationId === a.id))
  expect(covered.length, 'the demo must hold an approved file that already has a contract').toBeGreaterThan(0)

  await page.getByRole('button', { name: /^Generate contract$/ }).click()
  const dialog = page.getByRole('dialog')
  const rows = dialog.getByRole('radio')

  // Every approved file is on screen — hiding the covered ones is what made the
  // picker read as a single hardcoded choice.
  await expect(rows).toHaveCount(approved.length)
  expect(approved.length).toBeGreaterThan(eligible.length)

  // …and the covered ones say why they cannot be chosen.
  const barred = dialog.locator('[role="radio"][data-eligible="false"]')
  await expect(barred).toHaveCount(covered.length)
  await expect(barred.first()).toContainText('Contract already issued')
  await expect(barred.first()).toHaveAttribute('aria-disabled', 'true')

  // Clicking a barred row selects nothing.
  const selectedBefore = await dialog
    .locator('[role="radio"][aria-checked="true"]')
    .getAttribute('data-eligible')
  expect(selectedBefore).toBe('true')
  await barred.first().scrollIntoViewIfNeeded()
  // `force`: the row is deliberately not a hit target for selection, but it must
  // still be readable and focusable — the point is that clicking changes nothing.
  await barred.first().click({ force: true })
  await expect(dialog.locator('[role="radio"][aria-checked="true"]')).toHaveAttribute(
    'data-eligible',
    'true',
  )

  // Search: by reference…
  const search = dialog.getByTestId('contract-candidate-search')
  const target = covered[0]
  await search.fill(target.ref)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(target.ref)

  // …by beneficiary name…
  await search.fill(eligible[0].beneficiary.fullNameEn)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).toContainText(eligible[0].ref)

  // …and by project name.
  await search.fill(eligible[0].project.name)
  await expect(rows).toHaveCount(1)

  // A miss says so rather than showing an unexplained blank list.
  await search.fill('zzz-no-such-applicant')
  await expect(rows).toHaveCount(0)
  await expect(dialog.getByText(/No approved application matches/)).toBeVisible()

  // The list viewport does not resize as the results change.
  const list = dialog.getByTestId('contract-candidates')
  const empty = (await list.boundingBox())!
  await search.fill('')
  await expect(rows).toHaveCount(approved.length)
  expect((await list.boundingBox())!.height).toBe(empty.height)
})

test('the contract picker searches in Arabic', async ({ page }) => {
  await gotoApp(page, '/admin/contracts', 'ar')

  const applications = await readStore<Application[]>(page, 'applications')
  const contracts = await readStore<Contract[]>(page, 'contracts')
  const approved = applications.filter((a) => a.status === 'approved')
  const covered = approved.find((a) => contracts.some((c) => c.applicationId === a.id))!

  await page.getByRole('button', { name: 'إنشاء العقد' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('البحث في الطلبات المعتمدة')).toBeVisible()

  // The Arabic name is searchable from the Arabic screen.
  await dialog.getByTestId('contract-candidate-search').fill(covered.beneficiary.fullName)
  await expect(dialog.getByRole('radio')).toHaveCount(1)
  await expect(dialog.getByRole('radio').first()).toContainText('صدر له عقد بالفعل')

  await dialog.getByTestId('contract-candidate-search').fill('لا-يوجد')
  await expect(dialog.getByText(/لا يوجد طلب معتمد يطابق/)).toBeVisible()
})

/* ── 2. Send → hand over to the applicant ──────────────────────────────────── */

test('a draft contract is sent to the applicant, and staff cannot sign it here', async ({
  page,
}) => {
  await gotoApp(page, '/admin/contracts')

  const contracts = await readStore<Contract[]>(page, 'contracts')
  const draft = contracts.find((c) => c.status === 'draft')!
  expect(draft, 'a draft contract must exist to demo the send step').toBeTruthy()

  // Send for signature.
  await openRowMenu(page, draft.contractNo)
  await page.getByRole('menuitem', { name: 'Send for signature' }).click()
  await expect
    .poll(async () => {
      const after = await readStore<Contract[]>(page, 'contracts')
      return after.find((c) => c.id === draft.id)?.status
    })
    .toBe('sent')

  const row = page.locator('tbody tr').filter({ hasText: draft.contractNo })
  await expect(row.getByText('Sent')).toBeVisible()
  // The gating is stated, not merely implied by a missing button.
  await expect(row.getByTestId('awaiting-applicant')).toHaveText('Awaiting applicant signature')
  await toastsGone(page)

  // Signing is the applicant's alone: no staff-facing signing action exists.
  await openRowMenu(page, draft.contractNo)
  await expect(page.getByRole('menuitem', { name: 'Sign contract' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Preview contract' })).toBeVisible()
  await page.keyboard.press('Escape')

  // The document already carries the programme's signature and says, in words,
  // that it is waiting on hers.
  await openRowMenu(page, draft.contractNo)
  await page.getByRole('menuitem', { name: 'Preview contract' }).click()
  const preview = page.getByRole('dialog')
  await expect(preview.getByTestId('contract-signature-org')).toHaveAttribute(
    'data-signed',
    'true',
  )
  await expect(preview.getByAltText('Signature of the funding programme')).toBeVisible()
  await expect(preview.getByTestId('contract-signature-beneficiary')).toHaveAttribute(
    'data-signed',
    'false',
  )
  await expect(
    preview.getByTestId('contract-signature-beneficiary').getByText('Awaiting signature'),
  ).toBeVisible()
  await expect(preview.getByText('Sent to the applicant')).toBeVisible()
  // No signing affordance anywhere on the staff-facing preview.
  await expect(preview.getByRole('button', { name: 'Sign contract' })).toHaveCount(0)
})

/* ── 2b. Her signature completes it ────────────────────────────────────────── */

test("the applicant's signature completes the contract and notifies", async ({ page }) => {
  await gotoApp(page, '/admin/contracts')

  const contracts = await readStore<Contract[]>(page, 'contracts')
  const applications = await readStore<Application[]>(page, 'applications')
  const sent = contracts.find((c) => c.status === 'sent')!
  expect(sent, 'a sent contract must exist for the applicant to sign').toBeTruthy()
  const application = applications.find((a) => a.id === sent.applicationId)!

  const notificationsBefore = await readStore<AppNotification[]>(page, 'notifications')
  const signatureName = application.beneficiary.fullNameEn

  await completeContractAsBeneficiary(page, sent.id, signatureName)

  await expect
    .poll(async () => {
      const after = await readStore<Contract[]>(page, 'contracts')
      return after.find((c) => c.id === sent.id)?.status
    })
    .toBe('signed')

  const signed = (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === sent.id)!
  expect(signed.signatureName).toBe(signatureName)
  expect(signed.signedAt).toBeTruthy()
  expect(signed.signatureImage).toMatch(/^data:image\/png;base64,/)
  // The programme's side is untouched by her signing — it was already there.
  expect(signed.orgSignatureName).toBe(sent.orgSignatureName)

  // A contract_signed notification was pushed for this application.
  const notifications = await readStore<AppNotification[]>(page, 'notifications')
  expect(notifications.length).toBeGreaterThan(notificationsBefore.length)
  expect(
    notifications.some(
      (n) => n.applicationId === sent.applicationId && n.trigger === 'contract_signed',
    ),
  ).toBe(true)

  // The badge in the list follows, and the document carries both marks.
  await expect(
    page.locator('tbody tr').filter({ hasText: sent.contractNo }).getByText('Signed'),
  ).toBeVisible()

  await toastsGone(page)
  await openRowMenu(page, sent.contractNo)
  await page.getByRole('menuitem', { name: 'Preview contract' }).click()
  const preview = page.getByRole('dialog')
  await expect(preview.getByAltText('Signature of the funding programme')).toBeVisible()
  await expect(preview.getByAltText('Signature of the beneficiary')).toBeVisible()
  await expect(preview.getByText('Awaiting signature')).toHaveCount(0)
})

/* ── 3. List filters ───────────────────────────────────────────────────────── */

test('contract status tabs and the archive tab match the store', async ({ page }) => {
  await gotoApp(page, '/admin/contracts')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const contracts = await readStore<Contract[]>(page, 'contracts')
  const count = (status: Contract['status']) =>
    contracts.filter((c) => c.status === status).length

  await expect.poll(() => totalRows(page)).toBe(contracts.length)

  await selectTab(page, 'Draft')
  await expect.poll(() => totalRows(page)).toBe(count('draft'))

  await selectTab(page, 'Sent')
  await expect.poll(() => totalRows(page)).toBe(count('sent'))

  // Archive = signed contracts only.
  await selectTab(page, 'Archive')
  await expect.poll(() => totalRows(page)).toBe(count('signed'))
  const statuses = await page.locator('tbody tr td:nth-child(4)').allInnerTexts()
  expect(new Set(statuses.map((s) => s.trim()))).toEqual(new Set(['Signed']))

  // Search inside the archive narrows it further.
  const signed = contracts.find((c) => c.status === 'signed')!
  await page.getByRole('searchbox').fill(signed.contractNo)
  await expect.poll(() => totalRows(page)).toBe(1)

  await page.getByRole('searchbox').fill('')
  await selectTab(page, 'All')
  await expect.poll(() => totalRows(page)).toBe(contracts.length)
})

/* ── 4. Print / export ─────────────────────────────────────────────────────── */

test('exporting a contract to PDF fires the print pipeline without crashing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  // Never let a real print dialog open — it freezes the browser session.
  await page.addInitScript(() => {
    const w = window as unknown as { __printCalls: number }
    w.__printCalls = 0
    window.print = () => {
      w.__printCalls += 1
    }
  })

  await gotoApp(page, '/admin/contracts')
  const contracts = await readStore<Contract[]>(page, 'contracts')
  const target = contracts[0]

  await openRowMenu(page, target.contractNo)
  await page.getByRole('menuitem', { name: 'Export PDF' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Project Funding Agreement')).toBeVisible()
  await dialog.getByRole('button', { name: 'Export PDF' }).click()

  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __printCalls: number }).__printCalls),
    )
    .toBe(1)
  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

/* ── 5. Disbursement queue ─────────────────────────────────────────────────── */

test('disbursement tabs, KPIs and IBAN masking are driven by the store', async ({ page }) => {
  await gotoApp(page, '/admin/disbursements')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const disbursements = await readStore<Disbursement[]>(page, 'disbursements')
  const count = (status: Disbursement['status']) =>
    disbursements.filter((d) => d.status === status).length

  await expect.poll(() => totalRows(page)).toBe(disbursements.length)

  for (const [label, status] of [
    ['Awaiting order', 'pending'],
    ['Order issued', 'ordered'],
    ['Paid', 'paid'],
  ] as const) {
    await selectTab(page, label)
    await expect.poll(() => totalRows(page)).toBe(count(status))
  }

  await selectTab(page, 'All')

  // KPI strip is derived, not hardcoded.
  const paidTotal = disbursements
    .filter((d) => d.status === 'paid')
    .reduce((sum, d) => sum + d.amount, 0)
  const expectedTotal = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 1,
    notation: 'compact',
  }).format(paidTotal)

  const card = (label: string) =>
    page.locator('[data-morph-host]').filter({ hasText: label }).first()
  // The tile counts up on mount, so poll rather than snapshot a frame.
  await expect(card('Total disbursed')).toContainText(expectedTotal)
  await expect(card('Awaiting order')).toContainText(String(count('pending')))
  await expect(card('Orders issued')).toContainText(String(count('ordered')))

  // No full IBAN in a list view.
  const ibans = disbursements.map((d) => d.iban)
  const body = (await page.locator('table').innerText()) ?? ''
  for (const iban of ibans) expect(body).not.toContain(iban)
  await expect(page.locator('tbody tr').first()).toContainText('••')
})

/* ── 6. Payment orders ─────────────────────────────────────────────────────── */

test('a payment order can be issued for a single pending row', async ({ page }) => {
  await gotoApp(page, '/admin/disbursements')
  await selectTab(page, 'Awaiting order')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const pending = (await readStore<Disbursement[]>(page, 'disbursements')).filter(
    (d) => d.status === 'pending',
  )
  expect(pending.length, 'the queue needs a pending row to demo the order step').toBeGreaterThan(0)

  const single = pending[0]
  await openRowMenu(page, single.orderNo)
  await page.getByRole('menuitem', { name: 'Issue payment order' }).click()

  // The dialog shows the officer exactly what she is authorising.
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(single.orderNo)).toBeVisible()
  await expect(dialog.getByText('Authorised by')).toBeVisible()
  await expect(dialog.getByText(single.iban.replace(/(.{4})/g, '$1 ').trim())).toBeVisible()
  await dialog.getByRole('button', { name: 'Issue order' }).click()

  await expect
    .poll(async () => {
      const after = await readStore<Disbursement[]>(page, 'disbursements')
      return after.find((d) => d.id === single.id)?.status
    })
    .toBe('ordered')
  const ordered = (await readStore<Disbursement[]>(page, 'disbursements')).find(
    (d) => d.id === single.id,
  )!
  expect(ordered.orderedAt).toBeTruthy()

  // The row left the pending tab and shows up under Order issued.
  await selectTab(page, 'Order issued')
  await expect(
    page.locator('tbody tr').filter({ hasText: single.orderNo }).getByText('Order issued'),
  ).toBeVisible()
})

test('the applicant signature queues the file for finance and orders can be issued in bulk', async ({
  page,
}) => {
  await gotoApp(page, '/admin/contracts')

  // A contract she has signed must open a finance record, otherwise an approved
  // application could never reach the disbursement queue at all.
  const applications = await readStore<Application[]>(page, 'applications')
  const contracts = await readStore<Contract[]>(page, 'contracts')
  const candidate = applications.find(
    (a) => a.status === 'approved' && !contracts.some((c) => c.applicationId === a.id),
  )!
  const queueBefore = (await readStore<Disbursement[]>(page, 'disbursements')).filter(
    (d) => d.status === 'pending',
  )

  await page.getByRole('button', { name: /^Generate contract$/ }).click()
  const generateDialog = page.getByRole('dialog')
  await generateDialog.getByRole('radio').filter({ hasText: candidate.ref }).click()
  await generateDialog.getByRole('button', { name: /^Generate contract$/ }).click()

  const preview = page.getByRole('dialog')
  await expect(preview.getByText('Project Funding Agreement')).toBeVisible()
  await preview.getByRole('button', { name: 'Close' }).click()
  await expect(preview).toBeHidden()
  await toastsGone(page)

  const generated = (await readStore<Contract[]>(page, 'contracts')).find(
    (c) => c.applicationId === candidate.id,
  )!

  /*
    An unsent draft cannot be completed — she has never been shown it. The
    contract has to reach her before her signature can mean anything.
  */
  await openRowMenu(page, generated.contractNo)
  await page.getByRole('menuitem', { name: 'Send for signature' }).click()
  await expect
    .poll(async () =>
      (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === generated.id)?.status,
    )
    .toBe('sent')
  await toastsGone(page)

  await completeContractAsBeneficiary(page, generated.id, candidate.beneficiary.fullNameEn)

  await expect
    .poll(async () => {
      const queue = await readStore<Disbursement[]>(page, 'disbursements')
      return queue.some((d) => d.applicationId === candidate.id && d.status === 'pending')
    })
    .toBe(true)

  // Client-side navigation only: the demo database lives in memory, so a full
  // page load would throw away everything this test just did.
  await page.getByRole('link', { name: 'Disbursement', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Disbursement' })).toBeVisible()
  await selectTab(page, 'Awaiting order')

  const pending = (await readStore<Disbursement[]>(page, 'disbursements')).filter(
    (d) => d.status === 'pending',
  )
  expect(pending.length).toBe(queueBefore.length + 1)
  expect(pending.length, 'bulk needs more than one row to mean anything').toBeGreaterThan(1)
  await expect.poll(() => totalRows(page)).toBe(pending.length)

  await page.getByRole('checkbox', { name: 'Select all' }).click()
  await page.getByRole('button', { name: 'Issue orders for selected' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Selected orders')).toBeVisible()
  await dialog.getByRole('button', { name: 'Issue order' }).click()

  // Every selected id moved — in the store…
  await expect
    .poll(async () => {
      const after = await readStore<Disbursement[]>(page, 'disbursements')
      return pending.every((d) => after.find((x) => x.id === d.id)?.status === 'ordered')
    })
    .toBe(true)

  // …and on screen: nothing is awaiting an order any more.
  await expect(page.getByText('No disbursements')).toBeVisible()

  await selectTab(page, 'Order issued')
  const ordered = (await readStore<Disbursement[]>(page, 'disbursements')).filter(
    (d) => d.status === 'ordered',
  )
  await expect.poll(() => totalRows(page)).toBe(ordered.length)
  for (const row of pending) {
    await expect(page.locator('tbody tr').filter({ hasText: row.orderNo })).toHaveCount(1)
  }
})

/* ── 7. Mark paid — the end of the money path ──────────────────────────────── */

test('marking a disbursement paid disburses the application and opens follow-up', async ({
  page,
}) => {
  await gotoApp(page, '/admin/disbursements')
  await selectTab(page, 'Order issued')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const applications = await readStore<Application[]>(page, 'applications')
  const target = (await readStore<Disbursement[]>(page, 'disbursements')).find(
    (d) =>
      d.status === 'ordered' &&
      applications.find((a) => a.id === d.applicationId)?.status === 'approved',
  )!
  expect(target, 'an ordered payment on an approved file is the climax of the demo').toBeTruthy()

  const followUpsBefore = await readStore<FollowUp[]>(page, 'followUps')

  await openRowMenu(page, target.orderNo)
  await page.getByRole('menuitem', { name: 'Confirm payment' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(target.orderNo)).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirm payment' }).click()
  await expect(dialog).toBeHidden()

  await expect
    .poll(async () => {
      const after = await readStore<Disbursement[]>(page, 'disbursements')
      return after.find((d) => d.id === target.id)?.status
    })
    .toBe('paid')

  const paid = (await readStore<Disbursement[]>(page, 'disbursements')).find(
    (d) => d.id === target.id,
  )!
  expect(paid.paidAt).toBeTruthy()
  expect(paid.amount).toBeGreaterThan(0)

  // Application status flipped through the allowed approved → disbursed edge.
  const application = (await readStore<Application[]>(page, 'applications')).find(
    (a) => a.id === target.applicationId,
  )!
  expect(application.status).toBe('disbursed')

  // A `disbursed` notification went out.
  const notifications = await readStore<AppNotification[]>(page, 'notifications')
  expect(
    notifications.some(
      (n) => n.applicationId === target.applicationId && n.trigger === 'disbursed',
    ),
  ).toBe(true)

  // …and the first monitoring period was opened.
  const followUps = await readStore<FollowUp[]>(page, 'followUps')
  const created = followUps.filter((f) => f.applicationId === target.applicationId)
  expect(followUps.length).toBe(followUpsBefore.length + 1)
  expect(created).toHaveLength(1)
  expect(new Date(created[0].dueDate).getTime()).toBeGreaterThan(Date.now())
  expect(created[0].submittedAt).toBeUndefined()

  // The row moved to the Paid tab in the UI.
  await selectTab(page, 'Paid')
  await expect(
    page.locator('tbody tr').filter({ hasText: target.orderNo }).getByText('Paid'),
  ).toBeVisible()
})

/* ── 8. Dark mode ──────────────────────────────────────────────────────────── */

test('the contract document and the signature pad render in dark mode', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await pinLocale(page, 'en', 'dark')
  await page.goto('/admin/contracts')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const contracts = await readStore<Contract[]>(page, 'contracts')
  const signed = contracts.find((c) => c.status === 'signed')!

  // A completed contract shows both marks on the dark card; the marks are
  // authored in colours that survive the theme flip, unlike a black bitmap.
  await openRowMenu(page, signed.contractNo)
  await page.getByRole('menuitem', { name: 'Preview contract' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Project Funding Agreement')).toBeVisible()
  await expect(dialog.getByAltText('Signature of the funding programme')).toBeVisible()
  await expect(dialog.getByAltText('Signature of the beneficiary')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // The pad now lives where the programme configures its own signature.
  await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Authorised signatory' }).click()
  await expect(page.getByTestId('signature-pad')).toBeVisible()

  // Ink is drawn in the theme's foreground colour, so it stays visible on dark.
  await drawSignature(page)
  expect(errors, `runtime errors: ${errors.join(' | ')}`).toEqual([])
})

/* ── 9. Arabic / RTL ───────────────────────────────────────────────────────── */

test('the signing flow and the money path work in Arabic', async ({ page }) => {
  const lang: Lang = 'ar'
  await gotoApp(page, '/admin/contracts', lang)

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'العقود' })).toBeVisible()

  const contracts = await readStore<Contract[]>(page, 'contracts')
  const applications = await readStore<Application[]>(page, 'applications')
  const sent = contracts.find((c) => c.status === 'sent')!
  const application = applications.find((a) => a.id === sent.applicationId)!

  // The wait on the applicant is stated in Arabic, on the row and in the doc.
  await expect(
    page.locator('tbody tr').filter({ hasText: sent.contractNo }).getByTestId('awaiting-applicant'),
  ).toHaveText('بانتظار توقيع المستفيد')

  await openRowMenu(page, sent.contractNo)
  await expect(page.getByRole('menuitem', { name: 'توقيع العقد' })).toHaveCount(0)
  await page.getByRole('menuitem', { name: 'معاينة العقد' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('عقد تمويل مشروع')).toBeVisible()
  await expect(dialog.getByAltText('توقيع برنامج التمويل')).toBeVisible()
  await expect(
    dialog.getByTestId('contract-signature-beneficiary').getByText('بانتظار التوقيع'),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await completeContractAsBeneficiary(page, sent.id, application.beneficiary.fullName)

  await expect
    .poll(async () => {
      const after = await readStore<Contract[]>(page, 'contracts')
      return after.find((c) => c.id === sent.id)?.status
    })
    .toBe('signed')
  const signed = (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === sent.id)!
  expect(signed.signatureName).toBe(application.beneficiary.fullName)

  await expect(
    page.locator('tbody tr').filter({ hasText: sent.contractNo }).getByText('موقّع'),
  ).toBeVisible()

  // Arabic currency formatting keeps western digits and the SAR symbol.
  const expectedAmount = new Intl.NumberFormat('ar-SA-u-nu-latn', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 0,
  }).format(signed.amount)
  await expect(
    page.locator('tbody tr').filter({ hasText: sent.contractNo }).getByText(expectedAmount),
  ).toBeVisible()

  // Arabic date formatting on the signed-at column.
  const expectedDate = new Intl.DateTimeFormat('ar-SA-u-nu-latn', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(signed.signedAt!))
  await expect(
    page.locator('tbody tr').filter({ hasText: sent.contractNo }).getByText(expectedDate),
  ).toBeVisible()

  // The money path speaks Arabic too.
  await gotoApp(page, '/admin/disbursements', lang)
  await expect(page.getByRole('heading', { name: 'الصرف المالي' })).toBeVisible()
  await page.getByRole('tab', { name: 'صدر الأمر', exact: true }).click()
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const ordered = (await readStore<Disbursement[]>(page, 'disbursements')).find(
    (d) => d.status === 'ordered',
  )!
  await openRowMenu(page, ordered.orderNo)
  await page.getByRole('menuitem', { name: 'تأكيد الصرف' }).click()
  const paidDialog = page.getByRole('dialog')
  await expect(paidDialog.getByText('المستفيد')).toBeVisible()
  await paidDialog.getByRole('button', { name: 'تأكيد الصرف' }).click()

  await expect
    .poll(async () => {
      const after = await readStore<Disbursement[]>(page, 'disbursements')
      return after.find((d) => d.id === ordered.id)?.status
    })
    .toBe('paid')
})
