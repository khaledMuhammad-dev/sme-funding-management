import type { MorphPaths } from './MorphIcon'

/**
 * Icon path library. One stroke-based `<path d>` on a 24×24 grid per icon so
 * GSAP can morph between the two states.
 *
 * RULE: every icon has TWO DISTINCT STATES, the way moon ↔ sun does.
 * `idle` is the COMPLETE, instantly recognisable glyph — nothing is missing at
 * 16px. `active` is a genuinely different drawing of the SAME idea: the door is
 * thrown open, the bell is ringing with sound waves, the tick has snapped into
 * its badge, the card is paying. The morph is an event, not a nudge — but the
 * active shape is also a resting state (nav pins it on the current route), so it
 * has to look composed standing still.
 *
 * TECHNIQUE: both states keep the SAME subpath count and order. The engine
 * renders each subpath as its own `<path>` and tweens it against the subpath at
 * the same index in the other state, so index IS the pairing — nothing is left
 * to MorphSVG's size/position guesswork.
 *
 * When the active state gains a part idle has no counterpart for (sound waves,
 * a badge ring, a check, a spark), idle carries a "seed" subpath parked on top
 * of existing geometry, where its round cap is invisible. The new part then
 * grows out of the point it should emerge from. Seed an OPEN stroke as a
 * zero-length line (`M x y h.01`); seed a CLOSED shape as the same shape at a
 * hair's width (`ringSeed`), so the tween is a plain scale-up rather than a
 * loop of crossing curves unrolling out of a line.
 *
 * moonSunIcon is the one pair whose subpath counts differ on purpose (1 crescent
 * → disc plus eight rays); MorphSVGPlugin splits the crescent for it.
 */

const p = (idle: string, active: string): MorphPaths => ({ idle, active })

/**
 * The status badge ring, shared by check / x / plus / money so the four read as
 * one family: at rest they are bare marks, and the ring is what arrives when
 * the row is hovered or the state is pinned.
 */
const RING = 'M16.7 3.9a9.4 9.4 0 1 0 4.6 6.5 9.4 9.4 0 0 0-4.6-6.5'

/**
 * `RING` collapsed to r=0.05 — the seed check and x carry so their ring can
 * arrive on hover rather than sit there at rest.
 *
 * It is the ring's OWN geometry scaled down about its centre, not a generic
 * tiny circle: same two arcs, same sweep flags, same proportions, so MorphSVG
 * has an exact point-for-point correspondence and the tween is a clean
 * scale-up. Seeded as an evenly-halved circle instead, it has to re-align
 * against the ring's uneven 310°/50° split and unrolls through a kink.
 *
 * Park it at the ring's own centre. The engine fades seeds out, so it does not
 * need hiding under ink — and opening concentrically from the middle is what
 * makes it read as a badge closing in rather than a bubble being blown across
 * the glyph from a corner.
 */
const ringSeed = (cx: number, cy: number) =>
  `M${cx + 0.025} ${cy - 0.043}a.05 .05 0 1 0 .025 .035 .05 .05 0 0 0-.025-.035`

/* ── Navigation ───────────────────────────────────────────────────────────── */

/**
 * House. Idle the door is shut and has a knob; active the doorway is thrown
 * wide and the door itself stands ajar inside it — the knob is the seed the
 * open leaf unfolds from.
 */
export const homeIcon = p(
  'M3 10.9 12 3.4l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9.7 21v-6.1h4.6V21 M13.2 18.1h.01',
  'M3 10.9 12 3.4l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M8.8 21v-5.6a3.2 3.2 0 0 1 6.4 0V21 M15.2 15.4l3.4-1.8V21h-3.4',
)

/**
 * Application page. Idle two lines of text; active the second line clears out
 * and a big check lands across the lower half — the application is accepted.
 */
export const applicationsIcon = p(
  'M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5 M8.6 12.6h6.8 M8.6 16.2h3.8 M12.4 16.2h.01',
  'M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5 M8.6 12h6.8 M8.6 15h1.8 M8.8 17.6 11.2 20l5.4-6',
)

/**
 * Interview. Idle one bubble with three dots; active the bubble pulls up and
 * back, its dots lift into a typing beat, and the reply bubble arrives in the
 * corner it was seeded in — a conversation instead of a message.
 */
export const interviewIcon = p(
  'M4 4.4h16a1 1 0 0 1 1 1v8.4a1 1 0 0 1-1 1h-6.6L9 19v-4.2H4a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1z M8 9.8h.01 M12 9.8h.01 M16 9.8h.01 M20 14.8h.01',
  'M3 3.2h13.4a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-5.6L7 16.4v-4.2H3a1 1 0 0 1-1-1V4.2a1 1 0 0 1 1-1z M6.4 7.6h.01 M9.7 6.4h.01 M13 7.6h.01 M14.6 14h6.4a1 1 0 0 1 1 1v4.2a1 1 0 0 1-1 1h-.8v1.6l-2.4-1.6h-3.2a1 1 0 0 1-1-1V15a1 1 0 0 1 1-1z',
)

