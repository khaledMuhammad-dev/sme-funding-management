import gsap from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

/** Registered exactly once — every morph in the app goes through this instance. */
let registered = false

export function ensureGsap() {
  if (!registered) {
    gsap.registerPlugin(MorphSVGPlugin)
    registered = true
  }
  return gsap
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export { gsap }
