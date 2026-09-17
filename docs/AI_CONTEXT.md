# AI_CONTEXT.md

Keep this file updated throughout development. Any assistant or engineer
picking up this project should be able to read this file first and
understand the architecture, decisions, and open items without re-reading
the full spec history.

## What this project is
Premium, highly-animated watch e-commerce platform. Pakistan-only launch.
Single-vendor B2C. Free shipping default. COD (admin-toggleable) + hosted
card payment. PKR only.

## Core architectural principle
Modular monolith. Do not introduce microservices, a dedicated search
engine, or new infrastructure until real scale requires it. Server is
authoritative for price, stock, discount, role, permissions, tax, and
shipping cost — client input for any of these is never trusted.

## Stack
Next.js App Router + React + TypeScript strict, Tailwind, GSAP (scoped
usage only — see Open Decisions). PostgreSQL + Prisma. Better Auth. Zod.
Cloudinary. Resend + React Email. Upstash Redis (rate limiting only, not
a database). Sentry. PostHog. Vitest + Playwright. Vercel + managed
Postgres.

## Data model
See `prisma/schema.prisma` — single source of truth. Key invariants:
- Price/SKU/stock live on `ProductVariant`, never on `Product`.
- `OrderItem` stores an immutable snapshot (name, image, SKU, price) —
  historical orders never depend on mutable current product data.
- Products/categories/coupons are soft-deleted only (status = ARCHIVED).
  Never hard-delete anything referenced by a historical order.
- All stock mutation happens through `InventoryTransaction`. Never
  mutate `Inventory.availableQuantity` directly.
- `InventoryReservation` is DB-backed (not Redis) — correctness must not
  depend on an external cache surviving.

## Rules that must never be violated
1. Client-supplied price, stock, discount, role, permission, tax, or
   shipping cost is never trusted — server recomputes everything at
   order confirmation.
2. Payment webhooks require signature verification + idempotency key.
   Duplicate webhook delivery must be a no-op.
3. Stock decrements are atomic conditional updates
   (`WHERE available_quantity >= requested_quantity`), never
   read-then-write.
4. Order/payment creation is two-phase: pending order + payment intent
   created first, confirmed only after verified provider result.
5. Reviews' "Verified Purchase" is derived from order data
   (`OrderItem` linkage), never a client-supplied checkbox.
6. Returns require an inspection checkpoint (`inspectionPassed`) between
   approval and refund — not a single-step approve-then-refund. This
   matters specifically for high-value watches (anti-swap fraud).

## Open decisions (not yet made — do not assume either direction)
- **Serial-level inventory tracking**: `SerializedUnit` model exists in
  schema but is unused by default. Decide whether any product tier
  needs per-unit serial tracking (warranty registration, insurance,
  anti-swap-fraud on returns) before building fulfillment flows around
  it either way.
- **Payment gateway**: not yet selected. Needs Pakistan merchant
  onboarding, settlement terms, 3DS support, and transaction fees
  verified. This has external lead time — start this in parallel with
  Phase 0/1, not when Phase 4 (checkout) begins.
- **WhatsApp Business API**: requires Meta approval + template review.
  External lead time can be weeks. Start the approval process
  immediately if WhatsApp support is meant to be live at launch.
- **Courier(s)**: `Shipment` model supports `courierName` as a free
  string with a `CourierProvider`-style abstraction expected at the
  service layer (mirroring `PaymentProvider`). Which courier(s) —
  TCS / Leopards / PostEx / M&P — is a business decision.

## Known gaps flagged in architecture review — resolve before relevant phase
- No Postgres connection pooling strategy chosen yet (PgBouncer vs
  Prisma Accelerate). Must be decided in Phase 0 — Prisma + Vercel
  serverless without pooling will exhaust connections under load.
- Reservation expiry: implement as lazy-expiry (any read treats
  `expiresAt < now()` as expired) plus a periodic cleanup job for
  hygiene. Do not rely on a cron-only sweep as the correctness
  mechanism — Vercel functions are not long-running.
- COD remittance/RTO reconciliation: `Shipment.codRemittedAt` /
  `codRemittedAmount` fields exist but the reconciliation workflow
  (matching courier cash remittance against COD orders) is not yet
  designed. Needed before COD volume is meaningful.
- Bulk CSV import needs a dry-run/validation pass and per-row error
  reporting before it's safe to ship — not yet designed.
- No backup/disaster-recovery policy documented yet. Confirm managed
  Postgres backup + tested restore before launch.
- GSAP vs. performance budget: GSAP must be scoped to specific
  interactive surfaces only (PDP gallery, homepage hero), loaded via
  `next/dynamic` with no SSR, never used for basic list/card
  transitions (CSS handles those). Enforce this per-component, it will
  not enforce itself.

## MVP scope (P0)
Storefront (home/category/PDP/search/cart/checkout), card + COD
payment, inventory + reservations, orders, guest + customer accounts,
admin (products/variants/categories/inventory/customers/orders/coupons/
reviews), basic CMS (fixed section types only — no page builder),
banners, navigation, free shipping, basic returns (with inspection
checkpoint), RBAC (6 fixed roles), audit logs, email notifications,
SEO/accessibility basics, CSV import/export.

Explicitly NOT in MVP: typo-tolerant search, synonyms, dedicated search
engine, arbitrary homepage block builder, custom role editor, MFA
(except optionally Super Admin), advanced recommendations,
back-in-stock automation, gift cards, loyalty program, multi-location
inventory, mobile app, BNPL, Apple/Google Pay, multi-currency.

## Phase 1 status (auth + RBAC + design system)
Done:
- Better Auth wired (`src/lib/auth/config.ts`) — email/password,
  30-day sessions, cookie caching, built-in rate limiting. `Account`
  and `Verification` models added to schema for Better Auth's
  credential/token storage.
- `isAdminUser` boolean added to `User` — coarse gate keeping the admin
  surface logically distinct from storefront customers even though
  they share one auth system.
