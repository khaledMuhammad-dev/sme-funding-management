import { useCallback, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ArrowIcon } from '@/components/icons'
import { useUiStore } from '@/stores/useUiStore'
import { ROUTES } from '../routes'
import heroBgLarge from '@/assets/hero-bg-2000.jpg'
import heroBgSmall from '@/assets/hero-bg-1200.jpg'
import heroBlur from '@/assets/hero-growth-lqip.jpg'
import heroSubjectLarge from '@/assets/hero-subject-1600.png'
import heroSubjectSmall from '@/assets/hero-subject-1000.png'
import coinGold from '@/assets/coin-gold.png'
import coinSilver from '@/assets/coin-silver.png'
import coinCopper from '@/assets/coin-copper.png'

/*
  The source photograph is 4990px wide (1.1 MB) and never displayed above ~2000
  CSS px, so downscaled copies are committed beside it and served through
  `srcSet`; the original stays in `src/assets/` as the master and is not
  imported, so it never enters the bundle. The 28px blur copy is under Vite's
  inline limit and ships as a data URI inside the JS — it paints under the photo
  on the first frame, which is why the hero never flashes an empty scrim.

  The photo ships as two registered halves: `hero-bg-*` is the whole frame with a
  36px gaussian applied (the depth-of-field plate), `hero-subject-*` is a
  full-frame transparent PNG holding only the lifted pot and seedling. Both were
  cut at the same 3:2 crop, so as long as both are rendered into wrappers of
  identical geometry with the same `object-cover` and `object-position`, the
  subject lands back on its own blurred silhouette to the pixel. That is the
  entire alignment strategy — the cutout is never hand-positioned, and any
  divergence between the two layers is a scroll transform, deliberately applied.
*/

/* ── The scroll story ────────────────────────────────────────────────────────

   The hero is a *pinned* scene: the outer <section> is a tall, empty scroll
   track and the scene itself is a `sticky top-0` viewport-sized box inside it.
   Scrolling the track therefore plays the composition instead of carrying it
   off screen — the previous version animated while it left, so the payoff was
   always half out of frame by the time it arrived.

   Everything is driven by one `scrollYProgress` over the track, so the scene is
   a pure function of scroll position: restoring mid-track, arriving from an
   anchor or dragging the scrollbar all land on a correct frame for free, with
   no play/replay state to get out of sync.

   Three overlapping stages:
     0.00 → 0.45  depth — the pot climbs out of its own blurred silhouette,
                  the backdrop sinks, the coins fly.
     0.30 → 0.75  the ghost word sweeps the full width behind the pot while the
                  copy lifts away, leaving the frame as pure image.
     0.70 → 1.00  camera push into the seedling, fading out over the last tenth
                  so the scene hands the page back rather than cutting.            */

/* Track length. Longer reads as a slower, more deliberate story; below `lg` it
   is cut back because a phone's scroll gesture covers far less of the track per
   swipe and 220vh there turns the hero into a chore.

   `dvh`, not `svh`/`lvh`: the sticky box has to match the visible viewport
   *exactly*. `svh` would leave a strip of the next section peeking under the
   scene whenever the mobile URL bar retracts; `lvh` would push the bottom-
   anchored copy off screen whenever it is showing. `dvh` re-resolves as the
   chrome animates, and because every transform is progress-derived the reflow
   cannot strand the scene in a broken frame. */
const TRACK = 'h-[170dvh] lg:h-[220dvh]'
const SCENE = 'sticky top-0 h-[100dvh]'

/* The portal header is `sticky top-0`, so the track starts one header below the
   top of the viewport and cannot reach `start start` until the page has already
   scrolled past it — a dead zone in exactly the stretch where the scene most
   needs to prove it is animating rather than stuck. Anchoring progress 0 to a
   container edge one header down removes it.

   The header is `4rem + 1px` over a `clamp(14px, 1.5vw, 16px)` root (see
   `index.css`), so it is 57–65px depending on viewport width, and the offset
   parser takes px/%/vw/vh but not rem. Erring *under* the smallest of those is
   the safe rounding: progress then reads exactly 0 while the page is at the
   top, which is what keeps the two photo layers pixel-registered at rest, and
   the cost is at most ~9px of dead scroll on the widest screens. */
const SCROLL_START = 'start 56px'

