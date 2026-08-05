import { expect, type Page } from '@playwright/test'

/**
 * Helpers for the two-party e-signature flow.
 *
 * The model under test: the funding programme signs centrally — its authorised
 * signatory is configured once in `/admin/settings` and stamped onto every
 * contract at generation time — and the **applicant** signs interactively, from
 * her own portal. Her signature is what completes the contract: `status:
 * 'signed'`, `signedAt`, the pending disbursement record and the
 * `contract_signed` notification all hang off it. Staff can no longer sign
 * anything from `/admin/contracts`.
 */

export const DEMO_OTP = '1234'

/** The mount point the applicant-facing signing dialog hangs off, on `/track`. */
export const PORTAL_SIGN_BUTTON = '[data-testid="track-contract-sign"]'

/** Draws a short scribble on the signature canvas with real pointer events. */
export async function drawSignature(page: Page) {
  const pad = page.getByTestId('signature-pad')
  // Absolute pointer coordinates only land on the pad if the pad is on screen.
  await pad.scrollIntoViewIfNeeded()
  const box = await pad.boundingBox()
  if (!box) throw new Error('signature pad has no bounding box')

  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6)
  await page.mouse.down()
  for (const [fx, fy] of [
    [0.32, 0.3],
    [0.45, 0.72],
    [0.58, 0.28],
    [0.72, 0.66],
  ]) {
    await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy)
  }
  await page.mouse.up()
  await expect(pad).toHaveAttribute('data-has-ink', 'true')
}

/**
 * Waits for the applicant's sign button rather than counting immediately: the
 * contract card renders after its query resolves, so an instant count races the
 * simulated network and reports "not mounted" on a page that is merely still
 * loading.
 */
export async function portalSigningMounted(page: Page) {
  await page.locator(PORTAL_SIGN_BUTTON).waitFor({ state: 'visible', timeout: 10_000 })
  return true
}

/** Runs the applicant's signing dialog exactly as she would, on `/track`. */
export async function signInPortalUi(
  page: Page,
  signatureName: string,
  { otp = DEMO_OTP, keyboardOnly = false }: { otp?: string; keyboardOnly?: boolean } = {},
) {
  await page.locator(PORTAL_SIGN_BUTTON).click()

  const dialog = page.getByTestId('beneficiary-signing-dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(/Full name as on your ID|الاسم الكامل كما في الهوية/).fill(signatureName)

  if (keyboardOnly) {
    await dialog.getByTestId('signature-use-typed-name').press('Enter')
    await expect(page.getByTestId('signature-pad')).toHaveAttribute('data-has-ink', 'true')
  } else {
    await drawSignature(page)
  }

  await dialog.getByLabel(/Verification code|رمز التحقق/).fill(otp)
  await dialog.getByRole('button', { name: /Sign and confirm|توقيع واعتماد/ }).click()
}

/** A real 1×1 PNG data-URL, standing in for a drawn signature. */
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/**
 * Completes a contract by calling the same mutation her dialog calls.
 *
 * **Setup only** — for specs whose subject is what happens *after* signing (the
 * disbursement queue, the notification fan-out), reached from an admin screen
 * where her portal is not on display. It is not a fallback: `signAsBeneficiary`
 * below always drives the real dialog, and the tests that exist to prove the
 * signing UI works — `esign.spec.ts` and the lifecycle walkthrough — use that.
 *
 * The rules still apply: `signContractAsBeneficiary` refuses anything not `sent`.
 */
export async function completeContractAsBeneficiary(
  page: Page,
  contractId: string,
  signatureName: string,
) {
  await page.evaluate(
    ([id, name, image]) => {
      const w = window as unknown as {
        __demoStore?: {
          getState: () => {
            signContractAsBeneficiary: (input: {
              contractId: string
              signatureName: string
              signatureImage?: string
            }) => void
          }
        }
      }
      if (!w.__demoStore) throw new Error('window.__demoStore is not exposed')
      w.__demoStore.getState().signContractAsBeneficiary({
        contractId: id,
        signatureName: name,
        signatureImage: image,
      })

      // The mutation hooks invalidate after every write; a direct store call has
      // to say so too, or the screens keep rendering the pre-signature cache.
      const q = (window as unknown as { __queryClient?: { invalidateQueries: () => void } })
        .__queryClient
      q?.invalidateQueries()
    },
    [contractId, signatureName, PNG_DATA_URL] as const,
  )
}

/** The applicant signs, through her own portal. */
export async function signAsBeneficiary(
  page: Page,
  { contractId, signatureName }: { contractId: string; signatureName: string },
) {
  /*
    Always through her real dialog. The store bridge existed only while the
    portal had no signing UI; keeping it as a fallback would let a broken sign
    button pass as green, which is the one thing these tests exist to catch.
  */
  await signInPortalUi(page, signatureName)
  await expect(page.getByTestId('beneficiary-signing-dialog')).toBeHidden()
  return 'portal-ui' as const
}

/**
 * Looks an application up on `/track`.
 *
 * Retried as a unit: the page-transition animation can remount the field and
 * drop a fill that landed mid-flight, which then disables the submit button.
 */
export async function lookupOnTrack(page: Page, ref: string, lang: 'en' | 'ar' = 'en') {
  const field = page.getByLabel(lang === 'ar' ? /رقم الطلب/ : /Reference number/)
  await expect(async () => {
    await field.fill(ref)
    await expect(field).toHaveValue(ref, { timeout: 2_000 })
    await page
      .getByRole('button', { name: lang === 'ar' ? 'بحث' : 'Look up' })
      .click({ timeout: 5_000 })
    await expect(page.getByTestId('track-ref')).toHaveText(ref, { timeout: 5_000 })
  }).toPass({ timeout: 30_000 })
}