- `src/lib/auth/session.ts` — `requireSession()`, `requirePermission()`,
  `requireOwnership()`. Every protected server action/route handler
  must call these; middleware is UX-only, not the security boundary.
- `src/middleware.ts` — coarse `/admin/*` gate. Explicitly documented
  as bypassable (direct server action calls) so nobody mistakes it for
  the real authorization layer.
- `prisma/seed.ts` — seeds all permissions, all 6 roles, role-permission
  mappings from `ROLE_PERMISSIONS`, and an optional Super Admin bootstrap
  via `BOOTSTRAP_SUPER_ADMIN_EMAIL` env var. Note: seed creates the user
  shell only — password must still be set through Better Auth's own
  sign-up flow with the same email.
- Design system: CSS variables in `globals.css` (placeholder palette,
  swap before Phase 3 storefront work), `docs/DESIGN_SYSTEM.md` with
  the actual usage rules — most importantly the GSAP scoping rule
  (client-component + `next/dynamic` + `ssr:false` + reduced-motion
  guard, restricted to PDP gallery / hero / maybe cart drawer only).
- `src/lib/motion/reduced-motion.ts` — JS-level reduced-motion guard,
  since the CSS media query alone can't stop a running GSAP tween.

Not done yet:
- Login/register/forgot-password UI (Phase 3, storefront pages) and
  admin login page (referenced by middleware redirect, doesn't exist
  yet).
- OTP/phone verification flow for COD (Phase 4, tied to checkout).
- Real design tokens (brand palette placeholder still in place).
- CI pipeline, Sentry/PostHog wiring.

## Phase 2 status (products, categories, variants, media, inventory)
Done:
- `src/lib/validation/product.ts` — Zod schemas for product/variant/
  category input, including watch-domain attributes (movement type,
  case material/diameter, water resistance, warranty, authenticity
  certificate, box-and-papers).
- `src/domain/products/service.ts` — create/update/publish/archive/
  duplicate. Slug changes auto-create a `Redirect` row (non-optional).
  Archive only, never hard-delete. Product status has no manual
  "Out of Stock" — that stays derived from inventory at read time.
- `src/domain/products/categories.ts` — create/delete/reorder. Delete
  is blocked if any product or subcategory still references it.
- `src/domain/products/variants.ts` — create/update, plus
  `generateVariantMatrix()` for cartesian-product variant generation
  from attribute sets (e.g. case size × strap color). SKU is
  immutable after creation — it's referenced by historical OrderItem
  snapshots and (if used) SerializedUnit records.
- `src/domain/inventory/adjustment.ts` — admin-driven stock changes
  (restock/damaged/adjustment/return), kept deliberately separate from
  `reservation.ts` (checkout-driven). Includes `bulkAdjustStock()` —
  two-phase CSV import (validate-all-rows-first, per-row error report,
  all-or-nothing commit) addressing the bulk-import gap flagged in
  architecture review.
- `src/lib/storage/cloudinary.ts` — signed direct-upload so the API
  secret never reaches the client; server re-verifies actual
  format/size after upload rather than trusting client-reported
  values.
- `src/domain/content/media.ts` — registers verified uploads as
  `MediaAsset` rows, alt text required at registration time (not
  optional-then-nagged-later), delete blocked while still referenced
  by any product/banner/review.
- `src/lib/logging/audit.ts` — shared audit-log helper, used by every
  mutating service above.
- Added `Account`/`Verification` models (Phase 1) and a
  `@@unique([productId, key])` constraint on `ProductAttribute`
  (Phase 2 fix — the original upsert-by-id draft was wrong; fixed
  during this build rather than left in).
- Seed script now also creates the primary `InventoryLocation`, since
  variant creation requires one to exist.

Not done yet:
- Rich text sanitization is a stopgap regex strip in
  `src/lib/validation/sanitize.ts` — explicitly flagged not safe for
  production, needs a real library (e.g. `isomorphic-dompurify`)
  before Phase 6 (CMS) ships.
- Admin UI (product form, variant matrix builder, inventory table,
  media library grid) — this phase built the service/domain layer
  only, not the React components that call it.
- Serial-level tracking (`SerializedUnit`) is still unused by
  services — open decision noted above, not resolved.