/**
 * Contract. Idle a flat, unsigned line; active it breaks into a signature
 * flourish that runs past the margin, and the ruled line under it lands.
 */
export const contractIcon = p(
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 11.4h6 M9 16.2h6 M15 16.2h.01',
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 10.6h6 M8.4 16.4c1.1-2.6 2.2-2.6 3.1 0s2 .9 2.9-1.3 M8.8 19.4h6.4',
)

/**
 * Bank card. Idle stripe and chip; active the chip runs long and two contactless
 * waves ripple out of the stripe — the card is actually paying.
 */
export const disbursementIcon = p(
  'M3 6.4h18a1 1 0 0 1 1 1v9.2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1z M2 10.2h20 M5.8 14.2h3.4 M15.4 10.2h.01 M18 10.2h.01',
  'M3 6.4h18a1 1 0 0 1 1 1v9.2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.4a1 1 0 0 1 1-1z M2 10.2h20 M5.8 14.2h6.2 M15.4 12.4a3 3 0 0 1 0 3.6 M18 11.2a5.4 5.4 0 0 1 0 6',
)

/**
 * Follow-up. Idle a reset arc with the hands at ten past; active the hands sweep
 * right round, the head of the arrow doubles, and a second trail opens outside
 * the dial where it was seeded — a cycle that is actually turning.
 */
export const followUpIcon = p(
  'M20.6 12a8.6 8.6 0 1 1-2.6-6.1 M20.9 3.6v4.2h-4.2 M12 7.6v4.6l3.2 1.9 M18.1 18.1h.01',
  'M20.6 12a8.6 8.6 0 1 1-2.6-6.1 M21.6 2.4v5.4h-5.4 M12 6.2v5.8l5.4-1.2 M22 15.6a10.6 10.6 0 0 1-6.4 6.4',
)

/**
 * Reports. Idle three uneven bars; active they rise into an ascending run and a
 * chevron caps the tallest — the trend, not just the data.
 */
export const reportsIcon = p(
  'M3 20.8h18 M6.8 20.8V13.6 M12 20.8V10.6 M17.2 20.8V15.4 M17.2 15.4h.01',
  'M3 20.8h18 M6.8 20.8V15 M12 20.8V10 M17.2 20.8V5.4 M14.8 7.8 17.2 5.4l2.4 2.4',
)

/**
 * Gear — a toothed body around a hub, not a starburst.
 *
 * Both shapes are the same 32-point outline (8 teeth) so MorphSVG pairs points
 * one-to-one; the active shape is the identical gear turned half a tooth pitch —
 * the furthest it can go and still read as the same gear — with the hub bored
 * down, so it also reads as the mechanism tightening.
 */
export const settingsIcon = p(
  'M10.37 2.64L13.63 2.64L13.29 5.22L15.88 6.29L17.46 4.23L19.77 6.54L17.71 8.12L18.78 10.71L21.36 10.37L21.36 13.63L18.78 13.29L17.71 15.88L19.77 17.46L17.46 19.77L15.88 17.71L13.29 18.78L13.63 21.36L10.37 21.36L10.71 18.78L8.12 17.71L6.54 19.77L4.23 17.46L6.29 15.88L5.22 13.29L2.64 13.63L2.64 10.37L5.22 10.71L6.29 8.12L4.23 6.54L6.54 4.23L8.12 6.29L10.71 5.22Z M8.6 12a3.4 3.4 0 1 0 6.8 0a3.4 3.4 0 1 0 -6.8 0Z',
  'M14.07 2.73L17.09 3.98L15.79 6.23L17.77 8.21L20.02 6.91L21.27 9.93L18.76 10.6L18.76 13.4L21.27 14.07L20.02 17.09L17.77 15.79L15.79 17.77L17.09 20.02L14.07 21.27L13.4 18.76L10.6 18.76L9.93 21.27L6.91 20.02L8.21 17.77L6.23 15.79L3.98 17.09L2.73 14.07L5.24 13.4L5.24 10.6L2.73 9.93L3.98 6.91L6.23 8.21L8.21 6.23L6.91 3.98L9.93 2.73L10.6 5.24L13.4 5.24Z M9.6 12a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0Z',
)

/**
 * Dashboard. Idle a neutral 2×2 grid of equals; active the layout re-lays itself
 * around one feature panel, the other three giving up their space to it. Each
 * panel stays in its own quadrant so the rearrangement never crosses itself.
 */
