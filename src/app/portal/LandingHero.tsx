import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ArrowIcon } from '@/components/icons'
import { useUiStore } from '@/stores/useUiStore'
import { ROUTES } from '../routes'
import heroLarge from '@/assets/hero-growth-2000.jpg'
import heroSmall from '@/assets/hero-growth-1200.jpg'
import heroBlur from '@/assets/hero-growth-lqip.jpg'

/*
  The source photograph is 4990px wide (1.1 MB) and never displayed above ~2000
  CSS px, so two downscaled copies are committed beside it and served through
  `srcSet`; the original stays in `src/assets/` as the master and is not
  imported, so it never enters the bundle. The 28px blur copy is under Vite's
  inline limit and ships as a data URI inside the JS — it paints under the photo
  on the first frame, which is why the hero never flashes an empty scrim.
*/

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

/**
 * Portal hero: a full-bleed photograph of a seedling growing out of a jar of
 * coins — the programme's promise in one frame — with the headline and calls to
 * action laid over it.
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
 */
export function LandingHero() {
  const { t } = useTranslation()
  const lang = useUiStore((s) => s.lang)
  const reduced = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  // Parallax: the photograph drifts a little slower than the page it sits in.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const parallaxY = useTransform(
    scrollYProgress,
    [0, 1],
    reduced ? ['0%', '0%'] : ['-5%', '7%'],
  )

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-[32rem] w-full items-end overflow-hidden sm:min-h-[36rem] lg:min-h-[41rem] lg:items-center"
    >
      {/* ── The photograph ───────────────────────────────────────────────── */}
      {/* Taller than the section by 10% top and bottom, so the parallax drift
          never pulls an edge into view. */}
      <motion.div style={{ y: parallaxY }} className="absolute inset-x-0 -inset-y-[10%] -z-10">
        <motion.img
          src={heroLarge}
          srcSet={`${heroSmall} 1200w, ${heroLarge} 2000w`}
          sizes="100vw"
          width={2000}
          height={1333}
          // Above the fold on every viewport: the first thing painted.
          loading="eager"
          fetchPriority="high"
          decoding="async"
          alt={t('landing.heroAlt')}
          style={{ backgroundImage: `url(${heroBlur})` }}
          className="size-full bg-cover bg-center object-cover object-[30%_45%] lg:object-[24%_50%]"
          // Ken Burns: a slow breath in and out, never a visible "start".
          animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>

      {/* ── Scrims ───────────────────────────────────────────────────────────
          Three jobs: sink the photo a step in dark mode, hand the headline a
          readable field, and dissolve the top and bottom edges into the page so
          the hero reads as part of the page rather than a pasted-in box. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-transparent dark:bg-background/35" />
      {/* Narrow screens: the copy sits at the foot, so the field is vertical. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/88 via-40% to-background/5 lg:hidden"
      />
      {/* Wide screens: the field comes in from the open right half only, so the
          seedling stays uncovered. Physical direction on purpose — it has to
          track the physically pinned copy, not the writing direction. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 hidden bg-gradient-to-l from-background via-background/90 via-38% to-transparent lg:block"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-background/80 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-28 bg-gradient-to-t from-background to-transparent"
      />

      {/* ── Copy ─────────────────────────────────────────────────────────── */}
      <div
        dir="ltr"
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
            {/* Opaque, not `variant="outline"`'s translucency: it is standing on
                a photograph, and a see-through button there reads as broken. */}
            <Button asChild size="lg" variant="outline" className="bg-background/85 backdrop-blur-sm">
              <Link to={ROUTES.track}>{t('landing.ctaTrack')}</Link>
            </Button>
          </motion.div>
        </motion.div>
        </div>
      </div>
    </section>
  )
}
