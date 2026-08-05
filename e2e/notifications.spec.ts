import { test, expect, gotoApp, navigateTo, readStore, clearToasts, attachWizardDocuments } from './support/app'
import { completeContractAsBeneficiary } from './support/esign'
import type { Page } from '@playwright/test'
import type {
  Application,
  AppNotification,
  Contract,
  Disbursement,
  FollowUp,
  NotificationChannel,
  NotificationTrigger,
} from '../src/data/types'

/**
 * Module 09 — notifications & automation.
 *
 * The demo's whole automation story is "every lifecycle event sends the right
 * message on the right channels". So every trigger is driven through the real
 * UI and then verified against the live store: the channel mix, the recipient,
 * and above all the rendered body, because an unresolved `{{name}}` on the
 * client's screen is the most expensive failure this module can have.
 */

/* ── the matrix from docs/map/modules/09-notifications.md ──────────────────── */

const EXPECTED_CHANNELS: Record<NotificationTrigger, NotificationChannel[]> = {
  received: ['sms', 'email'],
  incomplete: ['sms', 'whatsapp'],
  interview_scheduled: ['sms', 'whatsapp', 'email'],
  approved: ['sms', 'email'],
  rejected: ['sms', 'email'],
  contract_signed: ['email'],
  disbursed: ['sms', 'whatsapp'],
  follow_up_due: ['whatsapp'],
}

const TRIGGERS = Object.keys(EXPECTED_CHANNELS) as NotificationTrigger[]

/** Copy that must never reach a phone. */
const LEAKS = /\{\{|\}\}|undefined|NaN|notifications\.|timeline\./

/** Collects runtime errors so any test can fail on them. */
function watchForErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  return errors
}

const notifications = (page: Page) => readStore<AppNotification[]>(page, 'notifications')
const applications = (page: Page) => readStore<Application[]>(page, 'applications')

/** Every notification pushed for `applicationId` with `trigger`. */
async function firedFor(page: Page, applicationId: string, trigger: NotificationTrigger) {
  return (await notifications(page)).filter(
    (n) => n.applicationId === applicationId && n.trigger === trigger,
  )
}

/**
 * Asserts one lifecycle event produced exactly the documented fan-out: one
 * message per configured channel, no duplicates, both locales rendered.
 */
async function expectTrigger(
  page: Page,
  applicationId: string,
  trigger: NotificationTrigger,
  expectedRef: string,
) {
  await expect
    .poll(async () => (await firedFor(page, applicationId, trigger)).map((n) => n.channel).sort(), {
      message: `channels for the \`${trigger}\` notification`,
      timeout: 20_000,
    })
    .toEqual([...EXPECTED_CHANNELS[trigger]].sort())

  const fired = await firedFor(page, applicationId, trigger)
  for (const notification of fired) {
    expect(notification.body, 'Arabic body').not.toMatch(LEAKS)
    expect(notification.bodyEn, 'English body').not.toMatch(LEAKS)
    expect(notification.body).toContain(expectedRef)
    expect(notification.bodyEn).toContain(expectedRef)
    expect(notification.read).toBe(false)
    expect(notification.sentAt).toBeTruthy()
    // Email goes to the inbox, SMS/WhatsApp to the mobile the applicant gave us.
    expect(notification.recipient, `recipient for ${notification.channel}`).toMatch(
      notification.channel === 'email' ? /@/ : /^05\d{8}$/,
    )
  }
  return fired
}

/* ── shared UI helpers ─────────────────────────────────────────────────────── */

