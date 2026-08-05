/**
 * Demo signature marks.
 *
 * The organisation's signature is configured once in `/admin/settings` and
 * stamped onto every contract it issues. A presenter who never opens Settings
 * must still get a properly issued contract, so a default signatory ships
 * pre-configured here — it is editable, and resettable, from that screen.
 *
 * The marks are inline SVG data-URLs rather than PNGs: deterministic (no
 * canvas, no `Math.random`), tiny, and they stay crisp when the contract is
 * printed. Their ink colours are chosen to read on both the light and the dark
 * card background — an `<img>` cannot inherit the theme's foreground the way
 * the live signature pad does.
 */

/** A handwritten-looking flourish, as a self-contained SVG data-URL. */
function signatureMark(color: string, variant: 'a' | 'b') {
  const stroke =
    variant === 'a'
      ? 'M12 62 C 34 20, 48 18, 52 40 C 56 62, 44 74, 40 62 C 36 50, 60 30, 78 44 C 90 54, 84 68, 92 66 C 104 64, 112 30, 128 28 C 140 27, 132 62, 146 62 C 158 62, 160 34, 174 34 C 186 34, 182 62, 196 60 C 214 58, 222 24, 244 30 C 262 35, 250 66, 268 62 C 284 58, 296 44, 306 34'
      : 'M14 58 C 30 26, 46 22, 54 44 C 60 62, 46 72, 44 58 C 42 42, 70 26, 84 46 C 96 62, 86 72, 98 68 C 116 62, 106 28, 126 30 C 144 32, 136 66, 154 62 C 172 58, 168 30, 186 34 C 202 38, 194 66, 212 62 C 232 58, 236 28, 258 34 C 276 39, 268 64, 288 56 C 296 53, 302 46, 308 40'
  const underline =
    variant === 'a'
      ? 'M96 78 C 150 70, 220 70, 288 76'
      : 'M70 80 C 140 72, 210 72, 282 78'

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 90" width="320" height="90">` +
    `<path d="${stroke}" fill="none" stroke="${color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${underline}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>` +
    `</svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** The signatory the demo ships with, so contracts are never issued unsigned. */
export const DEFAULT_ORG_SIGNATORY_NAME = 'د. هيفاء العتيبي'

/** The organisation's configured signature mark. */
export const DEFAULT_ORG_SIGNATURE_IMAGE = signatureMark('#C2683F', 'a')

/** Stand-in beneficiary mark for contracts the fixtures ship already completed. */
export const SEED_BENEFICIARY_SIGNATURE_IMAGE = signatureMark('#5B8DEF', 'b')