export const dashboardIcon = p(
  'M3.8 4h6.4v6.4H3.8z M13.8 4h6.4v6.4h-6.4z M3.8 13.6h6.4V20H3.8z M13.8 13.6h6.4V20h-6.4z',
  'M3.8 4h9.4v10.6H3.8z M15 4h5.2v5.4H15z M3.8 16.6h9.4V20H3.8z M15 11.2h5.2V20H15z',
)

/* ── Actions & status ─────────────────────────────────────────────────────── */

/**
 * Bell. Idle hanging still; active the skirt flares, the clapper swings off
 * centre and two sound waves peel off the sides it was seeded on.
 *
 * (`BellIcon` is the component actually mounted in the shells — it splits body
 * and clapper so Framer Motion can swing them. This pair is the single-path
 * bell for any plain `MorphIcon` use.)
 */
export const bellParts = {
  body: p(
    'M18 15.4V10a6 6 0 1 0-12 0v5.4L4.4 17.8h15.2z',
    'M18.8 15.2V9.6a6.8 6.8 0 1 0-13.6 0v5.6L3.2 18.2h17.6z',
  ),
  clapper: p('M10 19.6a2 2 0 0 0 4 0', 'M10.7 19.6a2 2 0 0 0 4 0'),
  /*
    Sound brackets — parenthesis arcs flanking the bell, `( bell )` — seeded as
    dots on the dome's widest shoulders where their round caps are hidden.

    Geometry is load-bearing: the dome swings up to 12° around its crown
    (12, 4), so its flared 6.8-radius circle's centre sweeps between roughly
    (10.8, 9.5) and (13.2, 9.5). Every bracket point keeps ≥ 8.9 user units
    from BOTH extremes (radius 6.8 + two half strokes + a visible gap), so the
    arcs stay clear of the dome through every intermediate frame of the swing —
    the ends (x 2.6, y 6/13) are the tight spots, the bulge (x 1.4) is not.
    Push the swing past 12° and the dome ploughs through them.
  */
  waveStart: { left: 'M6 10h.01', right: 'M18 10h.01' },
  wave: { left: 'M2.6 6A5.7 5.7 0 0 0 2.6 13', right: 'M21.4 6A5.7 5.7 0 0 1 21.4 13' },
} as const

export const bellIcon = p(
  [bellParts.body.idle, bellParts.clapper.idle, bellParts.waveStart.left, bellParts.waveStart.right].join(
    ' ',
  ),
  [bellParts.body.active, bellParts.clapper.active, bellParts.wave.left, bellParts.wave.right].join(' '),
)

/**
 * Person. Idle head and shoulders; active the figure lifts and a check lands
 * beside it — the account is the verified one.
 */
export const userIcon = p(
  'M12 3.8a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8 M4.9 20.4a7.1 7.1 0 0 1 14.2 0 M19.1 20.4h.01',
  'M10.6 3.2a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M3.2 20.6a7.4 7.4 0 0 1 11.4-6.2 M15 18.2l2.4 2.4 4.4-5.6',
)

/**
 * Magnifier. Idle a plain lens and handle — nothing found yet; active the lens
 * opens up, the handle drives out and a spark bursts inside it.
 *
 * The spark is seeded as a hair-wide star on the crown of the lens, where its
 * round cap disappears into the rim.
 */
export const searchIcon = p(
  'M3.6 10.6a7 7 0 1 0 14 0 7 7 0 0 0-14 0 M10.6 3.54 10.62 3.58 10.66 3.6 10.62 3.62 10.6 3.66 10.58 3.62 10.54 3.6 10.58 3.58z M15.7 15.7 20.5 20.5',
  'M2.6 10.4a7.6 7.6 0 1 0 15.2 0 7.6 7.6 0 0 0-15.2 0 M10.2 5.8 11.5 8.9 14.6 10.2 11.5 11.5 10.2 14.6 8.9 11.5 5.8 10.2 8.9 8.9z M15.9 15.9 21.4 21.4',
)

/**
 * The reference pair: moon ↔ sun.
 * The only pair whose subpath counts differ (1 crescent → disc plus eight rays);
 * MorphSVGPlugin splits the extra subpaths out of the crescent.
 */
export const moonSunIcon = p(
  'M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z',
  'M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8 M12 1.8v2.4 M12 19.8v2.4 M1.8 12h2.4 M19.8 12h2.4 M4.6 4.6l1.7 1.7 M17.7 17.7l1.7 1.7 M19.4 4.6l-1.7 1.7 M6.3 17.7l-1.7 1.7',
)

/**
 * Globe. Active it turns hard: the front meridian swings edge-on to a near
 * straight line while the next one rotates into view on the limb.
 */
