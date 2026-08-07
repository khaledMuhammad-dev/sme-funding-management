import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ensureGsap, prefersReducedMotion } from '@/lib/gsap'

export interface MorphPaths {
  idle: string
  active: string
}

/**
 * Elements that own the icon's hover state. An icon inside a button, link,
 * menu item or tab morphs when the *control* is hovered or keyboard-focused —
 * pointing at the 16px glyph itself is not the interaction.
 *
 * `[data-morph-host]` is the escape hatch: put it on a card, row or list item
 * to make that whole surface the trigger.
 */
const HOST_SELECTOR = [
  '[data-morph-host]',
  'a[href]',
  'button',
  'label',
  'summary',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="link"]',
].join(',')

/**
 * Which element drives the hover:
 * - `host` (default) — nearest interactive ancestor, falling back to the icon
 * - `self` — the icon only
 * - `none` — no hover morphing; `active` still applies
 */
export type MorphTrigger = 'host' | 'self' | 'none'

function isDisabled(element: Element) {
  return (
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true' ||
    element.getAttribute('data-disabled') !== null
  )
}

/**
 * Binds hover/focus to whatever element actually represents the control, and
 * reports it as boolean state.
 *
 * Shared so that every morphing glyph — the 20px nav icons and the brand mark
 * alike — agrees on what "hovered" means: pointing at a 16px path is not the
 * interaction, hovering (or tabbing to) the button/link/row around it is.
 *
 * `onEnter`/`onLeave` fire on the same edges as the returned flag, for callers
 * that need to arm a one-shot sequence rather than just track a state.
 */
export function useMorphHost(
  ref: React.RefObject<SVGSVGElement | null>,
  trigger: MorphTrigger = 'host',
  handlers?: { onEnter?: () => void; onLeave?: () => void },
) {
  const [hovered, setHovered] = useState(false)
  const latest = useRef(handlers)
  latest.current = handlers

  useEffect(() => {
    if (trigger === 'none') return
    const svg = ref.current
    if (!svg) return

    const host = trigger === 'self' ? svg : (svg.closest(HOST_SELECTOR) ?? svg)

    const enter = () => {
      if (host !== svg && isDisabled(host)) return
      setHovered(true)
      latest.current?.onEnter?.()
    }
    const leave = () => {
      setHovered(false)
      latest.current?.onLeave?.()
    }

    host.addEventListener('mouseenter', enter)
    host.addEventListener('mouseleave', leave)
    // Keyboard users get the same feedback as pointer users.
    host.addEventListener('focusin', enter)
    host.addEventListener('focusout', leave)

    return () => {
      host.removeEventListener('mouseenter', enter)
      host.removeEventListener('mouseleave', leave)
      host.removeEventListener('focusin', enter)
      host.removeEventListener('focusout', leave)
    }
  }, [ref, trigger])

  return hovered
}

/**
 * Splits an icon's `d` into its subpaths. Only uppercase `M` ever starts one in
 * this library, so the lookahead is exact.
 */
