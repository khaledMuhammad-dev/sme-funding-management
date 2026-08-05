import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useMorphHost } from '@/components/icons/MorphIcon'
import { ensureGsap, prefersReducedMotion } from '@/lib/gsap'

/* ============================================================================
   The client's mark: nine pinned dots throwing nine lines across a square,
   with soft shadow wedges under the first four.

   Coordinates are the supplied artwork's, verbatim — nothing is redrawn by eye.
   Two things the supplied file does that we deliberately undo:

   1. It paints an opaque white `<rect>`. Dropped: the mark has to sit on
      whatever surface it lands on (parchment header, navy sidebar, card).
   2. It hardcodes `#172D4B` ink and `#E8EBEF` shadows. Both are now driven from
      the theme — ink is `currentColor` (callers hand it `text-primary`, which is
      navy on parchment in light and parchment on navy in dark), and the wedges
      are that same colour at 13% so they read as a shadow in light and as a
      faint lift in dark without ever glowing.
   ========================================================================== */

/** Tight crop of the artwork's content box; the source coordinates are unchanged. */
const VIEW_BOX = { x: 20, y: 13, w: 212, h: 224 } as const

/** The artwork's own stroke weight, at the artwork's own scale. */
const ART_STROKE = 2.2

type Point = readonly [number, number]

/** Each line, as the dot it is thrown from and the point it lands on. */
const LINES: ReadonlyArray<{ from: Point; to: Point }> = [
  { from: [31.5, 25], to: [31.5, 93] },
  { from: [74, 25], to: [31, 126] },
  { from: [115, 25], to: [31, 166] },
  { from: [163, 25], to: [31, 206] },
  { from: [218, 25], to: [35, 230] },
  { from: [218, 79], to: [68, 230] },
  { from: [218, 129], to: [98, 230] },
  { from: [218, 176], to: [130, 230] },
  { from: [221, 212], to: [169, 230] },
]

/** Dot radii, in line order — every line starts at its own dot. */
const DOT_RADII = [5.2, 5.2, 6.2, 6.9, 6.8, 6.1, 6.1, 5.9, 3.2] as const

/**
 * Shadow wedges — one per line, all nine.
 *
 * The first four are the supplied artwork's, verbatim. The artwork only shipped
 * those four, so the remaining five are derived by the rule the supplied four
 * follow, rather than sketched: each wedge is the triangle
 * `[dot, dot + ~25 units toward the *next* dot + a 4-unit outward nudge, the
 * line's own end point]`. That reproduces the given four to within ~2 units
 * (dot 3's lands exactly), which is why it is trusted for the other five.
 *
 * The consequence that matters visually: every wedge terminates where its line
 * terminates, so a line and its shadow always end together. Dot 9 has no
 * successor, so it continues dot 8's direction, shortened to land on the same
 * y=230 baseline the rest of the mark sits on.
 */
const WEDGES = [
  /* supplied */
  'M31 25 L57 21 L31 94 Z',
  'M74 25 L97 21 L31 127 Z',
  'M115 25 L140 21 L31 167 Z',
  'M163 25 L191 21 L31 207 Z',
  /* derived, same rule */
  'M218 25 L222 50 L35 230 Z',
  'M218 79 L222 104 L68 230 Z',
  'M218 129 L222 154 L98 230 Z',
  'M218 176 L224.1 200.9 L130 230 Z',
  'M221 212 L226.5 230 L169 230 Z',
] as const

/** Measured: 1.25:1 against parchment, 1.41:1 against owl navy — a shadow, not a shape. */
const WEDGE_OPACITY = 0.13