export const langIcon = p(
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3.4 9h17.2 M3.4 15h17.2 M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z M12 3h.01',
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3.4 9h17.2 M3.4 15h17.2 M12 3c1 2.4 1.6 5.6 1.6 9s-.6 6.6-1.6 9c-2.9-2.4-4.4-5.6-4.4-9s1.5-6.6 4.4-9z M12 3c3.5 2.4 5.4 5.6 5.4 9s-1.9 6.6-5.4 9',
)

/** Tick. Idle a bare tick; active it draws in and its badge ring lands around it. */
export const checkIcon = p(
  `M5.2 12.4 9.8 17 20.2 6 ${ringSeed(12, 12)}`,
  `M7 12.3 10.6 15.9 17 8.3 ${RING}`,
)

/** Cross. Idle a bare cross; active it draws in and its badge ring lands around it. */
export const xIcon = p(
  `M6.2 6.2 17.8 17.8 M17.8 6.2 6.2 17.8 ${ringSeed(12, 12)}`,
  `M7.8 7.8 16.2 16.2 M16.2 7.8 7.8 16.2 ${RING}`,
)

/** Clock. Active the hands sweep round to the hour and a motion arc flies off the crown. */
export const clockIcon = p(
  'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6 M12 6.8v5.4l3.4 2 M12 3.2h.01',
  'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6 M12 5.8v6.2h5.8 M12 1.2a10.8 10.8 0 0 1 7.7 3.2',
)

/** Page. Active the text clears and it is signed off with a check. */
export const documentIcon = p(
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 12.4h6 M9 16.4h3.6 M12.6 16.4h.01',
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 11.6h6 M9 14.6h1.8 M9.2 17.4 11.4 19.6 16.2 14',
)

/** Upload. Active the arrow leaps clear out of the tray, which drops away under it. */
export const uploadIcon = p(
  'M12 15.4V6.8 M8.2 10.6 12 6.8l3.8 3.8 M4 16.4v2.6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.6',
  'M12 12.6V2.6 M7.6 7 12 2.6l4.4 4.4 M3.2 17.4v1.6a2 2 0 0 0 2 2h13.6a2 2 0 0 0 2-2v-1.6',
)

/** Warning. Active the triangle swells to the edges of the box and the bang lengthens. */
export const alertIcon = p(
  'M12 5.2 20.4 19.6H3.6z M12 10.2v3.6 M12 16.6h.01',
  'M12 2.2 22.6 20.8H1.4z M12 8v5.8 M12 17.6h.01',
)

/** Currency mark. Idle a bare mark; active it takes its coin — money that landed. */
export const moneyIcon = p(
  `M12 4.4v15.2 M8.4 7.8h5.8a2.6 2.6 0 0 1 0 5.2H9.8a2.6 2.6 0 0 0 0 5.2h6 ${ringSeed(12, 12)}`,
  `M12 5v14 M9 8.2h4.8a2.4 2.4 0 0 1 0 4.8h-3.8a2.4 2.4 0 0 0 0 4.8h5 ${RING}`,
)

/** Trend. Active the line steepens into a spike and an arrowhead breaks out of its tip. */
export const chartIcon = p(
  'M4 3.6v16.8h16.4 M7.4 15.6l3.4-3.6 3 2.4 4.8-5.4 M18.6 9h.01',
  'M4 3.6v16.8h16.4 M7.4 17.6l3.4-4.8 3 2.2 5.2-8.4 M14.6 6.6h5v5',
)

/**
 * Arrow. Idle a level shaft with a square-on head; active the shaft bows and
 * lifts into a swoosh and the head swings round with it, so the gesture reads
 * as the arrow taking off rather than as the same arrow scaled up.
 *
 * The idle shaft is written as a straight cubic rather than an `h`, so both
 * states have the same commands and the tween is a pure bend. Head barbs are
 * the same length in both states, set at ±135° to whatever direction the shaft
 * arrives from — that is what keeps it reading as one arrowhead turning.
 */
export const arrowIcon = p(
  'M4.2 12C8.4 12 12.8 12 17 12 M13.9 8.9 17 12 13.9 15.1',
  'M3.2 14.4C7.8 14.4 13.8 13.2 18.2 10.6 M13.9 9.5 18.2 10.6 17.1 14.9',
)

/** Plus. Idle a bare plus; active it draws in and its badge ring lands around it. */
export const plusIcon = p(
  `M12 5.6v12.8 M5.6 12h12.8 ${ringSeed(12, 12)}`,
  `M12 7.4v9.2 M7.4 12h9.2 ${RING}`,
)

/* ── Status icons — used by StatusBadge ───────────────────────────────────── */

export const statusIcons: Record<string, MorphPaths> = {
  new: plusIcon,
  incomplete: alertIcon,
  under_review: searchIcon,
  awaiting_interview: interviewIcon,
  approved: checkIcon,
  rejected: xIcon,
  disbursed: moneyIcon,
  follow_up: followUpIcon,
}