async function searchFor(page: Page, ref: string) {
  await expect(async () => {
    await page.getByRole('searchbox').fill(ref)
    await expect(page.locator('tbody tr')).toHaveCount(1, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}

/** Opens an application from the list without a reload (the store must survive). */
async function openFromList(page: Page, ref: string) {
  await searchFor(page, ref)
  await page.locator('tbody tr').first().click()
  await expect(page.getByTestId('detail-status')).toBeVisible()
}

function openRowMenu(page: Page, rowText: string) {
  return page
    .locator('tbody tr')
    .filter({ hasText: rowText })
    .getByLabel('Open menu')
    .click()
}

const bell = (page: Page) => page.getByTestId('notification-bell')

async function openBell(page: Page) {
  await clearToasts(page)
  await bell(page).click()
  await expect(page.getByTestId('notification-center')).toBeVisible()
}

/* ══ 1. Template quality — every trigger, every locale ═════════════════════ */

test.describe('message templates', () => {
  for (const lang of ['en', 'ar'] as const) {
    test(`every template renders fully interpolated in ${lang}`, async ({ page }) => {
      const errors = watchForErrors(page)
      await gotoApp(page, '/admin/settings', lang)

      await page.getByRole('tab', { name: lang === 'ar' ? 'الإشعارات' : 'Notifications' }).click()

      // One row per trigger — the settings screen is the client-facing catalogue.
      const rows = page.locator('li').filter({ has: page.getByRole('switch') })
      await expect(rows).toHaveCount(TRIGGERS.length)

      const catalogue = (await rows.allTextContents()).join('\n')
      expect(catalogue).not.toMatch(LEAKS)

      // …and each one previews inside the phone frame with nothing unresolved.
      for (let index = 0; index < TRIGGERS.length; index += 1) {
        await rows
          .nth(index)
          .getByRole('button', { name: lang === 'ar' ? 'عرض' : 'View' })
          .click()

        const preview = page.getByTestId('phone-preview')
        await expect(preview).toBeVisible()

        const channels = EXPECTED_CHANNELS[TRIGGERS[index]]
        for (const channel of channels) {
          if (channels.length > 1) {
            await page.getByTestId(`phone-preview-channel-${channel}`).click()
          }
          const body = page.getByTestId('phone-preview-body')
          await expect(body).toBeVisible()
          const text = (await body.innerText()).trim()
          expect(text.length, `${TRIGGERS[index]}/${channel} body is empty`).toBeGreaterThan(10)
          expect(text, `${TRIGGERS[index]}/${channel}`).not.toMatch(LEAKS)
          // The sample reference must actually be interpolated in.
          expect(text).toContain('APP-2026-0042')
          // Arabic templates must not be shipping English copy and vice versa.
          expect(/[؀-ۿ]/.test(text), `${lang} script`).toBe(lang === 'ar')
        }

        await page.keyboard.press('Escape')
        await expect(preview).toBeHidden()
      }

      expect(errors, errors.join('\n')).toEqual([])
    })
  }

  test('seeded messages come from the same templates the app sends live', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin')

    const seeded = await notifications(page)
    const apps = await applications(page)
    expect(seeded.length).toBeGreaterThan(10)

    for (const notification of seeded) {
      const app = apps.find((a) => a.id === notification.applicationId)!
      expect(app, 'every notification belongs to an application').toBeTruthy()
      expect(TRIGGERS).toContain(notification.trigger)
      expect(notification.body, `${notification.id} ar`).not.toMatch(LEAKS)
      expect(notification.bodyEn, `${notification.id} en`).not.toMatch(LEAKS)
      expect(notification.body).toContain(app.ref)
      expect(notification.bodyEn).toContain(app.ref)
    }

    // The `approved` template carries {{name}}: the seeded copy has to resolve
    // it from the beneficiary, which is only true when both sides render from
    // `NOTIFICATION_BODIES` instead of a private fixture copy.
    const approved = seeded.find((n) => n.trigger === 'approved')!
    expect(approved, 'fixtures must include an approved message').toBeTruthy()
    const owner = apps.find((a) => a.id === approved.applicationId)!
    expect(approved.body).toContain(owner.beneficiary.fullName)
    expect(approved.bodyEn).toContain(owner.beneficiary.fullNameEn)

    expect(errors, errors.join('\n')).toEqual([])
  })
})

/* ══ 2. The trigger matrix, driven through the product ════════════════════ */

test.describe('trigger matrix', () => {
  test('received — submitting the wizard messages the applicant', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/apply')

    await page.getByLabel(/Full name/).fill('Hessa Al Mutairi')
    await page.getByLabel(/National ID number/).fill('1122334455')
    await page.getByLabel(/Mobile number/).fill('0559876543')
    await page.getByLabel(/Email address/).fill('hessa@example.com')
    await page.getByLabel(/^City/).fill('Riyadh')
    await page.getByLabel(/IBAN/).fill('SA4420000001234567891234')
    await page.getByLabel(/^Region/).click()
    await page.getByRole('option', { name: 'Riyadh', exact: true }).click()
    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByLabel(/Project name/).fill('Hessa Home Bakery')
    await page.getByLabel(/^Sector/).click()
    await page.getByRole('option', { name: 'Food', exact: true }).click()
    await page
      .getByLabel(/Project description/)
      .fill(
        'A home bakery selling fresh bread and cakes to neighbourhood cafes, expanding to a ' +
          'second oven and two new bakers during the first year of operation.',
      )
    await page.getByLabel(/Requested amount/).fill('80000')
    await page.getByLabel(/Current monthly income/).fill('9000')
    await page.getByLabel(/Years of experience/).fill('4')
    await page.getByRole('button', { name: 'Next' }).click()

    await attachWizardDocuments(page)
    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByTestId('terms-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight
    })
    await page.getByRole('checkbox').click()
    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByRole('button', { name: 'Submit application' }).click()
    const ref = (await page.getByTestId('submitted-ref').innerText()).trim()

    const created = (await applications(page)).find((a) => a.ref === ref)!
    expect(created).toBeTruthy()
    await expectTrigger(page, created.id, 'received', ref)

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('incomplete — flagging a document requests the missing papers', async ({ page }) => {
    const errors = watchForErrors(page)
    const id = 'APP-012' // `new`, all documents present
    await gotoApp(page, `/admin/applications/${id}?tab=documents`)

    const app = (await applications(page)).find((a) => a.id === id)!
    expect(app.status).toBe('new')

    await page.getByRole('button', { name: 'Flag as missing' }).first().click()
    await expect(page.getByTestId('detail-status')).toContainText('Incomplete')

    const fired = await expectTrigger(page, id, 'incomplete', app.ref)
    expect(fired[0].body).toContain('مستندات')

    // The event is on the file's history, once — not once per channel.
    await page.getByRole('tab', { name: 'History' }).click()
    const entries = page
      .getByRole('listitem')
      .filter({ hasText: 'Notification sent: Documents requested' })
    await expect(entries).toHaveCount(1)

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('interview_scheduled — booking a slot messages on all three channels', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/applications')

    const apps = await applications(page)
    const booked = new Set(
      (await readStore<{ applicationId: string }[]>(page, 'interviews')).map(
        (i) => i.applicationId,
      ),
    )
    const target = apps.find((a) => a.status === 'under_review' && !booked.has(a.id))!
    expect(target, 'fixtures must offer an unbooked under_review file').toBeTruthy()

    await openFromList(page, target.ref)
    await page.getByRole('button', { name: 'Schedule', exact: true }).first().click()

    const dialog = page.getByRole('dialog')
    await dialog.locator('#interviewer').click()
    await page.getByRole('option').nth(1).click()
    await dialog.getByRole('radio').nth(1).click()
    await dialog.locator('button[aria-pressed]:not([disabled])').first().click()
    await dialog.getByRole('button', { name: /Confirm slot/ }).click()
    await expect(dialog).toBeHidden()

    await expectTrigger(page, target.id, 'interview_scheduled', target.ref)

    // Scheduling also carries the file to `awaiting_interview` — and that must
    // not double-send the same message.
    await expect.poll(async () => (await applications(page)).find((a) => a.id === target.id)!.status)
      .toBe('awaiting_interview')

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('approved and rejected — the decision reaches the applicant', async ({ page }) => {
    const errors = watchForErrors(page)

    // Approve: awaiting_interview → approved.
    await gotoApp(page, '/admin/applications/APP-005')
    const approvedApp = (await applications(page)).find((a) => a.id === 'APP-005')!
    expect(approvedApp.status).toBe('awaiting_interview')

    await page.getByRole('button', { name: 'Change status' }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: 'Approved' }).click()
    await dialog.getByRole('button', { name: 'Confirm change' }).click()
    await expect(page.getByTestId('detail-status')).toContainText('Approved')

    const approved = await expectTrigger(page, 'APP-005', 'approved', approvedApp.ref)
    // {{name}} is the one template placeholder that is not the reference.
    expect(approved[0].body).toContain(approvedApp.beneficiary.fullName)
    expect(approved[0].bodyEn).toContain(approvedApp.beneficiary.fullNameEn)

    // Reject: under_review → rejected, with the mandatory reason.
    await clearToasts(page)
    await gotoApp(page, '/admin/applications/APP-003')
    const rejectedApp = (await applications(page)).find((a) => a.id === 'APP-003')!

    await page.getByRole('button', { name: 'Change status' }).click()
    dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: 'Rejected' }).click()
    await dialog.getByLabel(/Reason for the change/).fill('The feasibility study is incomplete.')
    await dialog.getByRole('button', { name: 'Confirm change' }).click()
    await expect(page.getByTestId('detail-status')).toContainText('Rejected')

    await expectTrigger(page, 'APP-003', 'rejected', rejectedApp.ref)

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('contract — generating, sending and signing all land on the file', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/contracts')

    const apps = await applications(page)
    const contracts = await readStore<Contract[]>(page, 'contracts')

    /* Generate: an approved file with no contract yet. */
    const candidate = apps.find(
      (a) => a.status === 'approved' && !contracts.some((c) => c.applicationId === a.id),
    )!
    expect(candidate, 'fixtures must leave one approved file without a contract').toBeTruthy()

    await page.getByRole('button', { name: /^Generate contract$/ }).click()
    let dialog = page.getByRole('dialog')
    await dialog.getByRole('radio').filter({ hasText: candidate.ref }).click()
    await dialog.getByRole('button', { name: /^Generate contract$/ }).click()
    await expect
      .poll(async () =>
        (await readStore<Contract[]>(page, 'contracts')).some(
          (c) => c.applicationId === candidate.id,
        ),
      )
      .toBe(true)
    await page.keyboard.press('Escape')

    // Generation is a milestone: it has to be on the application's history.
    const generated = (await applications(page)).find((a) => a.id === candidate.id)!
    expect(
      generated.timeline.some((e) => e.messageKey === 'timeline.contractGenerated'),
      'contract generation must append a timeline event',
    ).toBe(true)

    /* Send + sign a draft. */
    await clearToasts(page)
    const draft = (await readStore<Contract[]>(page, 'contracts')).find(
      (c) => c.status === 'draft',
    )!
    const owner = apps.find((a) => a.id === draft.applicationId)!

    await openRowMenu(page, draft.contractNo)
    await page.getByRole('menuitem', { name: 'Send for signature' }).click()
    await expect
      .poll(async () =>
        (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === draft.id)?.status,
      )
      .toBe('sent')

    const sent = (await applications(page)).find((a) => a.id === draft.applicationId)!
    expect(
      sent.timeline.some((e) => e.messageKey === 'timeline.contractSent'),
      'sending a contract must append a timeline event',
    ).toBe(true)

    /*
      The applicant completes it from her own portal — staff have no signing
      action on this screen at all.
    */
    await clearToasts(page)
    await openRowMenu(page, draft.contractNo)
    await expect(page.getByRole('menuitem', { name: 'Sign contract' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await completeContractAsBeneficiary(page, draft.id, owner.beneficiary.fullNameEn)
    await expect
      .poll(async () =>
        (await readStore<Contract[]>(page, 'contracts')).find((c) => c.id === draft.id)?.status,
      )
      .toBe('signed')

    // Signing is email-only per the matrix.
    await expectTrigger(page, draft.applicationId, 'contract_signed', owner.ref)

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('disbursed — confirming the payment messages SMS and WhatsApp', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/disbursements')

    const apps = await applications(page)
    const target = (await readStore<Disbursement[]>(page, 'disbursements')).find(
      (d) =>
        d.status === 'ordered' &&
        apps.find((a) => a.id === d.applicationId)?.status === 'approved',
    )!
    expect(target, 'an ordered payment on an approved file is required').toBeTruthy()
    const owner = apps.find((a) => a.id === target.applicationId)!

    await openRowMenu(page, target.orderNo)
    await page.getByRole('menuitem', { name: 'Confirm payment' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: 'Confirm payment' }).click()
    await expect(dialog).toBeHidden()

    await expectTrigger(page, target.applicationId, 'disbursed', owner.ref)

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('follow_up_due — the reminder goes out on WhatsApp only', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/follow-up')

    const followUps = await readStore<FollowUp[]>(page, 'followUps')
    const apps = await applications(page)
    const target = followUps.find((f) => !f.submittedAt) ?? followUps[0]
    const owner = apps.find((a) => a.id === target.applicationId)!

    await page.getByRole('row').filter({ hasText: owner.project.name }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'Send reminder' }).click()
    await expect(page.locator('[data-sonner-toast]')).toContainText('Reminder sent')

    const before = (await firedFor(page, owner.id, 'follow_up_due')).length
    expect(before).toBeGreaterThan(0)
    const latest = (await notifications(page))[0]
    expect(latest.trigger).toBe('follow_up_due')
    expect(latest.channel).toBe('whatsapp')
    expect(latest.applicationId).toBe(owner.id)
    expect(latest.body).not.toMatch(LEAKS)
    expect(latest.bodyEn).not.toMatch(LEAKS)
    expect(latest.body).toContain(owner.ref)

    expect(errors, errors.join('\n')).toEqual([])
  })
})

/* ══ 3. The bell and the notification centre ══════════════════════════════ */

test.describe('notification centre', () => {
  test('the unread badge is derived from the store and clears on mark-all-read', async ({
    page,
  }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin')

    const stored = await notifications(page)
    const unread = stored.filter((n) => !n.read).length
    expect(unread, 'fixtures must ship unread messages').toBeGreaterThan(0)

    await expect(bell(page)).toHaveAttribute('data-unread', String(unread))
    await expect(page.getByTestId('notification-badge')).toHaveText(unread > 9 ? '9+' : String(unread))

    await openBell(page)

    // Newest first, with a relative timestamp on every row.
    const items = page.getByTestId('notification-item')
    await expect(items).toHaveCount(Math.min(8, stored.length))
    const newest = [...stored].sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))[0]
    await expect(items.first()).toContainText(newest.bodyEn)
    await expect(items.first()).toContainText(/ago|now|Yesterday|day|hour|minute/i)

    const rendered = await items.allInnerTexts()
    expect(rendered.join('\n')).not.toMatch(LEAKS)

    await page.getByRole('button', { name: 'Mark all as read' }).click()

    // Badge gone, store agrees.
    await expect(page.getByTestId('notification-badge')).toHaveCount(0)
    await expect(bell(page)).toHaveAttribute('data-unread', '0')
    await expect.poll(async () => (await notifications(page)).every((n) => n.read)).toBe(true)

    // …and it stays gone after moving between screens client-side.
    await page.keyboard.press('Escape')
    await navigateTo(page, '/admin/applications')
    await expect(page.getByTestId('notification-badge')).toHaveCount(0)
    await expect(bell(page)).toHaveAttribute('data-unread', '0')

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('the bell rings and the badge grows when a new message is sent', async ({ page }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin/applications/APP-005')

    // Start from a clean slate so the change is unambiguous.
    await openBell(page)
    await page.getByRole('button', { name: 'Mark all as read' }).click()
    await expect(bell(page)).toHaveAttribute('data-unread', '0')
    await page.keyboard.press('Escape')
    await expect(bell(page)).toHaveAttribute('data-ringing', 'false')

    await page.getByRole('button', { name: 'Change status' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: 'Approved' }).click()
    await dialog.getByRole('button', { name: 'Confirm change' }).click()

    // `approved` fans out to two channels — both land in the centre.
    await expect(bell(page)).toHaveAttribute('data-ringing', 'true')
    await expect(bell(page)).toHaveAttribute('data-unread', '2')
    await expect(page.getByTestId('notification-badge')).toHaveText('2')

    // The ring is a gesture, not a permanent state.
    await expect(bell(page)).toHaveAttribute('data-ringing', 'false', { timeout: 5_000 })

    await openBell(page)
    const first = page.getByTestId('notification-item').first()
    await expect(first).toHaveAttribute('data-trigger', 'approved')

    expect(errors, errors.join('\n')).toEqual([])
  })

  test('a message opens the phone preview on its own channel and closes cleanly', async ({
    page,
  }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/admin')

    await openBell(page)
    const item = page.getByTestId('notification-item').first()
    const channel = await item.getAttribute('data-channel')
    const body = (await notifications(page)).sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))[0]

    await item.click()
    const preview = page.getByTestId('phone-preview')
    await expect(preview).toBeVisible()
    await expect(preview.locator(`[data-channel="${channel}"]`)).toBeVisible()
    await expect(page.getByTestId('phone-preview-body')).toHaveText(body.bodyEn)
    await expect(preview).toContainText('Simulated delivery')

    await page.keyboard.press('Escape')
    await expect(preview).toBeHidden()

    expect(errors, errors.join('\n')).toEqual([])
  })
})

/* ══ 4. Channel toggles ═══════════════════════════════════════════════════ */

test('switching a channel off in settings stops that channel only', async ({ page }) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/admin/settings')
  await page.getByRole('tab', { name: 'Notifications' }).click()

  const toggle = page.getByRole('switch', { name: 'Documents requested — WhatsApp' })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()

  // Walk to the application client-side: a reload would restore the defaults.
  await navigateTo(page, '/admin/applications')
  const target = (await applications(page)).find((a) => a.id === 'APP-012')!
  expect(target.status).toBe('new')
  await openFromList(page, target.ref)
  await page.getByRole('tab', { name: 'Documents' }).click()
  await page.getByRole('button', { name: 'Flag as missing' }).first().click()
  await expect(page.getByTestId('detail-status')).toContainText('Incomplete')

  await expect
    .poll(async () => (await firedFor(page, 'APP-012', 'incomplete')).map((n) => n.channel), {
      timeout: 20_000,
    })
    .toEqual(['sms'])

  // The setting itself survived the trip.
  await clearToasts(page)
  await navigateTo(page, '/admin/settings')
  await page.getByRole('tab', { name: 'Notifications' }).click()
  await expect(page.getByRole('switch', { name: 'Documents requested — WhatsApp' })).not.toBeChecked()
  await expect(page.getByRole('switch', { name: 'Documents requested — SMS' })).toBeChecked()

  expect(errors, errors.join('\n')).toEqual([])
})

/* ══ 5. Arabic / RTL ══════════════════════════════════════════════════════ */

test('the centre, the preview and a live trigger all work in Arabic', async ({ page }) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/admin/applications/APP-005', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

  // A real trigger, in Arabic.
  const app = (await applications(page)).find((a) => a.id === 'APP-005')!
  await page.getByRole('button', { name: 'تغيير الحالة' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('radio', { name: 'معتمد' }).click()
  await dialog.getByRole('button', { name: 'تأكيد التغيير' }).click()
  await expect(page.getByTestId('detail-status')).toContainText('معتمد')

  const fired = await expectTrigger(page, 'APP-005', 'approved', app.ref)
  expect(fired[0].body).toContain('تم اعتماد طلبك')

  // The centre renders the Arabic body.
  await openBell(page)
  const centre = page.getByTestId('notification-center')
  await expect(centre).toContainText('الإشعارات')
  const item = page.getByTestId('notification-item').first()
  await expect(item).toContainText('تم اعتماد طلبك')
  await expect(item).not.toContainText('has been approved')

  // The phone frame too.
  await item.click()
  const preview = page.getByTestId('phone-preview')
  await expect(preview).toBeVisible()
  await expect(preview).toContainText('معاينة الرسالة')
  const previewBody = (await page.getByTestId('phone-preview-body').innerText()).trim()
  expect(previewBody).toContain('تم اعتماد طلبك')
  expect(previewBody).not.toMatch(LEAKS)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()

  expect(errors, errors.join('\n')).toEqual([])
})