/* ----------------------------------------------------------------------------
   The hover shape: a rising bar chart — "funding", as growth.

   Why this and not a coin or a hand: the morph has to interpolate from nine
   straight, round-capped, two-point strokes. A coin or a cupped hand is curves
   and closed subpaths, and MorphSVG's fallback for that mismatch is exactly the
   muddy in-between the brief warns about. Nine ascending bars are nine straight
   two-point strokes — a 1:1 line→line map, so every frame of the transition is
   a clean straight segment, and the ascent still reads as growth/funding at
   30px where a coin's inner detail would not.

   It keeps the mark's own grammar too: one dot per stroke. The nine pinned dots
   simply travel to the nine bar tops and become the chart's data points.
   -------------------------------------------------------------------------- */
const BAR_BASE = 212
/** Bar x positions and tops — an exponential ramp, so it reads as growth, not a staircase. */
const BARS: ReadonlyArray<{ x: number; top: number }> = [
  { x: 40, top: 170 },
  { x: 61.5, top: 161.9 },
  { x: 83, top: 152.2 },
  { x: 104.5, top: 140.6 },
  { x: 126, top: 126.8 },
  { x: 147.5, top: 110.3 },
  { x: 169, top: 90.7 },
  { x: 190.5, top: 67.2 },
  { x: 212, top: 39.2 },
]

/**
 * `HOLD_MS` is measured from the start of the hover, not from the end of the
 * morph: the outbound tween finishes around 580 ms (0.42 s plus the 0.16 s
 * stagger tail), so the chart genuinely rests for roughly half a second before
 * it goes back.
 */
const MORPH_IN = 0.42
const HOLD_MS = 1100

function line(from: Point, to: Point) {
  return `M${from[0]} ${from[1]} L${to[0]} ${to[1]}`
}

/**
 * Bars are authored top-first so their start point is the dot, exactly like the
 * logo's lines — that keeps MorphSVG's point mapping stable through the morph.
 */
function bar(i: number) {
  const { x, top } = BARS[i]
  return `M${x} ${top} L${x} ${BAR_BASE}`
}

/** The line collapsed back onto its dot — the shape every line morphs *out of*. */
function stub(from: Point, to: Point) {
  const t = 0.06
  return line(from, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t] as const)
}

export interface BrandMarkProps {
  /** Rendered box, in px. Default 32 — header size. */
  size?: number
  className?: string
  /**
   * Only set this where the mark stands alone. Next to the app name it is
   * decorative and stays `aria-hidden`, so the name is not announced twice.
   */
  title?: string
}

/**
 * Dots: absent → pinned on the logo → riding the bar tops of the funding shape.
 * `custom` carries `[index, dotScale]` so the two states can size themselves.
 */
const dotVariants: Variants = {
  /*
    `hidden` has to spell out cx/cy/r as well, even though it only changes scale.
    Framer resolves a transition's *from* value out of the variant it is leaving,
    and a variant that omits a key resolves it to `undefined` — which reaches the
    DOM as `cx="undefined"` and makes the browser reject the attribute.
  */
  hidden: ([i, scale]: [number, number]) => ({
    scale: 0,
    opacity: 0,
    cx: LINES[i].from[0],
    cy: LINES[i].from[1],
    r: DOT_RADII[i] * scale,
  }),
  logo: ([i, scale]: [number, number]) => ({
    scale: 1,
    opacity: 1,
    cx: LINES[i].from[0],
    cy: LINES[i].from[1],
    r: DOT_RADII[i] * scale,
    transition: { type: 'spring', stiffness: 520, damping: 18, mass: 0.5, delay: i * 0.045 },
  }),
  funding: ([i, scale]: [number, number]) => ({
    scale: 1,
    opacity: 1,
    cx: BARS[i].x,
    cy: BARS[i].top,
    // Uniform in the chart: nine differently sized data points would read as noise.
    r: 5.6 * scale,
    transition: { duration: MORPH_IN, ease: [0.22, 1, 0.36, 1], delay: i * 0.02 },
  }),
}