function splitSubpaths(d: string): string[] {
  return d
    .split(/(?=M)/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const seedCache = new Map<string, number>()

/** Length of a subpath, measured once per unique `d`. */
function subpathLength(d: string): number {
  const cached = seedCache.get(d)
  if (cached !== undefined) return cached
  let length = Number.POSITIVE_INFINITY
  if (typeof document !== 'undefined') {
    const probe = document.createElementNS(SVG_NS, 'path')
    probe.setAttribute('d', d)
    try {
      length = probe.getTotalLength()
    } catch {
      length = Number.POSITIVE_INFINITY
    }
  }
  seedCache.set(d, length)
  return length
}

/** Below this a subpath has no length of its own — it is a dot, or a seed. */
const DEGENERATE = 0.5

/**
 * Is this subpath a seed — the hair-wide placeholder a state carries so that a
 * part it does not have yet still has something to be paired with?
 *
 * Measured rather than declared, so the contract stays in the path data where
 * an author can see it. It takes BOTH states to answer: plenty of real glyphs
 * are drawn as zero-length dots (the typing dots in a speech bubble, the point
 * under a warning's bang), and those are dots in either state. A seed is a
 * subpath with no length whose counterpart has plenty.
 */
function isSeed(d: string, counterpart: string): boolean {
  return subpathLength(d) < DEGENERATE && subpathLength(counterpart) >= DEGENERATE
}

export interface MorphIconProps {
  paths: MorphPaths
  /** Pins the active shape (current route, unread bell) regardless of hover. */
  active?: boolean
  size?: number
  strokeWidth?: number
  className?: string
  /** Set when the icon is the only content of a control. */
  title?: string
  /** Which element drives the hover — see `MorphTrigger`. */
  trigger?: MorphTrigger
}

/**
 * The single icon engine. GSAP is used here and nowhere else — every other
 * animation in the app is Framer Motion.
 *
 * With `prefers-reduced-motion` the paths swap instantly instead of tweening.
 */
export function MorphIcon({
  paths,
  active = false,
  size = 20,
  strokeWidth = 1.8,
  className,
  title,
  trigger = 'host',
}: MorphIconProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRefs = useRef<(SVGPathElement | null)[]>([])
  /* Bound to whatever element actually represents the control. */
  const hovered = useMorphHost(svgRef, trigger)
  const shouldBeActive = active || hovered
  const reducedMotion = useReducedMotion()

  /*
    Every subpath is rendered as its own <path> and tweened against the subpath
    at the SAME INDEX in the other state. That is the whole point: handed one
    string containing several subpaths, MorphSVG has to guess which goes with
    which, and its guess is driven by size and position — so a tick sitting in
    the middle of the box and a badge ring sitting in the middle of the box are
    indistinguishable to it, and it will happily unroll the tick into the ring
    while the ring's seed grows into a tick. The endpoints still land correctly,
    which is why the bug only shows up mid-tween. Pairing by index removes the
    guess entirely and lets paths.ts mean what it says.

    The exception is a pair whose subpath counts differ — moon ↔ sun, where one
    crescent becomes a disc plus eight rays. There is no index pairing to make,
    so that one goes through as a single path and MorphSVG splits it, which is
    exactly the behaviour that pair was drawn for.
  */
  const idleParts = useMemo(() => splitSubpaths(paths.idle), [paths.idle])
  const activeParts = useMemo(() => splitSubpaths(paths.active), [paths.active])
  const paired = idleParts.length === activeParts.length
  const renderedParts = paired ? idleParts : [paths.idle]

  /*
    A seed has no length, so it would still paint a round cap — a stray dot in
    the middle of the icon. Fading it out is what lets a seed sit wherever its
    part should actually grow from, rather than being hidden under whatever ink
    happens to be nearby: the badge ring can open from the dead centre of the
    glyph instead of inflating across it from a corner. Opacity is Framer's;
    GSAP is still only touching `d`.
  */
  const seedOpacity = (i: number) => {
    if (!paired) return 1
    const [current, other] = shouldBeActive
      ? [activeParts[i], idleParts[i]]
      : [idleParts[i], activeParts[i]]
    return isSeed(current, other) ? 0 : 1
  }

  useEffect(() => {
    const targets = paired
      ? shouldBeActive
        ? activeParts
        : idleParts
      : [shouldBeActive ? paths.active : paths.idle]

    if (prefersReducedMotion()) {
      targets.forEach((target, i) => pathRefs.current[i]?.setAttribute('d', target))
      return
    }

    const gsap = ensureGsap()
    /*
      Three things make a 20px shape change register at all.

      Duration: long enough to be followed. A morph under ~0.4s is over before
      the eye finds it and just reads as a swap.

      Overshoot: `back.out` carries the shape past its target and settles back,
      so the change announces itself instead of arriving quietly.

      Stagger: each subpath starts a beat after the one before it, so the icon
      redraws as a short sequence — the doorway widens and *then* the door
      swings, the page clears and *then* the check lands — rather than every
      part moving at once, which the eye reads as a single blur. Leaving runs
      the stagger backwards, so the icon unwinds the way it was built.
    */
    const tweens = targets.map((target, i) => {
      const node = pathRefs.current[i]
      if (!node) return null
      return gsap.to(node, {
        duration: shouldBeActive ? 0.6 : 0.48,
        delay: (shouldBeActive ? i : targets.length - 1 - i) * (shouldBeActive ? 0.045 : 0.03),
        ease: shouldBeActive ? 'back.out(2.2)' : 'back.out(1.2)',
        morphSVG: target,
      })
    })
    return () => {
      for (const tween of tweens) tween?.kill()
    }
  }, [shouldBeActive, paired, idleParts, activeParts, paths.active, paths.idle])

  return (
    // The morph alone is easy to miss at 16–20px, so the whole glyph springs a
    // little as it changes shape. Framer Motion owns this; GSAP still owns the
    // path morph and nothing else.
    //
    // The spring lives on a wrapper, never on the <svg>: an inline `transform`
    // on the svg would beat the `.rtl-flip` class and leave directional icons
    // (arrows) pointing the wrong way in Arabic.
    <motion.span
      className="inline-flex shrink-0"
      style={{ transformOrigin: 'center', willChange: 'transform' }}
      animate={
        reducedMotion
          ? { scale: 1, rotate: 0 }
          : { scale: shouldBeActive ? 1.22 : 1, rotate: shouldBeActive ? -7 : 0 }
      }
      transition={{ type: 'spring', stiffness: 340, damping: 11.5, mass: 0.7 }}
    >
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
      >
        {title ? <title>{title}</title> : null}
        {renderedParts.map((part, i) => (
          <motion.path
            // Index IS the identity here — subpath i of idle is subpath i of active.
            key={i}
            ref={(node) => {
              pathRefs.current[i] = node
            }}
            d={part}
            initial={false}
            animate={{ opacity: seedOpacity(i) }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.3, ease: 'easeOut', delay: shouldBeActive ? i * 0.045 : 0 }
            }
          />
        ))}
      </svg>
    </motion.span>
  )
}