/* Layer order, back to front. The camera-push wrapper carries a transform and
   is therefore its own stacking context, so the depth steps inside it are
   ordinary positive ones; the wrapper takes a single negative step, which is
   what keeps the scrims *between* the photo stack and the copy — the photo can
   be dimmed without dimming the headline standing on it. */
const Z_STAGE = '-z-20'
const Z_SCRIM = '-z-10'
const Z_BACKDROP = 'z-0'
const Z_WORD = 'z-10'
const Z_SUBJECT = 'z-20'
const Z_COINS = 'z-30'

/* Both photo layers start at the same offset so the composition at rest is the
   untouched photograph; scroll is what pulls them apart, hard. The backdrop
   sinks while the subject climbs, and together they open a ~19%-of-wrapper gap
   (≈208px at a 900px viewport) — the separation has to be felt, not inferred.

   The stops are deliberately front-loaded: roughly a third of the whole
   separation is spent in the first tenth of the track. A pinned hero's first
   impression is "the page didn't move", and the only way that reads as
   choreography rather than a stuck scroll is if 80px of wheel already visibly
   splits the photograph in two. After that first burst the rates settle and the
   layers coast to their final offsets.

   The over-scan is what caps the backdrop. Its travel is a percentage of the
   wrapper, and the wrapper is the scene plus twice the over-scan, so keeping
   the bottom edge out of frame means `k ≥ travel·(1 + 2k)` — at 10% travel that
   bottoms out around k = 0.125. 18% is that with room to spare, and it is also
   about the ceiling: past ~24% the wrapper grows taller than the width-fitted
   photo, `object-cover` switches to cropping horizontally, and the framing the
   photo was chosen for starts to zoom. 13% of travel from rest is just inside that.

   The subject is capped by the composition instead. It is a transparent PNG, so
   lifting it reveals the backdrop rather than an edge — but the seedling's tip
   already sits within ~80px of the top of the crop, and the seedling is the
   whole point of the photograph. Climb it far and stage 3 pushes the camera
   into an empty sky above a jar. So the pot lifts about as far as its own rim
   and the backdrop carries most of the separation, which is why the two travels
   are lopsided the way round they are. */
const OVER_SCAN = '-inset-y-[18%]'
const DEPTH_STOPS = [0, 0.1, 0.45, 1] as const
const BACKDROP_Y = ['-4%', '0.5%', '6.5%', '9%'] as const
const SUBJECT_Y = ['-4%', '-6.5%', '-7.8%', '-8%'] as const
const SUBJECT_SCALE = [1, 1.015, 1.04, 1.05] as const
const STILL_4 = ['0%', '0%', '0%', '0%'] as const

/* Coin travel as a fraction of each sprite's own `rise`, on the same
   front-loaded curve as the photo layers. */
const COIN_STOPS = [0, 0.12, 0.5, 1] as const
const COIN_EASE = [0, 0.3, 0.86, 1] as const

/* The crossing. The word rests overlapping the pot, so a leftward sweep wide
   enough to clear the frame takes every glyph behind the cutout and out the
   far edge — a complete pass, not a nudge. It is nudged the other way first, so
   the sweep starts from a standstill rather than mid-flight, and it is measured
   in `vw` because the span's own width changes with the (clamped) font size and
   a percentage would make the travel drift between breakpoints. */
const WORD_STOPS = [0, 0.1, 0.3, 0.75, 1] as const
const WORD_X = ['0vw', '2vw', '6vw', '-78vw', '-88vw'] as const
const WORD_Y = ['0%', '-6%', '-14%', '-30%', '-36%'] as const
const STILL_5 = ['0%', '0%', '0%', '0%', '0%'] as const

/* Copy leaves before the crossing finishes, so the money shot plays over an
   uncluttered frame. It must not begin before the reader has committed to
   scrolling — the CTAs are the point of the page — hence the 0.3 floor. */
const COPY_OUT = [0.3, 0.52] as const
/* Past roughly two-thirds of the fade the copy is too faint to read, let alone
   aim at. */
const COPY_INERT_AT = 0.44

/* Camera push. The origin is the seedling, which by this point in the story has
   climbed and sits above and left of centre; pushing anywhere else would drift
   the sprout out of frame exactly as it becomes the subject. Physical
   percentages on purpose: this tracks the photograph, which is never mirrored.

   The scene then fades over the last tenth. Handing the page back with opacity
   rather than letting the sticky box simply unstick means the next section
   rises into an empty frame instead of shoving a full-strength photograph off
   the top. */
