import { expect, test as base, type Page } from '@playwright/test'

export type Lang = 'ar' | 'en'

/**
 * Pins language and theme before the app boots.
 *
 * i18next reads `localStorage.lang`; the zustand `ui` store keeps its own copy
 * for `dir`/theme. Both must agree or the first paint flips mid-test.
 */
export async function pinLocale(page: Page, lang: Lang, theme: 'light' | 'dark' = 'light') {
  await page.addInitScript(
    ([l, t]) => {
      localStorage.setItem('lang', l as string)
      localStorage.setItem(
        'ui',
        JSON.stringify({ state: { lang: l, theme: t }, version: 0 }),
      )
    },
    [lang, theme] as const,
  )
}

/**
 * Navigates with the language pinned and waits for the app shell to be interactive.
 *
 * ⚠️ This is a full page load, which **resets the in-memory demo database back to
 * the fixtures**. To assert that a mutation survives moving between screens, you
 * must navigate client-side instead — use `navigateTo()`.
 */
export async function gotoApp(page: Page, path: string, lang: Lang = 'en') {
  await pinLocale(page, lang)
  await page.goto(path)
  await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr')
  await settle(page)
}

/**
 * Waits out the simulated network (380–720 ms reads, 320 ms writes) plus the
 * page-transition animation. Prefer asserting on content; use this only where a
 * test must observe a *list* that may legitimately be unchanged.
 */
export async function settle(page: Page, ms = 1200) {
  await page.waitForTimeout(ms)
}

/**
 * Client-side navigation via the React Router link for `path`, preserving the
 * demo database. The counterpart to `gotoApp`, which throws it away.
 */
export async function navigateTo(page: Page, path: string) {
  const link = page.locator(`a[href="${path}"]`).first()
  await link.waitFor({ state: 'visible' })
  await link.click()
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`))
}

/** Reads the live zustand demo database from the page — the source of truth for mutations. */
export async function readStore<T = unknown>(page: Page, slice: string): Promise<T> {
  return page.evaluate((key) => {
    const w = window as unknown as { __demoStore?: { getState: () => Record<string, unknown> } }
    if (!w.__demoStore) throw new Error('window.__demoStore is not exposed')
    return w.__demoStore.getState()[key] as unknown
  }, slice) as Promise<T>
}

/**
 * Waits until no sonner toast is on screen, so one cannot cover the next click.
 *
 * Deliberately passive: ripping the toast nodes out of the DOM behind React's
 * back makes sonner's next render throw `insertBefore` on a node it no longer
 * owns, which unmounts the whole app to a blank page — and only when a *second*
 * toast arrives, so it reads as a mysterious flake much later.
 */
export async function clearToasts(page: Page, timeout = 8_000) {
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0, { timeout })
}

/**
 * A real 1×1 PNG. The upload controls are genuine `<input type="file">` elements,
 * so tests must hand them actual bytes via `setInputFiles` — Playwright cancels
 * an unhandled native file chooser, which would silently attach nothing.
 */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** A payload for `setInputFiles`, defaulting to the tiny PNG above. */
export function imageFile(name = 'project.png') {
  return { name, mimeType: 'image/png', buffer: TINY_PNG }
}

/** Attaches a file to each document kind in the apply wizard's documents step. */
export async function attachWizardDocuments(
  page: Page,
  kinds: string[] = ['national_id', 'iban_cert', 'feasibility_study'],
) {
  for (const kind of kinds) {
    await page
      .getByTestId(`doc-input-${kind}`)
      .setInputFiles({ name: `${kind}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 demo file') })
    await expect(page.getByTestId(`doc-${kind}`)).toContainText(`${kind}.pdf`)
  }
}

export const test = base
export { expect }
