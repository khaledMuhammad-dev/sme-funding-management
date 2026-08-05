import { useEffect, useRef, useState } from 'react'
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
  const pathRef = useRef<SVGPathElement>(null)
  /* Bound to whatever element actually represents the control. */
  const hovered = useMorphHost(svgRef, trigger)
  const shouldBeActive = active || hovered
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const node = pathRef.current
    if (!node) return

    const target = shouldBeActive ? paths.active : paths.idle

    if (prefersReducedMotion()) {
      node.setAttribute('d', target)
      return
    }

    const gsap = ensureGsap()
    // `back.out` overshoots the target shape slightly before settling — the
    // morph reads as a deliberate gesture instead of a shape that quietly
    // swapped while nobody was looking.
    const tween = gsap.to(node, {
      duration: 0.45,
      ease: shouldBeActive ? 'back.out(2.2)' : 'power3.inOut',
      morphSVG: target,
    })
    return () => {
      tween.kill()
    }
  }, [shouldBeActive, paths.active, paths.idle])

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
          : { scale: shouldBeActive ? 1.14 : 1, rotate: shouldBeActive ? -4 : 0 }
      }
      transition={{ type: 'spring', stiffness: 420, damping: 13, mass: 0.6 }}
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
        <path ref={pathRef} d={paths.idle} />
      </svg>
    </motion.span>
  )
}
