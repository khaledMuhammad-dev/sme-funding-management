import type { MorphPaths } from './MorphIcon'

/**
 * Icon path library. One stroke-based `<path d>` on a 24×24 grid per icon so
 * GSAP can morph between the two states.
 *
 * RULE: `idle` is the COMPLETE icon — every part that makes it recognisable is
 * already drawn. `active` is the SAME icon with parts nudged: a door opens a
 * little, a clock hand advances, a bar grows, a gear turns a few degrees. The
 * morph is a flourish, never the moment the icon becomes legible.
 *
 * Both states keep the same subpath count and order so the tween stays clean.
 */

const p = (idle: string, active: string): MorphPaths => ({ idle, active })

/* ── Navigation ───────────────────────────────────────────────────────────── */

/** House with its door — the door widens and rises slightly, as if opening. */
export const homeIcon = p(
  'M3 10.6 12 3.2l9 7.4V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9.6 21v-5.8h4.8V21',
  'M3 10.6 12 3.2l9 7.4V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21v-7.2h6V21',
)

/** Page with two lines of text — the short line fills out to full width. */
export const applicationsIcon = p(
  'M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5 M8.6 13.2h6.8 M8.6 16.8h3.8',
  'M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5 M8.6 13.2h6.8 M8.6 16.8h6.8',
)

/** Speech bubble with three dots — the middle dot lifts, as in a typing state. */
export const interviewIcon = p(
  'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8 10.6h.01 M12 10.6h.01 M16 10.6h.01',
  'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M8 11.2h.01 M12 9.2h.01 M16 11.2h.01',
)

/** Document with a signature line — the signature swells into a fuller flourish. */
export const contractIcon = p(
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 16.6c1.2-1.5 2.4-1.5 3.6 0s2.3.7 3.3-.4',
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 17.2c1.2-2.7 2.4-2.7 3.6 0s2.3 1.3 3.3-.7',
)

/** Bank card with its stripe and chip — the chip stretches a touch. */
export const disbursementIcon = p(
  'M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M2 10.8h20 M5.8 14.4h3.4',
  'M3 7h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z M2 10.8h20 M5.8 14.4h5.6',
)

/** Reset-clock with hands — the minute hand advances a few minutes. */
export const followUpIcon = p(
  'M20.6 12a8.6 8.6 0 1 1-2.6-6.1 M20.9 3.4v4.2h-4.2 M12 7.6v4.6l3.2 1.9',
  'M20.6 12a8.6 8.6 0 1 1-2.6-6.1 M20.9 3.4v4.2h-4.2 M12 7.6v4.6l3.8 1',
)

/** Bar chart on a baseline — the bars grow. */
export const reportsIcon = p(
  'M3 20.8h18 M6.6 20.8V11.4 M11.8 20.8V7.4 M17 20.8V14.2',
  'M3 20.8h18 M6.6 20.8V9 M11.8 20.8V5 M17 20.8V11.6',
)

/**
 * Gear — a toothed body around a hub, not a starburst.
 *
 * Both shapes are the same 32-point outline (8 teeth) so MorphSVG pairs points
 * one-to-one; the active shape is the identical gear turned half a tooth pitch,
 * which reads as the gear rotating rather than the teeth reshaping.
 */
export const settingsIcon = p(
  'M10.37 2.64L13.63 2.64L13.29 5.22L15.88 6.29L17.46 4.23L19.77 6.54L17.71 8.12L18.78 10.71L21.36 10.37L21.36 13.63L18.78 13.29L17.71 15.88L19.77 17.46L17.46 19.77L15.88 17.71L13.29 18.78L13.63 21.36L10.37 21.36L10.71 18.78L8.12 17.71L6.54 19.77L4.23 17.46L6.29 15.88L5.22 13.29L2.64 13.63L2.64 10.37L5.22 10.71L6.29 8.12L4.23 6.54L6.54 4.23L8.12 6.29L10.71 5.22Z M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0Z',
  'M14.07 2.73L17.09 3.98L15.79 6.23L17.77 8.21L20.02 6.91L21.27 9.93L18.76 10.6L18.76 13.4L21.27 14.07L20.02 17.09L17.77 15.79L15.79 17.77L17.09 20.02L14.07 21.27L13.4 18.76L10.6 18.76L9.93 21.27L6.91 20.02L8.21 17.77L6.23 15.79L3.98 17.09L2.73 14.07L5.24 13.4L5.24 10.6L2.73 9.93L3.98 6.91L6.23 8.21L8.21 6.23L6.91 3.98L9.93 2.73L10.6 5.24L13.4 5.24Z M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0Z',
)

/** Four dashboard panels — the panels trade proportions. */
export const dashboardIcon = p(
  'M4 4h6.4v6.4H4z M13.6 4H20v4.2h-6.4z M4 13.6h6.4V20H4z M13.6 11.4H20V20h-6.4z',
  'M4 4h6.4v4.2H4z M13.6 4H20v6.4h-6.4z M4 11.4h6.4V20H4z M13.6 13.6H20V20h-6.4z',
)

/* ── Actions & status ─────────────────────────────────────────────────────── */

