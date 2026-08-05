import { useCallback, useEffect, useRef } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import type { Transition } from 'framer-motion'
import { useMorphHost } from './MorphIcon'
import type { MorphIconProps } from './MorphIcon'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/gsap'

/**
 * The bell, drawn as two parts so it can actually be rung.
 *
 * Body and clapper are separate paths sharing one pivot at the crown. On hover
 * a quick strike throws the clapper out (one fast, eased-out impulse) and the
 * body swings *against* it a beat later; from there both settle as a pendulum
 * does — half-periods of near-constant duration while the amplitude decays,
 * easing in and out at each extreme. The constant period plus the
 * counter-rotation is what reads as a ring rather than as an icon being
 * wobbled.
 *
 * Rotation is Framer Motion's job; GSAP is reserved for SVG path morphing, so
 * nothing here touches it.
 */

/** Pivot at the crown: both parts hang from the same point, as a real bell does. */
const PIVOT = '12px 5px'

/**
 * Decaying swing, nine points / eight segments. The clapper is the light part
 * being thrown, so it travels furthest; the heavy body reacts against it and
 * trails behind.
 */
const CLAPPER_SWING = [0, 18, -15, 12, -9, 6.5, -4, 2, 0]
const BODY_SWING = [0, -8, 7, -5.5, 4, -3, 2, -1, 0]

/**
 * Only the strike is quick. After it the half-periods stay near-equal, because
 * a pendulum's period does not shorten as its amplitude decays.
 */
const SWING_TIMES = [0, 0.09, 0.21, 0.33, 0.45, 0.57, 0.7, 0.84, 1]

/** One ease per segment: the impulse eases out, every swing after it eases both ends. */
const SWING_EASE: Transition['ease'] = [
  'easeOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
]

const SWING_MS = 1200

export interface BellIconProps extends Omit<MorphIconProps, 'paths'> {
  /** Rings once, unprompted — used when a message actually arrives. */
  ringing?: boolean
}

export function BellIcon({
  active = false,
  size = 20,
  strokeWidth = 1.8,
  className,
  title,
  trigger = 'host',
  ringing = false,
}: BellIconProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const hovered = useMorphHost(svgRef, trigger)
  const reduced = useReducedMotion() || prefersReducedMotion()

  const clapper = useAnimationControls()
  const body = useAnimationControls()

  /*
    One swing per hover. `armed` gates re-entry so holding the pointer still —
    which re-fires hover on any re-render — cannot restart the ring, and the
    gesture re-arms only once the pointer has actually left.
  */
  const armed = useRef(true)

  /*
    One ring, driven from both triggers. The body starts a beat after the
    clapper — that lag is what sells the counter-rotation.
  */
  const ring = useCallback(() => {
    const transition: Transition = {
      duration: SWING_MS / 1000,
      times: SWING_TIMES,
      ease: SWING_EASE,
    }
    void clapper.start({ rotate: CLAPPER_SWING, transition })
    void body.start({ rotate: BODY_SWING, transition: { ...transition, delay: 0.06 } })
  }, [clapper, body])

  useEffect(() => {
    if (!hovered) {
      armed.current = true
      return
    }
    if (!armed.current || reduced) return
    armed.current = false

    ring()
  }, [hovered, reduced, ring])

  // A message arriving rings the same bell, so the gesture is learned once.
  useEffect(() => {
    if (!ringing || reduced) return
    ring()
  }, [ringing, reduced, ring])

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      data-active={active ? 'true' : 'false'}
    >
      {title ? <title>{title}</title> : null}

      {/* Skirt flares slightly when there is something unread. */}
      <motion.path
        data-part="body"
        animate={body}
        style={{ originX: 0, originY: 0, transformOrigin: PIVOT }}
        d={
          active
            ? 'M18.4 15.4V10a6 6 0 1 0-12 0v5.4L3.6 18.2h17.2z'
            : 'M18 15.4V10a6 6 0 1 0-12 0v5.4L4.4 17.8h15.2z'
        }
      />
      <motion.path
        data-part="clapper"
        animate={clapper}
        style={{ originX: 0, originY: 0, transformOrigin: PIVOT }}
        d="M10 19.6a2 2 0 0 0 4 0"
      />
    </svg>
  )
}
