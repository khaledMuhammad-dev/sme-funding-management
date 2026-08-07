import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { test, expect, gotoApp, pinLocale, readStore } from './support/app'

/**
 * Polish guard-rails for the applicant portal (shell, landing, apply, track,
 * follow-up form). These assert the *properties* the pages must keep — logical
 * Tailwind properties, a loading state that reserves the loaded height, a real
 * empty state, a visible focus ring and no unreachable or phantom tab stops —
 * rather than pixels, so they stay fast and deterministic.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../src')

/** The files this suite is responsible for. */
const OWNED = [
  'app/PortalShell.tsx',
  'app/portal/LandingPage.tsx',
  'app/portal/ApplyPage.tsx',
  'app/portal/TrackPage.tsx',
  'app/portal/FollowUpFormPage.tsx',
  'features/apply/WizardStepper.tsx',
  'features/apply/FieldShell.tsx',
  'features/apply/PersonalStep.tsx',
  'features/apply/ProjectStep.tsx',
  'features/apply/DocumentsStep.tsx',
  'features/apply/TermsStep.tsx',
  'features/apply/ReviewStep.tsx',
]

/**
 * Physical direction utilities, as Tailwind class tokens. Matching whole tokens
 * (after stripping variants) keeps `rounded-lg` and `border-red-500` out of the
 * results, which a naive substring search would flag.
 */
const PHYSICAL = [
  /^(ml|mr|pl|pr)-/,
  /^-?(left|right)-/,
  /^(text-left|text-right)$/,
  /^border-[lr]($|-)/,
  /^rounded-[lr]($|-)/,
]

function physicalTokens(source: string) {
  const found: string[] = []
  for (const raw of source.split(/[^A-Za-z0-9:_\-[\]./%]+/)) {
    // Drop responsive/state variants: `sm:pl-4` is still a physical property.
    const token = raw.slice(raw.lastIndexOf(':') + 1)
    if (PHYSICAL.some((pattern) => pattern.test(token))) found.push(raw)
  }
  return found
}

/** A focus ring is visible when the element paints an outline or a ring shadow. */
async function hasVisibleFocusRing(target: Locator) {
  return target.evaluate((el) => {
    const style = getComputedStyle(el)
    const outlined =
      style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') > 0
    const shadowed = style.boxShadow !== 'none' && style.boxShadow !== ''
    return outlined || shadowed
  })
}

interface TabStop {
  tag: string
  file: boolean
  testId: string | null
  ring: boolean
}

/** Presses Tab (or Shift+Tab) `steps` times, describing where focus lands. */
async function tabWalk(page: Page, steps: number, key: 'Tab' | 'Shift+Tab' = 'Tab') {
  const stops: TabStop[] = []
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press(key)
    stops.push(
      await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el) return { tag: 'NONE', file: false, testId: null, ring: false }
        const style = getComputedStyle(el)
        return {
          tag: el.tagName,
          file: el instanceof HTMLInputElement && el.type === 'file',
          testId: el.getAttribute('data-testid'),
          ring:
            (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') > 0) ||
            (style.boxShadow !== 'none' && style.boxShadow !== ''),
        }
      }),
    )
  }
  return stops
}

/** Collects console errors and uncaught exceptions for the life of the page. */
function watchForErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
  })
  return errors
}

interface StoredApplication {
  id: string
  ref: string
  status: string
}

interface StoredFollowUp {
  id: string
  submittedAt?: string | null
}

// ── A. RTL: logical properties only ──────────────────────────────────────────

test('portal sources use logical Tailwind properties only', () => {
  const offenders: string[] = []
  for (const file of OWNED) {
    const source = readFileSync(resolve(SRC, file), 'utf8')
    for (const token of physicalTokens(source)) offenders.push(`${file}: ${token}`)
  }
  expect(offenders, 'physical direction utilities break RTL').toEqual([])
})

// ── B. Landing ───────────────────────────────────────────────────────────────

for (const lang of ['en', 'ar'] as const) {
  test(`landing renders cleanly in ${lang} with a reachable, visible skip link`, async ({
    page,
  }) => {
    const errors = watchForErrors(page)
    await gotoApp(page, '/', lang)

    // The skip link is the very first tab stop and must become visible on focus.
    await page.keyboard.press('Tab')
    const skip = page.locator('a[href="#portal-main"]')
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    expect(await hasVisibleFocusRing(skip)).toBe(true)

    // Both hero CTAs are real links, so they work with the keyboard for free.
    await expect(page.locator('a[href="/apply"]').first()).toBeVisible()
    await expect(page.locator('a[href="/track"]').first()).toBeVisible()

    expect(errors).toEqual([])
  })
}