const wedgeVariants: Variants = {
  hidden: { opacity: 0 },
  logo: (i: number) => ({
    opacity: WEDGE_OPACITY,
    // Trails its own line by a beat rather than waiting for all nine, so each
    // shadow arrives under the line that casts it.
    transition: { duration: 0.45, ease: 'easeOut', delay: 0.25 + i * 0.055 },
  }),
  // The shadows belong to the logo's lines; they clear out of the chart's way.
  funding: { opacity: 0, transition: { duration: 0.22, ease: 'easeOut' } },
}

/**
 * The brand mark.
 *
 * Animation split follows the project rule exactly: **GSAP morphs the nine line
 * paths and does nothing else.** Two morphs, both one-shot:
 *
 * - **On mount** each line grows out of its dot, staggered, so the mark draws
 *   itself once. A ref keeps React's double-invoked dev effects from replaying it.
 * - **On hover or keyboard focus of the host control** the nine lines become the
 *   nine bars of a rising chart, hold for about half a second, and morph back —
 *   once per hover, re-armed only when the pointer leaves.
 *
 * Every other beat (dots springing in and travelling to the bar tops, wedges
 * fading, the hover lift) is Framer Motion. Nothing loops.
 */
export function BrandMark({ size = 32, className, title }: BrandMarkProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const played = useRef(false)
  const framerReduced = useReducedMotion()

  /*
    Read once, at first render, so reduced-motion users are painted in the final
    state instead of seeing collapsed stubs for a frame before the effect fixes
    them. `prefersReducedMotion()` is the same helper MorphIcon uses.
  */
  const [reduced] = useState(() => prefersReducedMotion())
  const still = reduced || framerReduced

  /*
    Optical compensation. The artwork is drawn for a 250-unit square: at a 32px
    header the 2.2-unit strokes land on ~0.3 device px and the nine lines silt
    up into a grey smudge. Hold the on-screen stroke at a 1.15px floor and grow
    the dots to match, converting back through the viewBox scale. At display
    sizes (>~195px) both terms fall back to the artwork's own numbers exactly.
  */
  const unitsPerPx = VIEW_BOX.h / size
  const strokeWidth = Math.max(ART_STROKE, 1.15 * unitsPerPx)
  const dotScale = Math.max(1, (1.25 * unitsPerPx) / 5.2)

  /*
    Hover choreography: logo → funding shape → hold → back to the logo, exactly
    once per hover. `armed` is what stops it ping-ponging: entering only starts
    the sequence if the pointer has left since the last run, so holding the
    cursor still leaves the mark resting on the logo.
  */
  const [phase, setPhase] = useState<'logo' | 'funding'>('logo')
  const armed = useRef(true)
  const lastPhase = useRef<'logo' | 'funding'>('logo')
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const onEnter = useCallback(() => {
    if (still || !armed.current) return
    armed.current = false
    setPhase('funding')
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => setPhase('logo'), HOLD_MS)
  }, [still])

  // Leaving re-arms; the sequence itself is allowed to finish either way, so a
  // quick in-and-out never strands the mark mid-morph.
  const onLeave = useCallback(() => {
    armed.current = true
  }, [])

  useEffect(() => () => clearTimeout(holdTimer.current), [])

  /*
    Hover/focus is detected by the same helper the 20px nav glyphs use, so the
    host is the wordmark link — mark *and* name — not the 32px svg alone.
  */
  const hovered = useMorphHost(svgRef, still ? 'none' : 'host', { onEnter, onLeave })

  useEffect(() => {
    const group = groupRef.current
    if (!group) return

    const paths = Array.from(group.querySelectorAll<SVGPathElement>('path'))

    if (still) {
      paths.forEach((path, i) => path.setAttribute('d', line(LINES[i].from, LINES[i].to)))
      return
    }
    if (played.current) return
    played.current = true

    const gsap = ensureGsap()
    const tl = gsap.timeline()
    paths.forEach((path, i) => {
      tl.to(
        path,
        {
          duration: 0.62,
          ease: 'power3.out',
          morphSVG: line(LINES[i].from, LINES[i].to),
        },
        i * 0.055,
      )
    })

    /*
      Deliberately no cleanup. StrictMode's dev remount tears every effect down
      and runs it again: killing the timeline there would leave the mark frozen
      as nine stubs, because the replay is (correctly) blocked by `played`. The
      timeline is a one-second one-shot on nodes React keeps across that remount,
      so letting it run out is both correct and cheap.
    */
  }, [still])

  /* The hover morph. Straight line → straight line, nine times, both ways. */
  useEffect(() => {
    const group = groupRef.current
    /*
      Only ever on a real phase *change*. Without this the effect would also fire
      on mount — with `overwrite: true` that would kill the entrance stagger and
      snap the mark straight to its resting shape.
    */
    if (!group || still || phase === lastPhase.current) return
    lastPhase.current = phase

    const paths = Array.from(group.querySelectorAll<SVGPathElement>('path'))
    const gsap = ensureGsap()
    const tweens = paths.map((path, i) =>
      gsap.to(path, {
        duration: MORPH_IN,
        // Slight overshoot on the way out, a settle on the way back — the same
        // reading MorphIcon gives its idle↔active pair.
        ease: phase === 'funding' ? 'back.out(1.7)' : 'power3.inOut',
        delay: i * 0.02,
        overwrite: true,
        morphSVG: phase === 'funding' ? bar(i) : line(LINES[i].from, LINES[i].to),
      }),
    )
    return () => {
      tweens.forEach((tween) => tween.kill())
    }
  }, [phase, still])

  return (
    // The hover lift lives on a wrapper `<span>`, never on the `<svg>`: an inline
    // transform on the svg element would out-specify class-based transforms
    // (the trap called out in MorphIcon.tsx).
    //
    // The mark is NOT `.rtl-flip`-ed — see the note on the component export.
    <motion.span
      className={cn('inline-flex shrink-0', className)}
      style={{ transformOrigin: 'center', willChange: 'transform' }}
      // Driven by the host, not by `whileHover`, so hovering the *name* lifts the
      // mark too — the wordmark reacts as one object.
      animate={{ scale: hovered && !still ? 1.06 : 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 16, mass: 0.6 }}
    >
      <svg
        ref={svgRef}
        width={size}
        height={size}
        viewBox={`${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.w} ${VIEW_BOX.h}`}
        fill="none"
        data-testid="brand-mark"
        role={title ? 'img' : 'presentation'}
        aria-hidden={title ? undefined : true}
        aria-label={title}
      >
        {title ? <title>{title}</title> : null}

        {/* Shadow wedges — currentColor at 13%, so they follow the ink into dark mode. */}
        <g fill="currentColor" data-brand="wedges">
          {WEDGES.map((d, i) => (
            <motion.path
              key={d}
              d={d}
              custom={i}
              variants={wedgeVariants}
              initial={still ? false : 'hidden'}
              animate={still ? 'logo' : phase}
              style={still ? { opacity: WEDGE_OPACITY } : undefined}
            />
          ))}
        </g>

        {/* The nine lines. GSAP owns these `d` attributes and nothing else. */}
        <g
          ref={groupRef}
          data-brand="lines"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        >
          {LINES.map(({ from, to }) => (
            <path key={line(from, to)} d={still ? line(from, to) : stub(from, to)} />
          ))}
        </g>

        {/* The nine pinned dots. */}
        <g fill="currentColor">
          {LINES.map(({ from }, i) => (
            <motion.circle
              key={`${from[0]}-${from[1]}`}
              cx={from[0]}
              cy={from[1]}
              r={DOT_RADII[i] * dotScale}
              custom={[i, dotScale] as [number, number]}
              variants={dotVariants}
              initial={still ? false : 'hidden'}
              animate={still ? 'logo' : phase}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />
          ))}
        </g>
      </svg>
    </motion.span>
  )
}