/** Bell with clapper — the skirt flares and the clapper swings. */
export const bellIcon = p(
  'M18 15.4V10a6 6 0 1 0-12 0v5.4L4.4 17.8h15.2z M10 19.6a2 2 0 0 0 4 0',
  'M18.4 15.4V10a6 6 0 1 0-12 0v5.4L3.6 18.2h17.2z M10.7 19.6a2 2 0 0 0 4 0',
)

/** Head and shoulders — the shoulders broaden slightly. */
export const userIcon = p(
  'M12 3.8a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8 M4.9 20.3a7.1 7.1 0 0 1 14.2 0',
  'M12 3.5a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8 M4.1 20.3a7.9 7.9 0 0 1 15.8 0',
)

/** Magnifier — the handle extends, as if pushed forward. */
export const searchIcon = p(
  'M11 3.6a7.4 7.4 0 1 0 0 14.8 7.4 7.4 0 0 0 0-14.8 M16.4 16.4 20.4 20.4',
  'M10.6 3.6a7.4 7.4 0 1 0 0 14.8 7.4 7.4 0 0 0 0-14.8 M16 16 21.2 21.2',
)

/**
 * The one deliberate exception: moon ↔ sun.
 * Both states are complete icons — the shape change IS the theme state, not a
 * detail being revealed, so this pair breaks the "nudge only" rule on purpose.
 * It is also the only pair whose subpath counts differ (1 crescent → disc plus
 * eight rays); MorphSVGPlugin splits the extra subpaths out of the crescent.
 */
export const moonSunIcon = p(
  'M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z',
  'M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8 M12 1.8v2.4 M12 19.8v2.4 M1.8 12h2.4 M19.8 12h2.4 M4.6 4.6l1.7 1.7 M17.7 17.7l1.7 1.7 M19.4 4.6l-1.7 1.7 M6.3 17.7l-1.7 1.7',
)

/** Globe with meridian — the meridian narrows, as if the globe turns. */
export const langIcon = p(
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3.4 9h17.2 M3.4 15h17.2 M12 3c2.5 2.4 3.9 5.6 3.9 9s-1.4 6.6-3.9 9c-2.5-2.4-3.9-5.6-3.9-9s1.4-6.6 3.9-9z',
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3.4 9h17.2 M3.4 15h17.2 M12 3c1.3 2.4 2 5.6 2 9s-.7 6.6-2 9c-1.3-2.4-2-5.6-2-9s.7-6.6 2-9z',
)

/** Tick — the same stroke, drawn a little bolder and wider. */
export const checkIcon = p('M4.8 12.6 9.6 17.4 19.2 7.2', 'M4.1 12.3 9.4 17.7 19.9 6.5')

/** Cross — rotates a few degrees. */
export const xIcon = p(
  'M6.2 6.2 17.8 17.8 M17.8 6.2 6.2 17.8',
  'M6.9 5.6 18.4 17.1 M17.1 5.6 5.6 17.1',
)

/** Clock with hands — the minute hand advances. */
export const clockIcon = p(
  'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6 M12 6.8v5.4l3.4 2',
  'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6 M12 6.8v5.4l4 1',
)

/** Page with fold and two text lines — the short line fills out. */
export const documentIcon = p(
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 13.2h5.8 M9 16.8h3.6',
  'M7 3h7l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v4h4 M9 13.2h5.8 M9 16.8h5.8',
)

/** Tray with an arrow — the arrow lifts out of the tray. */
export const uploadIcon = p(
  'M12 15.2V4.6 M7.9 8.7 12 4.6l4.1 4.1 M4 16.6v2.4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.4',
  'M12 14V3.4 M7.9 7.5 12 3.4l4.1 4.1 M4 16.6v2.4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.4',
)

/** Warning triangle with its bang — the triangle swells a little. */
export const alertIcon = p(
  'M12 3.8 21.2 19.9H2.8z M12 9.7v4.3 M12 16.9h.01',
  'M12 3.2 21.9 20.3H2.1z M12 9.3v4.7 M12 17.2h.01',
)

/** Currency mark — the stem grows past the curve. */
export const moneyIcon = p(
  'M12 4.4v15.2 M8.3 7.9h5.9a2.6 2.6 0 0 1 0 5.2H9.8a2.6 2.6 0 0 0 0 5.2h6.1',
  'M12 3.4v17.2 M8.3 7.4h5.9a2.6 2.6 0 0 1 0 5.2H9.8a2.6 2.6 0 0 0 0 5.2h6.1',
)

/** Axes with a trend line — the peak climbs. */
export const chartIcon = p(
  'M4 4v16h16 M7.6 15.4l3.4-3.8 3 2.4 4.9-5.7',
  'M4 4v16h16 M7.6 16.6l3.4-4.9 3 2.4 4.9-7',
)

/** Arrow — nudges forward. */
export const arrowIcon = p(
  'M4.6 12h13.8 M12.9 6.6 18.4 12l-5.5 5.4',
  'M3.6 12h15.8 M13.9 6.6 19.4 12l-5.5 5.4',
)

/** Plus — the arms extend. */
export const plusIcon = p('M12 5.6v12.8 M5.6 12h12.8', 'M12 4.5v15 M4.5 12h15')

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