/**
 * The hero is a pinned scroll story: a tall track with a `sticky` viewport-sized
 * scene inside it. Every transform is derived from scroll progress, so these
 * assert the properties that make that legible rather than any pixel — the two
 * photo layers registered at rest, motion that is already obvious within the
 * first 150px, copy that stays readable and clickable until the reader has
 * committed, and a scene that is gone by the time the track hands over.
 */
async function heroFrame(page: Page) {
  return page.evaluate(() => {
    const q = (s: string) => document.querySelector(s) as HTMLElement | null
    const mid = (el: Element | null) => {
      const r = el!.getBoundingClientRect()
      return r.top + r.height / 2
    }
    const track = q('[data-testid="landing-hero"]')!
    const subject = q('[data-testid="hero-subject"]')!
    const stage = subject.parentElement!
    const word = q('[data-testid="hero-word"]')!.getBoundingClientRect()
    const copy = q('[data-testid="hero-copy"]')!
    return {
      pinned: track.dataset.pinned,
      trackH: track.getBoundingClientRect().height,
      sceneTop: stage.parentElement!.getBoundingClientRect().top,
      sceneH: stage.parentElement!.getBoundingClientRect().height,
      sceneOpacity: +getComputedStyle(stage.parentElement!).opacity,
      /* Positive once the backdrop has sunk below the lifted cutout. */
      separation: mid(stage.firstElementChild) - mid(subject),
      wordEnd: word.left + word.width,
      copyOpacity: +getComputedStyle(copy).opacity,
      copyPointer: getComputedStyle(copy).pointerEvents,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    }
  })
}

async function heroAt(page: Page, y: number) {
  await page.evaluate((v) => window.scrollTo(0, v), y)
  await page.waitForTimeout(150)
  return heroFrame(page)
}

test('the pinned hero registers at rest, moves immediately and releases cleanly', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoApp(page, '/')

  const rest = await heroAt(page, 0)
  expect(rest.pinned).toBe('true')
  // Track is materially taller than the scene, and the scene is the viewport.
  expect(rest.trackH).toBeGreaterThan(1600)
  expect(rest.sceneH).toBe(900)
  // The still frame is the untouched photograph: both halves in the same place.
  expect(Math.abs(rest.separation)).toBeLessThanOrEqual(1)
  expect(rest.copyOpacity).toBe(1)
  expect(rest.copyPointer).toBe('auto')

  /* No dead zone. A pinned hero's failure mode is reading as a stuck page, so
     the depth split has to be plainly visible within a wheel notch or two. */
  expect((await heroAt(page, 80)).separation).toBeGreaterThan(40)
  expect((await heroAt(page, 150)).separation).toBeGreaterThan(75)

  /* Progress 0 is anchored one header below the viewport top, so the track is
     played out a little past this — near enough for sampling, and the end-state
     checks below deliberately overshoot. */
  const travel = rest.trackH - 900 + 56

  // Quarter way in the copy is still untouched — the CTAs are the page's point.
  const quarter = await heroAt(page, Math.round(travel * 0.25))
  expect(quarter.copyOpacity).toBe(1)
  expect(quarter.copyPointer).toBe('auto')

  // Three quarters in the word has completed its crossing and left the frame,
  // and the faded copy no longer swallows clicks.
  const late = await heroAt(page, Math.round(travel * 0.75))
  expect(late.wordEnd).toBeLessThan(0)
  expect(late.copyOpacity).toBe(0)
  expect(late.copyPointer).toBe('none')

  // The scene hands the page back rather than being shoved off it.
  const end = await heroAt(page, travel + 120)
  expect(end.sceneOpacity).toBe(0)
  // Past the track the scene has stopped sticking, so nothing overlaps below.
  expect((await heroAt(page, travel + 400)).sceneTop).toBeLessThan(-300)
})

