import { useEffect, useRef } from 'react'
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { useMorphHost } from './MorphIcon'
import type { MorphIconProps } from './MorphIcon'
import { cn } from '@/lib/utils'
import { prefersReducedMotion } from '@/lib/gsap'

/**
 * The bell, drawn as two parts so it can actually be rung.
 *
 * Body and clapper are separate paths sharing one pivot at the crown. On hover
 * the clapper swings first and the body swings *against* it, each settling
 * through a decaying overshoot — the counter-rotation is what reads as a ring
 * rather than as an icon being wobbled.
 *
 * Rotation is Framer Motion's job; GSAP is reserved for SVG path morphing, so
 * nothing here touches it.
 */

/** Pivot at the crown: both parts hang from the same point, as a real bell does. */
const PIVOT = '12px 5px'

/** Decaying swing. The body trails the clapper and travels less far. */
const CLAPPER_SWING = [0, 15, -11, 7, -4, 2, 0]
const BODY_SWING = [0, -7, 5, -3.5, 2, -1, 0]
const SWING_MS = 900

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

  useEffect(() => {
    if (!hovered) {
      armed.current = true
      return
    }
    if (!armed.current || reduced) return
    armed.current = false

    const transition = { duration: SWING_MS / 1000, ease: 'easeOut' as const }
    void clapper.start({ rotate: CLAPPER_SWING, transition })
    void body.start({ rotate: BODY_SWING, transition: { ...transition, delay: 0.04 } })
  }, [hovered, reduced, clapper, body])

  // A message arriving rings the same bell, so the gesture is learned once.
  useEffect(() => {
    if (!ringing || reduced) return
    const transition = { duration: SWING_MS / 1000, ease: 'easeOut' as const }
    void clapper.start({ rotate: CLAPPER_SWING, transition })
    void body.start({ rotate: BODY_SWING, transition: { ...transition, delay: 0.04 } })
  }, [ringing, reduced, clapper, body])

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