## Phase 3 status (storefront: search, filters, PDP, cart, wishlist)
Done:
- `src/domain/cart/service.ts` — guest + customer cart, add/update/
  remove, merge-on-login (sums quantities, never overwrites), and
  `computeCartTotals()` — the only source of truth for cart totals.
  Best-effort stock check on add-to-cart is explicitly NOT the
  authoritative check (that's `reserveStock()` at checkout, Phase 4).
- `src/lib/search/postgres-search.ts` — Postgres ILIKE search per
  AI_CONTEXT.md (no dedicated search engine). `searchProducts`,
  `autocompleteProducts`, `getZeroResultFallback`. Input sanitized
  beyond Prisma's parameterization as defense in depth.
- `src/domain/products/storefront-read.ts` — read-only PDP/listing
  queries, deliberately separate from the admin write service. Query
  params (filters/sort/page) validated server-side, never trusted
  as-is. AggregateRating eligibility (review count threshold) is
  computed here but rendering the structured data is left to the page
  — service shouldn't decide presentation.
- `src/domain/customers/wishlist.ts` — toggle/list/share. Sharing uses
  `crypto.randomUUID()` (non-guessable) per spec, not a sequential ID.
- `src/domain/products/back-in-stock.ts` — subscribe/list/mark-notified.
  NOTE: not yet wired to the restock trigger in
  `domain/inventory/adjustment.ts` — needs the notification dispatch
  queue (not built) to actually send anything. Flagged, not silently
  incomplete.
- Storefront pages: category listing (`(storefront)/category/[slug]`),
  PDP (`(storefront)/products/[slug]`), search
  (`(storefront)/search`) — all server components with `Suspense` +
  skeleton fallbacks, empty/zero-result states matching the UX flow
  doc.
- `src/components/product/product-gallery.tsx` — the ONE approved
  GSAP surface built so far, loaded via `next/dynamic({ ssr: false })`
  from the PDP page per the design-system rule, with the
  reduced-motion guard actually wired in (not just documented).
- Variant selector requires every attribute dimension selected before
  enabling add-to-cart (per spec), shows low-stock/out-of-stock state
  per variant.
- `src/app/api/cart/items/route.ts` — guest cart cookie handling
  (httpOnly, secure in prod).

Not done yet:
- Cart drawer/page UI (service layer exists, no component yet).
- Filter panel is wired but category listing's "in stock only" filter
  is a placeholder (filters on "has any active variant," not a true
  live-inventory join) — flagged in `storefront-read.ts`, needs a real
  join before this is accurate.
- "Best selling" / "rating" sort options accept the param but fall
  back to newest-first — no order-volume/review-aggregate ranking data
  exists yet to sort by honestly.
- Recommendation widgets ("Complete the Look" equivalent, cross-sell)
  — not started, Phase 3 scope but deprioritized for cart/PDP/search
  core first.
- Autocomplete dropdown UI, breadcrumb component, wishlist page UI —
  services exist, components don't yet.

Self-correction during this build: two duplicate/unused files
(`domain/products/query.ts`, `components/product/product-gallery-loader.tsx`)
were generated but never imported anywhere — removed before packaging
to avoid two parallel, drifting implementations of search and gallery
loading. The kept versions are `domain/products/storefront-read.ts` +
`lib/search/postgres-search.ts` (search/listing) and the inline
`next/dynamic` call in the PDP page (gallery loading).

## Phase 4 status (checkout, shipping, COD, payment, reservations, orders)

**IMPORTANT — read this before touching checkout/orders/payments/shipping.**
During this build, parallel/duplicate implementations of this entire
phase were generated (likely from tool-call retries) — two competing
versions of order creation, payment confirmation, COD verification,
and courier webhooks existed simultaneously at one point. They were
found and reconciled into ONE canonical implementation before
packaging; the inferior first drafts were deleted, not left alongside
the good ones. Documenting this so nobody re-discovers the same drift
and wonders which version is real — there is only one now. If you ever
find two files that look like they solve the same problem, that's a
signal to stop and reconcile immediately, the way this phase did, not
to add a third.

Canonical implementation (what actually exists after reconciliation):
- `src/lib/validation/checkout.ts` — checkout input schemas, including
  a Pakistan city list and phone regex (`^(\+92|0)3\d{9}$`).
- `src/domain/inventory/reservation.ts` — `reserveCartStock()`
  (all-or-nothing, whole-cart reservation), `finalizeReservationsToSale()`
  (converts a hold into a permanent decrement — called immediately for
  COD, called from the payment webhook for CARD), `releaseReservations()`
  (payment failure / explicit cancellation), plus the lazy-expiry +
  sweep mechanism from Phase 0.
- `src/domain/coupons/service.ts` — `validateCoupon()` /
  `recordCouponRedemption()`, checks status/dates/minimum/eligibility/
  usage-limit/per-customer-limit. Called at checkout initiation
  (authoritative) — never trust a cart-page preview as still valid.
- `src/domain/customers/cod-verification.ts` — Redis-backed OTP
  send/verify (`sendCodOtp`, `verifyCodOtp`, `isPhoneVerifiedForCod`)
  and `checkCodEligibility()` (order value cap + risk-flag block).
  `isPhoneVerifiedForCod` is what checkout.ts actually checks — a
  client-supplied "phoneVerified: true" is never trusted.
- `src/domain/payments/adapters.ts` — `getPaymentProvider()`.
  `CodPaymentProvider` is real (COD flows through the same
  `PaymentProvider` interface as CARD). `UnimplementedCardPaymentProvider`
  throws on every method — intentional, not a bug, until a gateway is
  selected (see open decisions).
- `src/domain/orders/checkout.ts` — `initiateCheckout()`. Revalidates
  price/stock/coupon/COD-eligibility server-side, reserves stock,
  creates the order (CONFIRMED immediately for COD with stock
  finalized in the same flow; PENDING_PAYMENT for CARD with stock left
  reserved, not finalized, until the webhook confirms).
- `src/domain/orders/confirmation.ts` — `confirmCardPayment()`, called
  from the payment webhook route. DB-level idempotency via
  `PaymentTransaction.idempotencyKey`'s unique constraint (never trust
  provider-reported dedup alone). Finalizes reservations to a sale on
  success, releases them and cancels the order on failure.
  `cancelStalePendingOrders()` — safety net for CARD orders that never
  get any webhook at all (customer abandons the gateway page).
- `src/domain/orders/management.ts` — `cancelOrder()` (handles both
  the reservation-release case and the already-finalized-sale
  restoration case correctly, attempts an automatic refund for
  captured card payments), `transitionOrderStatus()` (validated
  forward-only state machine, no arbitrary jumps).
- `src/domain/orders/order-number.ts` — non-sequential order numbers
  (`WS-YYMMDD-XXXXX`) so order volume can't be estimated by diffing
  two order numbers.
- `src/domain/shipping/service.ts` — `createShipmentForOrder()`,
  `handleCourierStatusUpdate()`. Courier webhook wiring feeds directly
  into COD risk flagging (`incrementCodFailureCount`) — this is what
  actually closes the COD remittance/RTO gap flagged in architecture
  review, not just a schema field sitting unused.
- `src/lib/rate-limit/limiters.ts` — centralized Upstash rate limiters
  for OTP request/verify, coupon apply, checkout submit, and search —
  the search endpoint was flagged as missing rate limiting in
  architecture review; `searchLimiter` exists and IS wired into the
  search page (Phase 3 page updated during this phase to call it).
  `couponApplyLimiter` is defined but has no caller yet — there's no
  standalone "apply coupon" endpoint; coupon validation currently only
  runs inside checkout initiation, which already goes through
  `checkoutSubmitLimiter`. Wire `couponApplyLimiter` if/when a live
  cart-page "apply coupon" endpoint is built.
