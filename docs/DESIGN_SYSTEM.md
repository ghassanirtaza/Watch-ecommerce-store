# Design System — Usage Rules

Tokens live in `src/app/globals.css` as CSS variables. This file is the
*rules* for using them — read it before adding new components.

## Placeholder status
Colors, fonts, and spacing in `globals.css` are placeholders. Replace
with the real brand palette before storefront work begins in Phase 3.
Everything downstream should already be wired to variables, so this
should be a one-file change, not a find-and-replace across components.

## Motion — GSAP scoping rule (non-negotiable, see AI_CONTEXT.md)

GSAP is for **premium storytelling on specific interactive surfaces
only**:
- PDP image gallery (zoom, transitions between images)
- Homepage hero (entrance sequencing)
- Possibly: cart drawer open/close if CSS transitions feel insufficient

GSAP is **not** for:
- Basic list/card enter animations — use CSS transitions
- Hover states — use CSS
- Page transitions — Next.js App Router handles this; do not fight it
  with GSAP

Every component that imports `gsap` must:
1. Be a client component (`"use client"`).
2. Be loaded via `next/dynamic` with `ssr: false` from its parent, so
   GSAP never ships in the server-rendered payload or blocks first
   paint.
3. Call `prefersReducedMotion()` / `withReducedMotionGuard()` from
   `src/lib/motion/reduced-motion.ts` before building any timeline.

If you're reaching for GSAP outside the two-or-three surfaces above,
that's the signal to stop and use CSS instead — this rule will not
enforce itself in code review, so treat it as a hard constraint when
writing the component, not a suggestion to reconsider later.

## Accessibility baseline
- Every interactive element must have a visible focus state (global
  `:focus-visible` rule already handles most cases — don't override it
  with `outline: none` without an equally visible replacement).
- Color contrast: body text against `--color-bg` must meet WCAG 2.2 AA
  (4.5:1). Verify any new color pairing before shipping, especially
  gold-on-dark combinations which are easy to get wrong.
- Any admin-configurable text-over-image content (banners, hero) needs
  either a safe overlay/scrim by default or a contrast warning in the
  admin UI — see AI_CONTEXT.md, this was flagged as a review gap.

## Spacing & typography
Use the `--space-*` scale for margin/padding — don't introduce
one-off pixel values. `--font-display` is for headings/hero copy only;
body copy always uses `--font-body`.