const CAMERA_ORIGIN = '34% 26%'
const CAMERA_SCALE = [1, 1.28] as const
const RELEASE = [0.9, 1] as const

/* Entrance: the eyebrow, headline, lede and buttons arrive in reading order.
   `MotionConfig reducedMotion="user"` in `App.tsx` drops the travel for anyone
   who asked for less motion; the fade is all that remains. */
const COPY_GROUP = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}

const COPY_ITEM = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] as const } },
}

interface CoinSpriteProps {
  src: string
  /* Placement + responsive visibility. Resolved inside a `dir="ltr"` layer, so
     `start-*` is the physical left in both writing directions — the coins are
     scattered against the photograph and must not migrate when the page flips. */
  className: string
  size: number
  /* Scroll travel in px, not the `%` the photo layers use: a percentage here
     would resolve against the sprite's own ~50px box, so even -160% would move
     a coin less than a finger's width. These are the nearest plane and have to
     outrun everything behind them. */
  rise: number
  zoom: number
  /* Pointer travel in px at the far edge of the scene. Larger = nearer the
     viewer, which is why it tracks the sprite's blur and opacity. */
  depth: number
  spin: number
  duration: number
  delay: number
  progress: MotionValue<number>
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  reduced: boolean | null
}

/**
 * One floating coin. Three transforms have to coexist on the same sprite —
 * scroll parallax, pointer parallax and an idle drift — and Framer Motion lets
 * one `y` win per element, so each gets its own nested node instead of fighting
 * over the same style.
 */