- `src/app/api/checkout/initiate/route.ts`,
  `src/app/api/checkout/cod-otp/send/route.ts`,
  `src/app/api/checkout/cod-otp/verify/route.ts`,
  `src/app/api/webhooks/payment/route.ts` — the live route surface.
  The payment webhook route currently calls `getPaymentProvider("CARD")`
  which throws (unimplemented) — this route is correctly wired and
  will work the moment a real adapter replaces
  `UnimplementedCardPaymentProvider`.
- Order confirmation page at `(storefront)/order-confirmation/[orderNumber]`.

Deleted during reconciliation (inferior first drafts, superseded by
the above): `domain/orders/cod-risk.ts`, `domain/payments/webhook-handler.ts`,
`domain/shipping/webhook-handler.ts`, `lib/auth/otp.ts`,
`app/api/checkout/route.ts`, `app/api/checkout/otp/request/route.ts`,
`app/api/checkout/otp/verify/route.ts`.

Not done yet:
- Real card gateway adapter (external dependency, see open decisions).
- Real courier adapter(s) (external dependency, see open decisions).
- Actual SMS/WhatsApp dispatch for COD OTP — `sendCodOtp` returns the
  code directly in non-production for testing and throws in
  production until a provider is wired. Do not ship production COD
  without fixing this — right now no OTP would ever reach a real phone.
- Checkout UI (address form, payment method selection, OTP input) —
  this phase built the API/domain layer; no React checkout pages yet.
- Refund path for card payments is wired in `cancelOrder()` but
  untestable until the card adapter is real.
- `couponApplyLimiter` unwired (see above).
- Reservation cleanup cron route (`sweepExpiredReservations`,
  `cancelStalePendingOrders`) exposed at `/api/cron/sweep`, guarded by
  a `CRON_SECRET` bearer token. Configure a Vercel Cron entry (e.g.
  every 5 min) to call it — not done automatically by writing the
  route file, needs `vercel.json` cron config at deploy time.

## Phase 5 status (coupons admin, reviews, returns, notifications)

Checked the file listing before starting this phase, given the Phase 4
duplication incident — nothing pre-existed for coupons-admin/reviews/
returns/notifications except `domain/coupons/service.ts` (Phase 4,
validation only). No drift this phase.

Done:
- `src/domain/coupons/admin.ts` — admin create/status-toggle/list,
  separate from the customer-facing validation service (Phase 4) the
  same way admin product writes are separate from storefront reads.
  Added a `coupons` permission domain (`coupons.read/create/update`)
  to `lib/permissions/permissions.ts` rather than overloading
  `products.*` for this — STORE_MANAGER granted all three.
- `src/domain/reviews/service.ts` — `submitReview()`. Verified-purchase
  status is resolved server-side from a DELIVERED order containing the
  product for this customer — there is no client-settable "verified"
  field, per the non-negotiable rule. One review per customer per
  product (not per order) to prevent rating-inflation via repeat
  purchases. `moderateReview()` for admin approve/reject/flag.
  `getProductRatingSummary()` centralizes the AggregateRating
  eligibility threshold (3+ approved reviews) so the PDP page and
  anything else needing it stay consistent.
- `src/domain/returns/service.ts` — full lifecycle: REQUESTED ->
  APPROVED -> ITEM_RECEIVED -> INSPECTED -> REFUND_ISSUED/EXCHANGE_ISSUED
  -> COMPLETED. `inspectReturn()` is the mandatory checkpoint — refund
  is only reachable after a passed inspection, never directly from
  approval. For serialized items (if a product tier opts into
  `SerializedUnit` tracking), a returned serial that doesn't match what
  was actually sold force-fails inspection regardless of what the admin
  submits — this is the concrete anti-swap-fraud mechanism for
  high-value watches flagged in architecture review, not just a schema
  field.
- `src/domain/notifications/email.ts` — Resend-based dispatch, every
  attempt logged via `EmailLog` (sent or failed) so silent delivery
  failure is debuggable. `sendOrderConfirmationEmail`,
  `sendShipmentUpdateEmail`, `notifyBackInStockSubscribers`.
- **Actually wired, not just built**: order-confirmation email fires
  from both `confirmation.ts` (card payment confirmed) and
  `checkout.ts` (COD order created); shipment-update email fires from
  `shipping/service.ts` on courier status change; back-in-stock
  emails fire from `inventory/adjustment.ts` when a RESTOCK/RETURN
  adjustment takes available quantity from ≤0 to >0. The Phase 3 gap
  ("back-in-stock subscription exists but nothing calls it") is
  closed.

Not done yet:
- Real Resend sending domain — `orders@example.com` is a placeholder
  in `email.ts`, must be replaced with a verified domain before launch
  or every send will fail.
- Email templates are inline HTML strings, not React Email components
  — functional but not using the `react-email` dependency already in
  `package.json`. Fine for now, worth revisiting for real design.
- Return request UI (customer-facing) and returns/reviews admin
  screens — service layer only, no React components this phase.
- Exchange path (`EXCHANGE_ISSUED`) has a status but no service
  function analogous to `issueReturnRefund()` — refund path is
  complete, exchange path is schema-ready but unimplemented.
- WhatsApp notification channel — schema supports it
  (`NotificationChannel.WHATSAPP`), `email.ts` only implements email.
  Blocked on the same WhatsApp Business API approval noted in earlier
  phases.

## Phase 6 status (admin CMS, analytics, audit log, site settings)

Checked file listing before starting — only pre-existing files were
`coupons/admin.ts` and `lib/logging/audit.ts`, both intentional from
earlier phases. No drift this phase.

