import {
  test,
  expect,
  gotoApp,
  readStore,
  clearToasts,
  imageFile,
  TINY_PNG,
} from './support/app'
import type { Page } from '@playwright/test'
import type { Application, FollowUp } from '../src/data/types'

/**
 * Uploads — the client's point 7 ("uploading project photos") and point 1
 * ("uploading the required documents").
 *
 * Both controls are real `<input type="file">` elements, so every test hands
 * them actual bytes and then checks the demo database, not just the DOM.
 */

const PHONE = { width: 390, height: 844 }

function watchForErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
  })
  return errors
}

/** Opens a pending beneficiary report form and returns its follow-up id. */
async function openPendingForm(page: Page, lang: 'en' | 'ar' = 'en') {
  await gotoApp(page, '/', lang)
  const followUps = await readStore<FollowUp[]>(page, 'followUps')
  const applications = await readStore<Application[]>(page, 'applications')
  const pending = followUps.find((f) => !f.submittedAt)
  expect(pending, 'fixtures must contain an unsubmitted follow-up').toBeTruthy()

  await gotoApp(page, `/follow-up/${pending!.id}`, lang)
  return {
    id: pending!.id,
    before: pending!.photos.length,
    application: applications.find((a) => a.id === pending!.applicationId)!,
  }
}

const numbers = {
  en: { revenue: /Revenue this period/, employees: /Current number of employees/, growth: /Estimated growth/ },
  ar: { revenue: /إيرادات الفترة/, employees: /عدد الموظفين حاليًا/, growth: /نسبة النمو المقدّرة/ },
}

async function fillFigures(page: Page, lang: 'en' | 'ar' = 'en') {
  await page.getByLabel(numbers[lang].revenue).fill('51000')
  await page.getByLabel(numbers[lang].employees).fill('5')
  await page.getByLabel(numbers[lang].growth).fill('12')
}

/* ── 1. Beneficiary photo upload ───────────────────────────────────────────── */

test('uploads photos from a phone, previews them and stores them on the follow-up', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  const errors = watchForErrors(page)

  const { id, before, application } = await openPendingForm(page)

  const input = page.getByTestId('photo-input')
  await input.setInputFiles([imageFile('storefront.png'), imageFile('team.png')])

  // Thumbnails render from the bytes that were read in the browser.
  const previews = page.getByTestId('photo-preview')
  await expect(previews).toHaveCount(2)
  await expect(page.getByTestId('photo-count')).toHaveText('2 / 4')
  for (const src of await previews.evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLImageElement).src),
  )) {
    expect(src.startsWith('data:image/')).toBe(true)
  }

  // Remove-a-photo really removes it.
  await page.getByRole('button', { name: 'Remove photo team.png' }).click()
  await expect(previews).toHaveCount(1)
  await expect(page.getByTestId('photo-count')).toHaveText('1 / 4')

  // …and the same file can be picked again afterwards.
  await input.setInputFiles(imageFile('team.png'))
  await expect(previews).toHaveCount(2)

  await fillFigures(page)
  await page.getByRole('button', { name: 'Submit report' }).click()
  await expect(page.getByTestId('follow-up-success')).toBeVisible()

  // Store: the photos travelled through the mutation into `FollowUp.photos`.
  const after = await readStore<FollowUp[]>(page, 'followUps')
  const saved = after.find((f) => f.id === id)!
  expect(saved.photos).toHaveLength(before + 2)
  for (const photo of saved.photos.slice(before)) {
    expect(photo.startsWith('data:image/')).toBe(true)
    // Kept small enough that the in-memory database stays sane.
    expect(photo.length).toBeLessThan(400_000)
  }
  expect(saved.submittedAt).toBeTruthy()

  await clearToasts(page)

  /*
    Client-side navigation only — a full load would reset the demo database and
    the photos would vanish with it.
  */
  // The officer reviews on a desktop; the admin nav is collapsed on a phone.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('link', { name: 'Admin' }).first().click()
  await page.getByRole('link', { name: 'Follow-up' }).first().click()
  await expect(page.getByRole('heading', { name: 'Project monitoring' })).toBeVisible()

  await page.getByRole('row').filter({ hasText: application.project.name }).first().click()
  const sheet = page.getByRole('dialog')
  const gallery = sheet.getByTestId('photo-gallery')
  await expect(gallery.locator('li')).toHaveCount(saved.photos.length)
  // The uploaded ones render as real images, not filename chips.
  await expect(sheet.getByTestId('photo-image')).toHaveCount(2)
  await expect(sheet.getByTestId('photo-total')).toHaveText(String(saved.photos.length))

  // The image element actually decoded the data URL.
  expect(
    await sheet.getByTestId('photo-image').first().evaluate((node) => (node as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0)

  expect(errors, errors.join('\n')).toEqual([])
})

