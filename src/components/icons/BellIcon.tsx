import { useCallback, useEffect, useRef } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import type { Transition } from 'framer-motion'
import { useMorphHost } from './MorphIcon'
import type { MorphIconProps } from './MorphIcon'
import { cn } from '@/lib/utils'
import { ensureGsap, prefersReducedMotion } from '@/lib/gsap'
import { bellParts } from './paths'

/**
 * The bell, drawn in parts so it can actually be rung.
 *
 * The motion is lifted from the reference bell the client pointed at: the dome
 * rocks around its own crown through a hard first throw and four decaying
 * counter-swings, and the clapper — a separate element, NOT a child of the dome
 * — slides horizontally on its own decaying schedule, starting a beat late and
 * always heading the way the dome is coming from. Two independent decays that
 * happen to meet is what reads as strikes; rotate both together by the same
 * angle and the icon merely wobbles. The whole thing is over in 0.81s.
 *
 * Layered on top: the dome morphs to its flared ringing shape and two sound
 * brackets — parenthesis arcs, `( bell )` — open out of the sides, so the
 * gesture ends in the state the unread bell rests in. GSAP owns the path morph and nothing else — every rotation,
 * translation and fade here is Framer Motion's.
 */

/**
 * The dome pivots at its hanging point — where the crown meets its mount,
 * (12, 4) in user units. Framer builds `transform-origin` from
 * `originX/originY` (a raw `transformOrigin` in style loses that fight), and
 * on an SVG `<g>` it resolves them against the *viewBox* with
 * `transform-box: view-box` — so the values are given as explicit px strings,
 * which pass through untouched and land exactly on the crown. Anything else
 * (the default centre, a viewBox fraction, a bbox corner) makes the swing read
 * as a wobble, not a bell on its mount.
 */
const DOME_ORIGIN = { originX: '12px', originY: '4px' } as const

/** Total ring, matching the reference timeline end to end. */
const SWING_MS = 810

/**
 * Dome rotation. One hard throw (-12°, eased out) and four decaying
 * counter-swings that ease through both ends, then a soft landing on zero.
 *
 * 12° is a geometry contract, not a taste setting: the sound brackets in
 * paths.ts sit exactly one visible gap outside the arc the flared dome sweeps
 * at this amplitude. Swing harder and the dome ploughs through them.
 */
const BODY_SWING = [0, -12, 10, -6.5, 4, -2, 0]
const BODY_TIMES = [0, 0.173, 0.358, 0.519, 0.667, 0.79, 0.938]
const BODY_EASE: Transition['ease'] = [
  'easeOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeOut',
]

/**
 * Clapper travel, in user units across the 24-grid — the free part swinging
 * inside, not a second copy of the dome's rotation. It stays put for the first
 * 40ms (the dome has to reach it first), then decays on a schedule of its own
 * that is deliberately out of step with the dome's.
 */
const CLAPPER_SWING = [0, 0, 3, -2.4, 1.5, -0.85, 0.35, 0]
const CLAPPER_TIMES = [0, 0.049, 0.235, 0.42, 0.58, 0.728, 0.852, 1]
const CLAPPER_EASE: Transition['ease'] = [
  'linear',
  'easeOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeInOut',
  'easeOut',
]

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

  const bodyPathRef = useRef<SVGPathElement>(null)
  const clapperPathRef = useRef<SVGPathElement>(null)

  /* The bell rings while hovered, and rests rung while there is something unread. */
  const shouldBeActive = active || hovered

  /*
    One swing per hover. `armed` gates re-entry so holding the pointer still —
    which re-fires hover on any re-render — cannot restart the ring, and the
    gesture re-arms only once the pointer has actually left.
  */
  const armed = useRef(true)

  /* One ring, driven from both triggers. */
  const ring = useCallback(() => {
    void body.start({
      rotate: BODY_SWING,
      transition: { duration: SWING_MS / 1000, times: BODY_TIMES, ease: BODY_EASE },
    })
    void clapper.start({
      x: CLAPPER_SWING,
      transition: { duration: SWING_MS / 1000, times: CLAPPER_TIMES, ease: CLAPPER_EASE },
    })
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

  /*
    The shape change rides along with the swing: the skirt flares as the bell is
    struck and stays flared while it matters. Same slight overshoot as every
    other morph in the app, so the whole icon set settles the same way.
  */
  useEffect(() => {
    const nodes = [
      [bodyPathRef.current, bellParts.body] as const,
      [clapperPathRef.current, bellParts.clapper] as const,
    ]

    if (prefersReducedMotion()) {
      for (const [node, part] of nodes) {
        node?.setAttribute('d', shouldBeActive ? part.active : part.idle)
      }
      return
    }

    const gsap = ensureGsap()
    const tweens = nodes.map(([node, part]) =>
      node
        ? gsap.to(node, {
            duration: shouldBeActive ? 0.6 : 0.48,
            ease: shouldBeActive ? 'back.out(2.2)' : 'back.out(1.2)',
            morphSVG: shouldBeActive ? part.active : part.idle,
          })
        : null,
    )
    return () => {
      for (const tween of tweens) tween?.kill()
    }
  }, [shouldBeActive])

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

      {/*
        Sound waves. They live outside the swinging parts — a ripple that has
        left the bell does not swing with it — and simply open out of the sides
        the bell struck from.
      */}
      {(['left', 'right'] as const).map((side) => (
        <motion.path
          key={side}
          data-part={`wave-${side}`}
          d={bellParts.wave[side]}
          /* Each bracket opens outward from the bell — its own bbox edge
             nearest the dome — not from a corner of the icon. */
          style={{ originX: side === 'left' ? 1 : 0, originY: 0.5 }}
          initial={false}
          animate={
            reduced
              ? { opacity: shouldBeActive ? 1 : 0, scale: 1 }
              : { opacity: shouldBeActive ? 1 : 0, scale: shouldBeActive ? 1 : 0.55 }
          }
          transition={
            reduced
              ? { duration: 0 }
              : { type: 'spring', stiffness: 340, damping: 16, mass: 0.6, delay: shouldBeActive ? 0.1 : 0 }
          }
        />
      ))}

      {/* Skirt flares while there is something unread; GSAP morphs it above. */}
      <motion.g animate={body} style={DOME_ORIGIN}>
        <path ref={bodyPathRef} data-part="body" d={bellParts.body.idle} />
      </motion.g>
      {/*
        A sibling of the dome, not a child: the clapper hangs free, so it must
        not inherit the dome's rotation. It only slides.
      */}
      <motion.g animate={clapper}>
        <path ref={clapperPathRef} data-part="clapper" d={bellParts.clapper.idle} />
      </motion.g>
    </svg>
  )
}