Done:
- `src/domain/content/homepage.ts` — fixed section types only (HERO,
  PROMOTIONAL_BANNER, FEATURED_CATEGORY, PRODUCT_CAROUSEL, TEXT_BLOCK,
  NEWSLETTER_SIGNUP) per the design-system rule — no arbitrary block
  builder. Each type has its own Zod schema validating the `content`
  Json field's shape, which is what actually enforces "fixed types"
  rather than that being true only by convention. Reorder is a single
  bulk transaction. Rollback (`revertHomepageSectionToPreviousVersion`)
  reads the last AuditLog entry for the section rather than a separate
  version-history table — simplest thing that satisfies "revert to
  previous version" without a new table, revisit if multi-step undo is
  ever needed.
- `src/domain/content/banners.ts` — create/publish/archive,
  `getActiveBanners()` resolves the start/end scheduling window
  server-side so the storefront never has to reason about "is this
  live right now" itself.
- `src/domain/content/navigation.ts` — nav items capped at one level
  of nesting (dropdowns, not dropdowns-within-dropdowns) per spec's
  "header navigation, dropdowns" scope.
- `src/domain/content/pages.ts` — static pages (About/FAQ/Shipping
  Info/etc.), slug-change triggers an automatic redirect, same rule as
  products.
- `src/domain/analytics/dashboard.ts` — summary metrics, top products,
  recent orders, sales chart data. Explicitly NOT pre-aggregated/
  cached yet (the architecture-review gap) — written as a clean read
  layer so a caching layer (Next.js `unstable_cache` or a scheduled
  materialization table) can wrap these later without changing call
  sites. Low-stock count and sales-chart bucketing are done in
  application code rather than raw SQL — fine at MVP catalog/order
  volume, flagged as the first thing to revisit if either gets slow.
- `src/domain/audit/query.ts` — filterable audit log viewer
  (actor/resource-prefix/action/date-range), plus
  `getAuditLogForResource()` for a per-order/per-product activity tab.
- **New**: `SiteSetting` model (key-value store) added to schema —
  wasn't in the original data model. `src/domain/settings/service.ts`
  provides typed `getSetting()`/`updateSetting()` with defaults so
  missing keys never crash a read. Used this to close a real gap: COD
  order-value cap and the failed-delivery block threshold were
  hardcoded (an env var placeholder and a magic number "3") in Phase
  4 — both now read from `SiteSetting` via `getSetting()`, actually
  wired into `cod-verification.ts` and `shipping/service.ts`, not just
  added and left unused.

Not done yet:
- Admin UI for all of the above (homepage builder, banner manager,
  nav editor, page editor, dashboard charts, audit log table, settings
  form) — this phase built the service/domain layer only, same pattern
  as every phase before it.
- Dashboard caching/materialization layer (flagged above, not solved).
- `getSetting`'s type safety is real at the TS level but `SiteSetting.value`
  is `Json` in the DB with no runtime validation on read — a
  corrupted/malformed value written outside `updateSetting()` (e.g.
  directly in Prisma Studio) wouldn't be caught until something breaks
  downstream. Acceptable for MVP scope; a Zod-validated read would be
  the fix if this becomes a real problem.

## Phase 7 status (SEO, performance, accessibility, security hardening)

Checked file listing before starting — no drift this phase.

Done:
- `src/app/sitemap.ts` / `src/app/robots.ts` — Next.js App Router
  conventions, served at `/sitemap.xml` and `/robots.txt`. Robots
  explicitly disallows `/admin`, `/account`, `/checkout`, `/cart`,
  `/api`, `/order-confirmation` — belt-and-suspenders alongside the
  `X-Robots-Tag` header below.
- `next.config.ts` — **this file didn't exist until now**, meaning
  every response before this phase went out with bare Next.js
  defaults (no CSP, no HSTS, no frame-options). Closed: CSP (no
  `unsafe-inline` for scripts — GSAP and app code are bundled, not
  inline), HSTS, X-Frame-Options DENY, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy. Also registers
  `res.cloudinary.com` as an allowed `next/image` remote pattern, and
  adds `X-Robots-Tag: noindex, nofollow` on all `/admin/*` responses.
  **CSP will need adjusting** the moment a real payment gateway's
  hosted-checkout script, Sentry, or PostHog gets added — test each
  against this policy rather than assuming it works.
- PDP `generateMetadata()` — canonical URL, SEO title/description,
  Open Graph tags. Was entirely absent before this phase (flagged in
  architecture review as a real gap, not a nice-to-have). Also fixed
  a small inconsistency found while doing this: the PDP was computing
  the AggregateRating eligibility threshold inline (`reviewCount >= 3`)
  instead of calling `getProductRatingSummary()` from Phase 5, which
  centralizes that exact threshold — now uses the shared function so
  the two can't drift apart.
- `next/image` wired in `product-grid.tsx` and `product-gallery.tsx`,
  replacing raw `<img>` tags that were explicitly flagged as
  placeholders since Phase 3 ("replace once real asset domains are
  configured" — they now are, via `next.config.ts`). Caught and fixed
  a mistake made while doing this: `product-grid.tsx` doesn't need
  `next/image` to be a client component, and adding `"use client"`
  there would have needlessly pulled a server component into the
  client bundle, working against the "minimal client JS" performance
  goal — removed before packaging.
- `src/app/(storefront)/layout.tsx` — added a shared `<main
  id="main-content">` landmark for the whole route group, and a
  skip-link in `app/layout.tsx` pointing to it. Chose a shared layout
  over editing each page's root div individually so new storefront
  pages get this automatically rather than needing it remembered
  per-page.
- `src/lib/rate-limit/limiters.ts` — added `cartMutationLimiter`.
  Found during this phase: the cart add-to-cart API route
  (`/api/cart/items`) had been live and unauthenticated since Phase 3
  with zero rate limiting, unlike checkout/OTP/coupon/search which all
  had one from the start. Wired in.
- `loading.tsx` for category and PDP routes — Next.js file-convention
  streaming boundaries, reusing the Phase 3 skeleton components rather
  than duplicating markup.

Not done yet:
- CSP has not been tested against a real payment gateway script,
  Sentry, or PostHog — those aren't wired yet (Phase 0/4 open
  decisions), so the policy is a reasonable starting point, not a
  verified-working one.