test('rejects non-images and enforces the four-photo limit with localized errors', async ({
  page,
}) => {
  await page.setViewportSize(PHONE)
  const { id } = await openPendingForm(page)

  const input = page.getByTestId('photo-input')

  // Not an image.
  await input.setInputFiles({
    name: 'contract.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 not a photo'),
  })
  await expect(page.getByRole('alert')).toContainText('contract.pdf is not an image file')
  await expect(page.getByTestId('photo-preview')).toHaveCount(0)

  // Five images — only four are kept and the limit is explained.
  await input.setInputFiles(['a', 'b', 'c', 'd', 'e'].map((name) => imageFile(`${name}.png`)))
  await expect(page.getByTestId('photo-preview')).toHaveCount(4)
  await expect(page.getByTestId('photo-count')).toHaveText('4 / 4')
  await expect(page.getByRole('alert')).toContainText('You can attach up to 4 photos')

  // Oversized file.
  await page.getByRole('button', { name: 'Remove photo a.png' }).click()
  await input.setInputFiles({
    name: 'huge.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(6 * 1024 * 1024, 1),
  })
  await expect(page.getByRole('alert')).toContainText('huge.png is larger than 5 MB')
  await expect(page.getByTestId('photo-preview')).toHaveCount(3)

  // Nothing was written while the form is unsubmitted.
  const followUps = await readStore<FollowUp[]>(page, 'followUps')
  expect(followUps.find((f) => f.id === id)!.submittedAt).toBeFalsy()
})

test('photo upload works in Arabic RTL on a phone', async ({ page }) => {
  await page.setViewportSize(PHONE)
  const errors = watchForErrors(page)

  const { id, before } = await openPendingForm(page, 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByText('صور من المشروع')).toBeVisible()

  const input = page.getByTestId('photo-input')
  await input.setInputFiles({
    name: 'ملف.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4'),
  })
  await expect(page.getByRole('alert')).toContainText('ليس ملف صورة')

  await input.setInputFiles([imageFile('shop.png'), imageFile('team.png')])
  await expect(page.getByTestId('photo-preview')).toHaveCount(2)
  await expect(page.getByRole('button', { name: /إزالة الصورة/ }).first()).toBeVisible()

  // The page must not scroll sideways on a phone in RTL.
  expect(await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 1)).toBe(false)

  await fillFigures(page, 'ar')
  await page.getByRole('button', { name: 'إرسال التقرير' }).click()
  await expect(page.getByTestId('follow-up-success')).toBeVisible()

  const after = await readStore<FollowUp[]>(page, 'followUps')
  expect(after.find((f) => f.id === id)!.photos).toHaveLength(before + 2)

  expect(errors, errors.join('\n')).toEqual([])
})

/* ── 2. Applicant wizard documents ─────────────────────────────────────────── */

test('the apply wizard attaches the real picked file and rejects oversized ones', async ({
  page,
}) => {
  const errors = watchForErrors(page)

  // The wizard draft is persisted, so the documents step can be restored
  // directly instead of retyping the two steps before it.
  await page.addInitScript(() => {
    localStorage.setItem(
      'apply-draft',
      JSON.stringify({ state: { step: 'documents', documents: [] }, version: 0 }),
    )
  })
  await gotoApp(page, '/apply')

  const step = page.getByTestId('doc-national_id')
  await expect(step).toBeVisible()

  await page
    .getByTestId('doc-input-national_id')
    .setInputFiles({ name: 'my-id.png', mimeType: 'image/png', buffer: TINY_PNG })
  // The real file name and size are shown — not a canned placeholder.
  await expect(step).toContainText('my-id.png')
  await expect(step).toContainText('1 KB')

  await page.getByTestId('doc-input-iban_cert').setInputFiles({
    name: 'too-big.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.alloc(6 * 1024 * 1024, 1),
  })
  await expect(page.getByRole('alert')).toContainText('too-big.pdf is larger than 5 MB')
  await expect(page.getByTestId('doc-iban_cert')).not.toContainText('too-big.pdf')

  expect(errors, errors.join('\n')).toEqual([])
})
