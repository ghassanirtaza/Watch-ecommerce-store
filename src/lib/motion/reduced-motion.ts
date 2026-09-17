/**
 * CSS's prefers-reduced-motion media query (globals.css) does not stop a
 * GSAP timeline that's already running via JS-driven transforms — GSAP
 * must check this explicitly. Call this before building any GSAP
 * timeline; if true, either skip the animation entirely or use GSAP's
 * own instant-set (duration: 0) instead of an eased tween.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wraps a GSAP timeline factory so reduced-motion users get an instant
 * end-state instead of the animated version, without every call site
 * having to remember the check.
 *
 * Usage:
 *   const tl = withReducedMotionGuard(() => gsap.timeline()...);
 */
export function withReducedMotionGuard<T>(buildTimeline: () => T, buildInstant: () => T): T {
  return prefersReducedMotion() ? buildInstant() : buildTimeline();
}