- No automated accessibility audit (axe, Lighthouse CI) wired into
  anything — headers/landmarks/alt-text/focus-states have been applied
  by hand per component as each was built, not verified by tooling.
- Core Web Vitals have not been measured against anything real — no
  deployment exists yet to measure. The performance-relevant decisions
  (GSAP scoping, `next/image`, streaming loading states, minimal
  client JS) are in place as intended, but "meets the target" is
  unverified until there's a live site to run Lighthouse against.
- Structured data exists for Product/AggregateRating only — no
  Organization/BreadcrumbList schema yet.

## Phase 8 status (testing, staging, launch checklist)

Checked file listing before starting — no drift this phase, and this
is the last phase, so it also closes out the whole build.

Done:
- `vitest.config.ts` + `src/tests/order-number.test.ts` +
  `src/tests/checkout-validation.test.ts` — real, runnable unit tests
  against pure logic (order number format/uniqueness, Pakistan
  phone/address validation). These actually execute in this
  environment and were checked against the real schema files rather
  than written from assumption.
- `src/tests/integration/reservation.test.ts` — written honestly as
  `describe.skip`, not pretended to pass. This environment has no
  network access to provision a real Postgres instance, and the
  reservation/checkout concurrency logic is not meaningfully testable
  against a mock — it's exactly the kind of logic where a mock would
  test the mock, not the actual atomic-update behavior. The file
  documents what's needed to un-skip it (testcontainers or a CI
  Postgres service) and states explicitly why it isn't running yet
  rather than leaving that unstated.
- `playwright.config.ts` + `src/tests/e2e/smoke.spec.ts` — smoke-level
  only (boot + 404 behavior), explicitly not claiming checkout/payment
  e2e coverage that doesn't exist.
- `.github/workflows/ci.yml` — lint/typecheck/unit-test job wired to
  actually run. The Postgres-backed integration job is present but
  commented out with an explanation, rather than wired to run against
  nothing (which would either fail every PR or silently report false
  confidence via skipped tests appearing to "pass").
- `vercel.json` — cron schedule for `/api/cron/sweep` every 5 minutes,
  closing the gap flagged back in Phase 4 (the route existed, nothing
  triggered it).
- `docs/LAUNCH_CHECKLIST.md` — consolidates every "not done yet" item
  from every phase's AI_CONTEXT.md section into one blocking/
  should-fix/verify/business-decision checklist. This is the real
  deliverable of this phase — the individual phase sections above are
  the historical record of what happened and why; this file is what
  someone actually works from before flipping the site live.

This is the last phase. The project as it stands: complete
domain/service layer across catalog, inventory, cart, checkout,
payments, shipping, coupons, returns, reviews, notifications, CMS,
analytics, and audit logging — all built against the non-negotiable
rules in this document, cross-checked against each other, and
verified import-clean at every phase boundary. What's genuinely not
built is the UI (admin panel, checkout pages) and the external
integrations that were always going to require real accounts/approval
(payment gateway, courier, WhatsApp) — both are precisely scoped in
`docs/LAUNCH_CHECKLIST.md` rather than left as vague future work.

## Phase 9 status (checkout UI + admin UI — React pages)

This phase built actual UI on top of the service layer from Phases
1-8. Checked file listing first — no drift.

**A real bug was caught and fixed while building this**: the
`/admin/*` middleware (written in Phase 1, before any admin page
existed) redirected every unauthenticated `/admin/*` request to
`/admin/login` — including requests to `/admin/login` itself, which
would have infinite-redirect-looped the moment someone actually tried
to sign in. This was invisible until the login page existed to expose
it. Fixed in `src/middleware.ts` by exempting `/admin/login`
explicitly. Lesson for future phases: middleware/guard logic written
speculatively, before the thing it protects exists, needs to be
re-verified once that thing is actually built — it was never
exercised against the real case until now.

Also fixed while building: `domain/orders/management.ts`'s
`VALID_TRANSITIONS` map was a private const. The admin order detail
page needed the exact same map to render the right action buttons —
rather than hand-copying it into the UI (which would silently drift
the moment the backend map changed), exported it from
`management.ts` and imported it in the page.

Checkout UI (`src/app/(checkout)/`, `src/components/checkout/`,
`src/app/(storefront)/cart/`, `src/components/cart/`):
- Cart page — line items with quantity +/−/remove, "Proceed to
  Checkout." New API routes: `GET /api/cart` (read totals),
  `PATCH`/`DELETE /api/cart/items/[itemId]`.
- Checkout page — server-fetches cart totals, renders `<CheckoutForm>`.
- `CheckoutForm` — contact email, Pakistan address form (city dropdown
  from `PAKISTAN_CITIES`), payment method (COD/CARD), full COD OTP
  flow (send → dev-mode code surfaced in the UI since no real SMS
  provider is wired yet, per Phase 4/5 open items → verify → submit
  blocked until verified), coupon code, submits to
  `/api/checkout/initiate`, redirects to payment gateway or order
  confirmation based on the response.

Admin UI (`src/app/admin/`, `src/components/admin/`):
- Login page + layout with sidebar nav (`AdminNav`) that only renders
  once a valid admin session exists — login page itself renders
  chrome-free.
- Dashboard — wired to Phase 6's `getDashboardSummary`/`getTopProducts`/
  `getRecentOrders`.
- Products: list, new-product form, edit page with a variant manager
  (add variants inline, attributes entered as `Key: Value` lines
  rather than a full dynamic row editor — deliberately simple for this
  pass). New API routes: `POST /api/admin/products`,
  `PATCH`/`POST /api/admin/products/[id]` (POST handles
  publish/archive actions via a body discriminator), `POST
  /api/admin/variants`.
- Orders: list, detail page with itemized breakdown, payment/refund
  summary, status history, and `OrderActions` (status transition
  buttons generated from the real `VALID_TRANSITIONS` map, cancel with
  a reason prompt). New API route:
  `POST /api/admin/orders/[id]` (transition/cancel via body
  discriminator, same pattern as the products action route).
