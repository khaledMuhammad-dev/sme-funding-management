/**
 * Deterministic helpers for the demo fixtures.
 * No `Math.random()` anywhere — the same demo renders identically on every reload,
 * so a screen-share never surprises whoever is presenting.
 */

/** Mulberry32 — small, fast, seeded PRNG. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function pick<T>(items: readonly T[], r: number): T {
  return items[Math.floor(r * items.length) % items.length]
}

export function intBetween(r: number, min: number, max: number): number {
  return min + Math.floor(r * (max - min + 1))
}

/** Anchor for every relative date in the fixtures — captured once per session. */
export const NOW = new Date()

export function daysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() - days)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function daysAhead(days: number, hour = 10, minute = 0): string {
  return daysAgo(-days, hour, minute)
}

/** Zero-padded sequence: `pad(7, 4)` → `'0007'`. */
export function pad(n: number, width = 4): string {
  return String(n).padStart(width, '0')
}