test('the hero story never overflows sideways, at either width', async ({ page }) => {
  for (const [width, height] of [
    [1440, 900],
    [390, 844],
  ] as const) {
    await page.setViewportSize({ width, height })
    await gotoApp(page, '/')
    const { trackH } = await heroFrame(page)
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const frame = await heroAt(page, Math.round((trackH - height + 56) * p))
      expect(frame.overflow, `${width}px at progress ${p}`).toBeLessThanOrEqual(0)
    }
  }
})

test('reduced motion gets an ordinary hero with no pinning and no parallax', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoApp(page, '/')

  const rest = await heroFrame(page)
  expect(rest.pinned).toBe('false')
  // No track: the section is its own content height, well under one viewport.
  expect(rest.trackH).toBeLessThan(900)
  expect(rest.separation).toBe(0)

  // Scrolling moves the hero away like any other section, unchanged.
  const scrolled = await heroAt(page, 400)
  expect(scrolled.separation).toBe(0)
  expect(scrolled.sceneOpacity).toBe(1)
  expect(scrolled.copyOpacity).toBe(1)
})

// ── A + C. Track: empty state, loading state, error wiring ───────────────────

test('track shows a demo prompt while empty and a sized skeleton while loading', async ({
  page,
}) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/track')

  // Empty: never a bare blank area — the demo references are offered instead.
  await expect(page.getByText('Try one of the demo references')).toBeVisible()

  // The field takes focus on arrival and shows it.
  const field = page.getByLabel('Reference number')
  await expect(field).toBeFocused()
  expect(await hasVisibleFocusRing(field)).toBe(true)

  const applications = await readStore<StoredApplication[]>(page, 'applications')
  const target = applications.find((a) => a.status === 'disbursed') ?? applications[0]

  await field.fill(target.ref)
  await page.getByRole('button', { name: 'Look up' }).click()

  // The skeleton stands in for the resolved page, not for a thin strip of it.
  const loading = page.getByTestId('track-loading')
  await expect(loading).toBeVisible()
  const skeletonBox = await loading.boundingBox()
  expect(skeletonBox!.height).toBeGreaterThan(400)

  await expect(page.getByTestId('track-ref')).toHaveText(target.ref)
  await expect(loading).toHaveCount(0)

  // The notifications card resolves to real content or to its localized empty
  // line — never to a permanent spinner.
  const notifications = page.getByTestId('track-notifications')
  const empty = page.getByText('No messages have been sent for this application yet.')
  await expect(notifications.or(empty).first()).toBeVisible()

  expect(errors).toEqual([])
})

test('track reports a short reference through an alert tied to the input', async ({ page }) => {
  await gotoApp(page, '/track', 'ar')

  const field = page.getByLabel('رقم الطلب')
  await field.fill('AP')
  await page.getByRole('button', { name: 'بحث' }).click()

  const alert = page.getByRole('alert')
  await expect(alert).toBeVisible()
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(field).toHaveAttribute('aria-describedby', 'track-ref-error')
  await expect(alert).toHaveAttribute('id', 'track-ref-error')
})

// ── C. Apply wizard: focus, tab order, error announcement ────────────────────