- Nav links to Categories/Inventory/Returns/Reviews/Coupons/Content/
  Settings pages that **do not exist yet** — see below.

Not done yet:
- Admin pages for Categories, Inventory (bulk CSV import UI
  especially), Returns (the whole inspection-checkpoint workflow has
  no UI), Reviews (moderation queue), Coupons (create/list UI —
  `domain/coupons/admin.ts` has no page calling it yet), Content
  (homepage builder, banners, navigation, static pages — all of Phase
  6's CMS work has no admin UI), Settings (site settings form). The
  nav links to all of these; clicking them 404s. This is the largest
  remaining gap — roughly half of the admin surface implied by the nav
  doesn't exist.
- Customer-facing account pages (order history, addresses, wishlist
  page) — services exist since Phase 3/5, no UI.
- Review submission UI, return request UI (customer-facing) — same
  gap as above.
- Product image upload UI — `MediaAsset`/Cloudinary signed-upload
  service exists (Phase 2), no admin UI wired to it; the product form
  built this phase has no image field yet.
- No loading/error boundaries added for the new admin routes
  specifically (the storefront's `loading.tsx` pattern from Phase 7
  wasn't extended to `/admin/*`).
- `ProductForm`'s slug auto-generation and category/attribute inputs
  are functional but minimal — no drag-to-reorder, no rich text editor
  for descriptions (plain textarea, sanitized server-side same as
  before).

`docs/LAUNCH_CHECKLIST.md` updated to add "Admin UI is roughly half
built" as its own line rather than the previous blanket "admin UI does
not exist," now that some of it does.

## Phase 10 status (remaining admin pages)

Checked file listing first — no drift. This phase filled in the admin
sidebar links that 404'd at the end of Phase 9.

Built: Categories (list, create, delete-if-unreferenced), Inventory
(stock table with inline single adjustment, CSV bulk import UI wired
to the two-phase validate-then-commit design from Phase 2), Returns
(list + detail page walking the full REQUESTED → APPROVED →
ITEM_RECEIVED → INSPECTED → REFUND_ISSUED → COMPLETED lifecycle, with
the inspection checkpoint and serial-number mismatch UI front and
center — this was the highest-value page to get right, given it's the
concrete implementation of the anti-swap-fraud rule), Reviews
(moderation queue: approve/reject/flag), Coupons (list with
status-toggle, create form), Settings (all 8 `SiteSetting` keys,
save-per-field).

**A real bug was caught and fixed while building the returns page**:
`ReturnActions` initially showed the "Issue Refund" button for any
`INSPECTED` status regardless of whether inspection actually passed —
since a failed inspection also leaves status at `INSPECTED`
(`inspectionPassed: false`), the button would have rendered for a
return that should have no path to refund. The backend service
(`issueReturnRefund`) already rejects this correctly, so nothing
would have actually been refunded — but the UI would have offered a
button that always errors, which is a real UX bug even though the
money was never at risk. Fixed by passing `inspectionPassed` into
`ReturnActions` and gating the refund UI on it, with an explicit
"inspection failed, no further automated action" state instead.

**Content page deliberately incomplete, and says so in the UI, not
just in this doc**: Static content pages (About/FAQ/Shipping Info)
are fully built — they don't touch media. Banners, the homepage
section builder, and navigation menus all require
`domain/content/media.ts`'s `registerMediaAsset()`, which calls the
real Cloudinary API to verify an uploaded asset's format/size. That
means those three admin surfaces cannot be meaningfully built or
tested without live Cloudinary credentials — building the forms
without that would produce pages that always fail. Rather than ship
non-functional forms, `/admin/content` says explicitly what's missing
and why, right in the page. Build these once Cloudinary credentials
exist and a media-picker UI is worth building alongside them.

Every admin page built across Phases 9-10 uses the same pattern:
server component fetches data directly via `db`/domain functions
(admin pages run server-side, so no API round-trip needed for reads),
client sub-components handle interactivity and POST to
`/api/admin/*` routes, each of which calls the exact same domain
service function the corresponding CLI/service test would — no logic
duplicated between "what the API route does" and "what the service
does," the routes are thin wrappers.

## Phase 11 status (customer account UI)

Checked file listing first — no drift. Built order history, order
detail (with return request), addresses, and wishlist pages for
logged-in customers.

**Two real bugs caught and fixed while building this**:
1. `domain/customers/wishlist.ts` called `crypto.randomUUID()` with no
   `import crypto from "crypto"` at the top of the file — this would
   have thrown a runtime `ReferenceError` the first time
   `enableWishlistSharing()` actually ran, since Node's server runtime
   (unlike some edge/browser contexts) doesn't expose `crypto` as a
   global by default. Existed since Phase 3/5, invisible until
   something actually called that function — which nothing did until
   this phase built the code path that reaches it. Fixed.
2. Building `(account)/layout.tsx`'s auth redirect exposed that no
   customer-facing login page existed at all — only `/admin/login`.
   The redirect would have sent an unauthenticated customer to a
   route that 404s. Built `(storefront)/login/page.tsx` (login +
   register, Better Auth email/password) to close it. While building
   it, initially wrapped its content in a second `<main
   id="main-content">` — since `(storefront)/layout.tsx` already
   provides that landmark for every page in the group, this would
   have produced a duplicate `id` (invalid HTML, breaks skip-link
   targeting for screen readers). Caught and removed before packaging.

**New service**: `src/domain/customers/addresses.ts` — didn't exist
before. `checkout.ts` creates an `Address` row inline during order
placement, but nothing let a customer view/add/edit/delete/set-default
outside checkout. Ownership-checked throughout (a customer can only
touch their own addresses — verified by looking up their own
`CustomerProfile`, never by trusting a client-supplied customerId).
`deleteAddress` blocks deletion if the address is referenced by a past
order (`Order.shippingAddressId`).

**Also added**: `getSharedWishlist()` to `wishlist.ts` — the public
share-link read function referenced by the original spec
("public/private link") but never actually written; only the
token-generation half (`enableWishlistSharing`) existed. No page
renders it yet (no `/wishlist/shared/[token]` route) — the function
exists, the public page doesn't, noting both honestly rather than
claiming the feature is complete.

**A design gap surfaced, not fixed**: `Order.shippingAddressId` is a
live foreign key to `Address`, not an immutable snapshot the way
`OrderItem` snapshots product data. Editing an address via the new
`updateAddress()` will retroactively change what a past order displays
as its shipping address — this contradicts the immutable-snapshot
principle applied everywhere else (OrderItem, coupon code capture,
etc.). Flagged with a comment in `addresses.ts` and here rather than
silently fixed (fixing it properly means adding snapshot fields to
`Order` and updating `checkout.ts`'s creation flow — a schema
migration, out of scope for "build account pages"). Added to
`docs/LAUNCH_CHECKLIST.md`.

Not done yet:
- Public wishlist share page (`getSharedWishlist()` exists, no route).
- Order shipping-address snapshot fix (see gap above).
- Password reset / forgot-password flow for customer login (Better
  Auth supports it; no UI built for it here, same gap as noted for
  admin in earlier phases).
- `(storefront)/login/page.tsx` and `admin/login/page.tsx` both call
  `useSearchParams()` without a `<Suspense>` boundary — Next.js
  App Router de-opts a page to fully client-rendered when this
  pattern is used bare, rather than erroring. Not fixed this pass;
  worth wrapping in `<Suspense>` if/when static-rendering these routes
  matters.

## Phase 12 status (Cloudinary-dependent admin UI + remaining gaps)

Checked file listing first — no drift. This phase built the pieces
previously deferred as "blocked on live Cloudinary credentials" —
reconsidered that reasoning: the rest of this codebase (payment,
courier, SMS) was always built as real, correct code that's
untestable in this sandbox without live external credentials, and
documented as such rather than skipped. Media upload deserved the
same treatment instead of being singled out as an exception.

Built:
- `src/app/api/admin/media/sign/route.ts` — exposes
  `createSignedUploadParams()` (existed since Phase 2, never had a
  route). `src/app/api/admin/media/route.ts` — registers an upload via
  `registerMediaAsset()`.
- `src/components/admin/image-uploader.tsx` — the real signed
  direct-to-Cloudinary upload flow: get signature from our server →
  upload straight to Cloudinary from the browser → require alt text →
  register with our server, which re-verifies format/size against
  Cloudinary's API rather than trusting the browser. Cannot be
  exercised end-to-end without live `CLOUDINARY_*` credentials — same
  class of external dependency as the payment/courier adapters, not a
  reason to leave it unbuilt.
- `src/domain/products/service.ts` — added `addProductImage()`,
  `removeProductImage()`, `reorderProductImages()`. **These didn't
  exist at all** — the product form built in Phase 9 had no image
  field because there was nothing to call. Wired into a new
  `ProductImageManager` on the product edit page.
- `src/domain/content/banners.ts` admin UI — `BannerManager` using the
  same uploader, wired into `/admin/content`.
- Public wishlist share page (`(storefront)/wishlist/shared/[token]`)
  and a `ShareWishlistButton` on the account wishlist page — the
  `getSharedWishlist()` function from Phase 11 had no route calling
  it until now.
- Password reset flow: `forgetPassword`/`resetPassword` were missing
  from the Better Auth client export list; `sendResetPassword` was
  missing from the server config entirely, meaning
  `forgetPassword()` would have succeeded silently without ever
  emailing anything. Added `sendPasswordResetEmail()` to
  `domain/notifications/email.ts`, wired it into
  `lib/auth/config.ts`, and built `/forgot-password` +
  `/reset-password` pages plus a link from the login page.

**A repeat of the same bug class was caught twice more this
phase**: the public wishlist share page was initially written with
its own `<main id="main-content">`, duplicating the landmark
`(storefront)/layout.tsx` already provides — the exact mistake caught
and fixed on the login page in Phase 11. Caught and fixed again before
packaging. Worth stating plainly: this is now a known failure mode for
any new page added under `(storefront)/` or `(account)/` — those
route groups' layouts already own the `<main>` landmark, a new
page's root element should never be a `<main>` tag itself.

Still not built: homepage section builder, navigation menu editor
(both deferred again — six distinct section-content schemas for the
former, and the nav depth-capping logic for the latter, both warrant
a dedicated pass rather than being rushed alongside everything else in
this one). Order shipping-address snapshot gap (Phase 11) is
unchanged.

**A more severe bug was caught while writing this section, and fixed
immediately rather than just documented**: `requireEmailVerification:
true` was set in the Better Auth config with no `sendVerificationEmail`
callback at all — meaning it would have blocked every single customer
registration, permanently, since the verification email required to
clear that block would never have been sent. This is worse than the
password-reset gap found alongside it (which degraded one feature);
this one would have made the storefront's registration flow entirely
non-functional. Fixed by adding `emailVerification.sendVerificationEmail`
to `lib/auth/config.ts` and a matching `sendVerificationEmail()` in
`domain/notifications/email.ts`.

## Deployment notes (added when the user asked how to push to
GitHub/Vercel)

`.gitignore` did not exist until this point — every phase so far
built application code, and this was never needed until the moment of
actually pushing to a real repo. Without it, the first `git add .`
would have committed `.env` (real secrets), `node_modules`, and
`.next` build output straight into version control. Added before any
push happened, not after.

## Rules for whoever builds this
- Do not introduce dependencies unless they provide clear value.
- Do not modify unrelated files during implementation.
- Preserve existing functionality when making future changes.
- Verify current official documentation whenever framework/API
  behavior matters (Next.js App Router, Prisma, Better Auth are all
  fast-moving).
- Keep this file updated as decisions are made.