function CoinSprite({
  src,
  className,
  size,
  rise,
  zoom,
  depth,
  spin,
  duration,
  delay,
  progress,
  pointerX,
  pointerY,
  reduced,
}: CoinSpriteProps) {
  const scrollY = useTransform(
    progress,
    [...COIN_STOPS],
    reduced ? COIN_STOPS.map(() => 0) : COIN_EASE.map((f) => f * rise),
  )
  const scrollScale = useTransform(
    progress,
    [...COIN_STOPS],
    reduced ? COIN_STOPS.map(() => 1) : COIN_EASE.map((f) => 1 + f * (zoom - 1)),
  )
  const offsetX = useTransform(pointerX, (v) => v * depth)
  const offsetY = useTransform(pointerY, (v) => v * depth)

  return (
    <motion.div style={{ y: scrollY, scale: scrollScale }} className={className}>
      <motion.div style={reduced ? undefined : { x: offsetX, y: offsetY }}>
        <motion.img
          src={src}
          alt=""
          aria-hidden="true"
          width={size}
          height={size}
          decoding="async"
          loading="lazy"
          style={{ width: size, height: size }}
          className="select-none"
          animate={reduced ? undefined : { y: [0, -9, 0], rotate: [0, spin, 0] }}
          transition={{ duration, delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </motion.div>
  )
}

/**
 * Portal hero: a full-bleed photograph of a seedling growing out of a jar of
 * coins — the programme's promise in one frame — rebuilt as a pinned depth
 * stack that plays as a three-stage scroll story, with the headline and calls
 * to action laid over its opening frame.
 *
 * ## Why the layout is pinned physically, not logically
 *
 * The subject occupies the left half of the frame and the open wall fills the
 * right. Copy has to sit in that open half, and the photograph must not be
 * mirrored to achieve it — a flipped photograph is a different (and wrong)
 * photograph. So the copy stays on the physical right in both writing
 * directions: `dir="ltr"` on the layout wrapper alone makes `ms-auto` resolve
 * to the right-hand side whatever the page direction is, and the copy block
 * restores the real direction for its own text, so Arabic still sets
 * right-to-left and the CTA arrow still flips.
 *
 * In Arabic this lands the copy at the reading-start edge — the classic hero.
 * In English it reads as an image-left hero. Both are compositions the photo
 * was cropped for; neither overlaps the seedling.
 *
 * The same `dir="ltr"` device pins the decorative layers — the ghost word and
 * the coins. They are registered against the photograph, not against the text:
 * the word only reads as depth while the pot cuts across it, and that crossing
 * point is a fact about the image. Mirroring them would move the word out from
 * behind the pot and lose the effect the layer exists for.
 *
 * ## Reduced motion
 *
 * Not a slower story — no story. Pinning is itself motion the reader did not
 * ask for (the page stops responding to scroll for two viewports), so the track
 * collapses to an ordinary-height section and every transform resolves to its
 * rest value: the untouched photograph with the copy on it.
 */
export function LandingHero() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const reduced = useReducedMotion()
  const trackRef = useRef<HTMLElement>(null)

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: [SCROLL_START, 'end end'],
  })

  const depth = [...DEPTH_STOPS]
  const backdropY = useTransform(scrollYProgress, depth, [...(reduced ? STILL_4 : BACKDROP_Y)])
  const subjectY = useTransform(scrollYProgress, depth, [...(reduced ? STILL_4 : SUBJECT_Y)])
  const subjectScale = useTransform(
    scrollYProgress,
    depth,
    reduced ? DEPTH_STOPS.map(() => 1) : [...SUBJECT_SCALE],
  )

  const wordX = useTransform(scrollYProgress, [...WORD_STOPS], [...(reduced ? STILL_5 : WORD_X)])
  const wordY = useTransform(scrollYProgress, [...WORD_STOPS], [...(reduced ? STILL_5 : WORD_Y)])

  const copyOpacity = useTransform(scrollYProgress, [...COPY_OUT], reduced ? [1, 1] : [1, 0])
  const copyY = useTransform(scrollYProgress, [...COPY_OUT], reduced ? [0, 0] : [0, -72])
  /* The faded copy still occupies the frame, and an invisible CTA that swallows
     clicks is worse than no CTA — drop it out of the hit-testing the moment it
     is no longer readable. */
  const copyPointer = useTransform(scrollYProgress, (p) =>
    reduced || p < COPY_INERT_AT ? 'auto' : 'none',
  )

  const cameraScale = useTransform(
    scrollYProgress,
    [0.7, 1],
    reduced ? [1, 1] : [...CAMERA_SCALE],
  )
  const sceneOpacity = useTransform(scrollYProgress, [...RELEASE], reduced ? [1, 1] : [1, 0])

  /* Pointer parallax. Normalised to −0.5…0.5 across the scene so each sprite
     can scale it by its own depth, then springed — the raw value is a step
     function of mouse samples and reads as jitter without it. */
  const pointerX = useMotionValue(0)
  const pointerY = useMotionValue(0)
  const springX = useSpring(pointerX, { stiffness: 60, damping: 18, mass: 0.6 })
  const springY = useSpring(pointerY, { stiffness: 60, damping: 18, mass: 0.6 })

  /* Touch devices synthesise a single pointermove on tap, which would jolt the
     coins once and leave them parked off-centre. Gate on a real hovering mouse. */
  const finePointer = useRef(false)
  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)')
    finePointer.current = query.matches
    const onChange = (event: MediaQueryListEvent) => {
      finePointer.current = event.matches
      if (!event.matches) {
        pointerX.set(0)
        pointerY.set(0)
      }
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [pointerX, pointerY])

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!finePointer.current || reduced) return
      const rect = event.currentTarget.getBoundingClientRect()
      pointerX.set((event.clientX - rect.left) / rect.width - 0.5)
      pointerY.set((event.clientY - rect.top) / rect.height - 0.5)
    },
    [pointerX, pointerY, reduced],
  )

  const handlePointerLeave = useCallback(() => {
    pointerX.set(0)
    pointerY.set(0)
  }, [pointerX, pointerY])

  return (
    <section
      ref={trackRef}
      data-testid="landing-hero"
      data-pinned={reduced ? 'false' : 'true'}
      className={`relative w-full ${reduced ? '' : TRACK}`}
    >
      <motion.div
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={reduced ? undefined : { opacity: sceneOpacity }}
        className={`relative isolate flex w-full items-end overflow-hidden lg:items-center ${
          reduced ? 'min-h-[32rem] sm:min-h-[36rem] lg:min-h-[41rem]' : SCENE
        }`}
      >
        {/* ── Camera stage: layers 1–4, pushed as one at the end of the story ── */}
        <motion.div
          style={reduced ? undefined : { scale: cameraScale, transformOrigin: CAMERA_ORIGIN }}
          className={`absolute inset-0 ${Z_STAGE}`}
        >
          {/* ── 1. Depth-of-field backdrop ───────────────────────────────── */}
          <motion.div
            aria-hidden="true"
            style={{ y: backdropY }}
            className={`absolute inset-x-0 ${OVER_SCAN} ${Z_BACKDROP}`}
          >
            <motion.img
              src={heroBgLarge}
              srcSet={`${heroBgSmall} 1200w, ${heroBgLarge} 2000w`}
              sizes="100vw"
              width={2000}
              height={1333}
              // Above the fold on every viewport: the first thing painted.
              loading="eager"
              fetchPriority="high"
              decoding="async"
              alt=""
              style={{ backgroundImage: `url(${heroBlur})` }}
              className="size-full bg-cover bg-center object-cover object-[30%_45%] lg:object-[24%_50%]"
              // Ken Burns: a slow breath in and out, never a visible "start".
              animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
              transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>

          {/* ── 2. Ghost word ────────────────────────────────────────────── */}
          {/* The layer that sells the depth: the pot cuts across the word, which
              is only possible because the word is behind the cutout and in front
              of the blur. Outline rather than fill, in a `--foreground`-derived
              colour, so one declaration stays subtle over the photograph in both
              themes. */}
          <div
            dir="ltr"
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 flex items-center overflow-hidden ${Z_WORD}`}
          >
            <motion.span
              data-testid="hero-word"
              style={{
                y: wordY,
                x: wordX,
                fontSize: 'clamp(4.5rem, 16vw, 17rem)',
                color: 'transparent',
                /* Heavier than it was when a readability scrim was permanently
                   washing this half of the frame out. Now that the scrim leaves
                   with the copy, the word crosses over the photograph at full
                   strength and 30%/1.5px disappeared into it. */
                WebkitTextStroke: '2px color-mix(in oklch, var(--foreground) 38%, transparent)',
              }}
              className="ms-[1vw] whitespace-nowrap font-semibold uppercase leading-none tracking-tight"
            >
              {t('landing.heroWord')}
            </motion.span>
          </div>

          {/* ── 3. Lifted subject ────────────────────────────────────────── */}
          {/* Wrapper geometry, `object-cover` and `object-position` are copied
              verbatim from the backdrop — that is what registers the cutout.
              Only the scroll transforms differ. */}
          <motion.div
            data-testid="hero-subject"
            style={{ y: subjectY, scale: subjectScale }}
            className={`absolute inset-x-0 ${OVER_SCAN} ${Z_SUBJECT}`}
          >
            <img
              src={heroSubjectLarge}
              srcSet={`${heroSubjectSmall} 1000w, ${heroSubjectLarge} 1600w`}
              sizes="100vw"
              width={1600}
              height={1067}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              alt={t('landing.heroAlt')}
              className="size-full object-cover object-[30%_45%] lg:object-[24%_50%]"
            />
          </motion.div>

          {/* ── 4. Coin sprites ──────────────────────────────────────────── */}
          {/* In front of the subject. Blur and opacity are graded with the
              parallax rates: the fastest coin is the sharpest and the nearest.

              They are scattered across the plain wall to the physical left of
              the copy, not over it. The right half is "open" only in the
              photograph — on wide screens it is exactly where the headline
              stands, and a sprite placed there lands behind the copy scrim and
              disappears. Coins on the jar itself vanish too, into the coins
              already in it. */}
          <div
            dir="ltr"
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 ${Z_COINS}`}
          >
            <CoinSprite
              src={coinGold}
              className="absolute start-[17%] top-[54%] opacity-80"
              size={54}
              rise={-520}
              zoom={1.28}
              depth={14}
              spin={9}
              duration={7}
              delay={0}
              progress={scrollYProgress}
              pointerX={springX}
              pointerY={springY}
              reduced={reduced}
            />
            <CoinSprite
              src={coinSilver}
              className="absolute hidden start-[8%] top-[19%] opacity-60 blur-[1px] sm:block"
              size={44}
              rise={-380}
              zoom={1.2}
              depth={10}
              spin={-7}
              duration={9}
              delay={0.8}
              progress={scrollYProgress}
              pointerX={springX}
              pointerY={springY}
              reduced={reduced}
            />
            {/* Only above `lg`: below it the copy climbs the frame and this one
                starts competing with the eyebrow. */}
            <CoinSprite
              src={coinCopper}
              className="absolute hidden start-[41%] top-[14%] opacity-50 blur-[2px] lg:block"
              size={38}
              rise={-280}
              zoom={1.14}
              depth={6}
              spin={6}
              duration={11}
              delay={1.6}
              progress={scrollYProgress}
              pointerX={springX}
              pointerY={springY}
              reduced={reduced}
            />
          </div>
        </motion.div>

        {/* ── 5. Scrims ──────────────────────────────────────────────────────
            Three jobs: sink the photo a step in dark mode, hand the headline a
            readable field, and dissolve the top and bottom edges into the page
            so the hero reads as part of the page rather than a pasted-in box.
            They are outside the camera stage on purpose — the edge dissolve has
            to stay glued to the frame while the photograph pushes past it. */}
        <div aria-hidden="true" className={`absolute inset-0 bg-transparent dark:bg-background/35 ${Z_SCRIM}`} />
        {/* The two readability fields exist *for* the copy, so they leave with
            it — held at full strength they turn stage 2 into a washed-out half
            frame around a photograph that is supposed to have taken the screen
            over. Narrow screens: the copy sits at the foot, so the field is
            vertical. */}
        <motion.div
          aria-hidden="true"
          style={reduced ? undefined : { opacity: copyOpacity }}
          className={`absolute inset-0 bg-gradient-to-t from-background via-background/88 via-40% to-background/5 lg:hidden ${Z_SCRIM}`}
        />
        {/* Wide screens: the field comes in from the open right half only, so the
            seedling stays uncovered. Physical direction on purpose — it has to
            track the physically pinned copy, not the writing direction. */}
        <motion.div
          aria-hidden="true"
          style={reduced ? undefined : { opacity: copyOpacity }}
          className={`absolute inset-0 hidden bg-gradient-to-l from-background via-background/90 via-38% to-transparent lg:block ${Z_SCRIM}`}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/80 to-transparent ${Z_SCRIM}`}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background to-transparent ${Z_SCRIM}`}
        />

        {/* ── 6. Copy ────────────────────────────────────────────────────── */}
        <motion.div
          dir="ltr"
          data-testid="hero-copy"
          style={reduced ? undefined : { opacity: copyOpacity, y: copyY, pointerEvents: copyPointer }}
          className="relative flex w-full max-w-6xl px-4 pb-14 pt-28 sm:px-6 lg:mx-auto lg:py-24"
        >
          {/* The auto margin has to live on an element that is still `ltr`:
              `margin-inline-start` resolves against the element's *own*
              direction, so putting it on the Arabic block would push the copy
              left, straight over the seedling. */}
          <div className="w-full lg:ms-auto lg:w-[47%] lg:min-w-[26rem]">
            <motion.div
              dir={lang === 'ar' ? 'rtl' : 'ltr'}
              variants={COPY_GROUP}
              initial="hidden"
              animate="show"
              className="space-y-6 text-start"
            >
              <motion.span
                variants={COPY_ITEM}
                className="inline-flex items-center gap-2 rounded-full border border-gold bg-gold-soft px-3 py-1 text-xs font-semibold text-gold-ink shadow-soft-sm"
              >
                <span className="size-1.5 rounded-full bg-gold-ink" />
                {t('landing.eyebrow')}
              </motion.span>

              <motion.h1
                variants={COPY_ITEM}
                className="text-4xl font-semibold leading-[1.12] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]"
              >
                {t('landing.title')}
              </motion.h1>

              <motion.p
                variants={COPY_ITEM}
                className="max-w-xl text-lg leading-relaxed text-muted-foreground"
              >
                {t('landing.subtitle')}
              </motion.p>

              <motion.div variants={COPY_ITEM} className="flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="border border-terracotta-ink bg-terracotta text-terracotta-foreground shadow-soft-md hover:bg-terracotta/90"
                >
                  <Link to={ROUTES.apply}>
                    {t('landing.ctaApply')}
                    <ArrowIcon size={17} className="rtl-flip" />
                  </Link>
                </Button>
                {/* Opaque, not `variant="outline"`'s translucency: it is standing
                    on a photograph, and a see-through button there reads as
                    broken. */}
                <Button asChild size="lg" variant="outline" className="bg-background/85 backdrop-blur-sm">
                  <Link to={ROUTES.track}>{t('landing.ctaTrack')}</Link>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