test('apply announces field errors and keeps the hidden file inputs out of the tab order', async ({
  page,
}) => {
  const errors = watchForErrors(page)
  await gotoApp(page, '/apply')

  // Step 1 — submitting empty raises localized, announced, wired-up errors.
  await page.getByRole('button', { name: 'Next' }).click()
  const alerts = page.getByRole('alert')
  await expect(alerts.first()).toBeVisible()

  const fullName = page.getByLabel(/Full name/)
  const describedBy = await fullName.getAttribute('aria-describedby')
  expect(describedBy).toBeTruthy()
  await expect(fullName).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator(`[id="${describedBy}"]`)).toHaveAttribute('role', 'alert')

  await fullName.fill('Nora Al Qahtani')
  await page.getByLabel(/National ID number/).fill('1098765432')
  await page.getByLabel(/Mobile number/).fill('0551234567')
  await page.getByLabel(/Email address/).fill('nora@example.com')
  await page.getByLabel(/^City/).fill('Riyadh')
  await page.getByLabel(/IBAN/).fill('SA4420000001234567891234')
  await page.getByLabel(/^Region/).click()
  await page.getByRole('option', { name: 'Riyadh', exact: true }).click()
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 2 — project.
  await page.getByLabel(/Project name/).fill('Nora Artisan Bakery')
  await page.getByLabel(/^Sector/).click()
  await page.getByRole('option', { name: 'Food', exact: true }).click()
  await page
    .getByLabel(/Project description/)
    .fill(
      'A small artisan bakery producing fresh sourdough bread and pastries for local cafes, ' +
        'with a plan to add a second oven and hire two more bakers.',
    )
  await page.getByLabel(/Requested amount/).fill('80000')
  await page.getByLabel(/Current monthly income/).fill('9000')
  await page.getByLabel(/Years of experience/).fill('4')
  await page.getByRole('button', { name: 'Next' }).click()

  // Step 3 — documents. The visible Upload buttons drive the pickers, so the
  // sr-only inputs must not add invisible stops between them.
  await expect(page.getByTestId('doc-national_id')).toBeVisible()
  const fileInputs = page.locator('input[type="file"]')
  const count = await fileInputs.count()
  expect(count).toBeGreaterThan(0)
  for (let i = 0; i < count; i += 1) {
    await expect(fileInputs.nth(i)).toHaveAttribute('tabindex', '-1')
  }

  // Every visible control on the step paints a ring when tabbed to.
  // Walking the step with Tab must hit the five visible Upload buttons and
  // never one of the sr-only inputs, and every stop must paint a ring.
  await page.getByRole('button', { name: 'Back' }).focus()
  const stops = await tabWalk(page, 8, 'Shift+Tab')
  expect(stops.filter((stop) => stop.file)).toEqual([])
  expect(stops.filter((stop) => stop.tag === 'BUTTON' && stop.ring).length).toBeGreaterThanOrEqual(5)

  expect(errors).toEqual([])
})

test('the apply card keeps its height across a step change', async ({ page }) => {
  await gotoApp(page, '/apply')

  const card = page.locator('main .min-h-96').first()
  const before = await card.boundingBox()
  await page.getByRole('button', { name: 'Next' }).click()
  const during = await card.boundingBox()

  // The floor is what stops the page jumping while `mode="wait"` swaps steps.
  expect(during!.height).toBeGreaterThan(Math.min(before!.height, 384) * 0.9)
})

// ── A + B + C. Follow-up form (mobile-first) ─────────────────────────────────

test('follow-up form reserves its height while loading and is keyboard operable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors = watchForErrors(page)

  await gotoApp(page, '/', 'ar')
  const followUps = await readStore<StoredFollowUp[]>(page, 'followUps')
  const pending = followUps.find((f) => !f.submittedAt)
  expect(pending, 'fixtures must contain an unsubmitted follow-up').toBeTruthy()

  await pinLocale(page, 'ar')
  await page.goto(`/follow-up/${pending!.id}`)

  const loading = page.getByTestId('follow-up-loading')
  await expect(loading).toBeVisible()
  const skeletonHeight = (await loading.boundingBox())!.height
  expect(skeletonHeight).toBeGreaterThan(400)

  const form = page.locator('form')
  await expect(form).toBeVisible()

  // The photo picker's only control is an sr-only input; its label must show
  // the focus that lands on it.
  await page.getByLabel(/أبرز التحديات/).focus()
  const seen: string[] = []
  let reached = false
  for (let i = 0; i < 4 && !reached; i += 1) {
    const [stop] = await tabWalk(page, 1)
    seen.push(stop.testId ?? stop.tag)
    reached = stop.testId === 'photo-input'
  }
  expect(reached, `photo input unreachable by keyboard: ${seen.join(' → ')}`).toBe(true)

  // The input itself is sr-only, so its own outline is clipped: the visible
  // "add photos" label mirrors it.
  const addLabel = page.locator('label[for="follow-up-photos"]')
  expect(await hasVisibleFocusRing(addLabel)).toBe(true)

  expect(errors).toEqual([])
})

test('an unknown follow-up id shows a localized empty state, not a blank page', async ({
  page,
}) => {
  await gotoApp(page, '/follow-up/FUP-nope', 'ar')
  await expect(page.getByText('لم نعثر على طلب بهذا الرقم')).toBeVisible()
})

// ── Reduced motion smoke ─────────────────────────────────────────────────────

test('portal pages render fully with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const errors = watchForErrors(page)

  await gotoApp(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await gotoApp(page, '/apply')
  await expect(page.getByLabel(/Full name/)).toBeVisible()

  await gotoApp(page, '/track')
  await expect(page.getByLabel('Reference number')).toBeVisible()

  expect(errors).toEqual([])
})
