# Launch Checklist

Consolidated from the "Not done yet" section of every phase in
`docs/AI_CONTEXT.md`. This is the actual pre-launch punch list — read
`AI_CONTEXT.md` for the architectural reasoning behind each item, this
file is just the checklist form of it.

## Blocking — cannot launch without these

- [ ] **Card payment gateway selected and integrated.** Currently
      `UnimplementedCardPaymentProvider` throws on every call. External
      merchant onboarding has its own lead time — start this
      independently of engineering work, it should already be
      underway by now (flagged as a Phase 0 open decision).
- [ ] **Courier(s) selected and integrated.** `Shipment.courierName` is
      a free string; no real `CourierProvider` adapter exists yet.
      Needed for both order fulfillment and the COD RTO/remittance
      loop to mean anything in production.
- [ ] **Real SMS/WhatsApp OTP dispatch wired.** `sendCodOtp()` throws
      in production right now — no COD order can currently be placed
      in a production build. This is not a nice-to-have; COD is the
      default payment method for this market.
- [ ] **Real Resend sending domain configured.** `orders@example.com`
      is a placeholder in `domain/notifications/email.ts` — every
      order confirmation/shipment email will fail to send until this
      is a verified domain.
- [ ] **Postgres connection pooling configured** (PgBouncer or Prisma
      Accelerate). Flagged since Phase 0 — without this, real traffic
      will exhaust the connection limit against a serverless
      deployment.
- [ ] **Database backups enabled and a restore actually tested once.**
      No backup/DR policy has been configured at all — this was
      flagged in the original architecture review and never revisited
      since.
- [ ] **CRON_SECRET set and `/api/cron/sweep` verified reachable** by
      Vercel Cron in the deployed environment (`vercel.json` is
      configured for every 5 minutes, but the env var and actual
      execution haven't been confirmed against a live deployment).

## Should fix before real traffic

- [ ] **Admin UI: Categories, Inventory, Returns, Reviews, Coupons,
      Settings, static Content Pages, Banners, and product/banner
      image upload are all built and working.** The only remaining
      admin gaps are the **homepage section builder and navigation
      menu editor** — both deliberately deferred again (six distinct
      section-content schemas for the former, nav depth-capping logic
      for the latter; each warrants its own pass rather than being
      rushed alongside everything else).
- [ ] **Checkout UI exists and is functional** (address, COD OTP flow,
      payment method, coupon, submit) but has not been exercised
      against a real payment gateway (none is wired) or a real SMS
      provider (COD OTP surfaces the code directly in the UI in
      non-production for testing — this is expected, not a bug, but
      confirm it's actually gated by `NODE_ENV=production` before
      launch).
- [ ] Customer account pages (order history, saved addresses,
      wishlist with public sharing) are built and working. Password
      reset flow is built and wired to actually send email.
- [ ] **Homepage section builder and navigation menu editor are the
      last two missing admin surfaces.** Everything else (products,
      categories, inventory, orders, returns, reviews, coupons,
      settings, static content pages, banners, product/banner image
      upload) is built.
- [ ] Product/banner image upload is built and code-complete but has
      never run against a live Cloudinary account in this environment
      — verify it end-to-end with real `CLOUDINARY_*` credentials
      before relying on it.
- [ ] **Order shipping-address is not snapshotted** —
      `Order.shippingAddressId` is a live FK; editing a saved address
      retroactively changes what past orders display, unlike
      `OrderItem` which correctly snapshots product data. Fix requires
      adding snapshot fields to `Order` and updating checkout's
      creation flow — a real schema change, not done yet.
- [ ] Rich text sanitization is a regex stopgap
      (`lib/validation/sanitize.ts`), explicitly flagged as unsafe for
      production since Phase 2. Replace with a real library
      (`isomorphic-dompurify` or equivalent) before any admin-authored
      content — product descriptions, CMS text blocks, static pages —
      goes live.
- [ ] Serial-level inventory tracking is an unmade business decision
      (`SerializedUnit` exists in schema, unused). Decide before
      launch if any product tier needs it — retrofitting after
      customers have already purchased unserialized units is much
      harder than deciding now.
- [ ] `couponApplyLimiter` is defined but has no caller — fine as long
      as coupon application only happens through checkout initiation
      (which is rate-limited), but if a live cart-page "apply coupon"
      endpoint gets built, wire this in at the same time, not after.
- [ ] Dashboard analytics queries are live/uncached
      (`domain/analytics/dashboard.ts`) — fine at low order volume,
      revisit if admin dashboard load times become noticeable.
- [ ] Exchange path for returns has a status (`EXCHANGE_ISSUED`) but no
      service function analogous to `issueReturnRefund()` — refund
      path is complete, exchange isn't.

## Verify before/at launch (not code changes, verification steps)

- [ ] **Auth email flows (verification, password reset) are wired in
      code but never run against a live Resend account.** Both were
      found to have missing callbacks during Phase 12 and fixed —
      `emailVerification.sendVerificationEmail` and
      `emailAndPassword.sendResetPassword` in `lib/auth/config.ts` are
      now both present. Before launch, actually register a test
      account and reset a test password end-to-end with real
      credentials — the fix has been reviewed, not executed.

- [ ] CSP in `next.config.ts` has never been tested against a real
      payment gateway's hosted-checkout script, Sentry, or PostHog —
      none of those are wired yet. Test each addition against the
      existing policy rather than assuming it works; a silently
      CSP-blocked script is a common failure mode.
- [ ] No automated accessibility audit has been run (axe, Lighthouse
      CI). Headers/landmarks/alt-text/focus-states were applied by
      hand per component — verify with real tooling before launch, not
      just by inspection.
- [ ] Core Web Vitals are unmeasured — there has never been a live
      deployment to run Lighthouse against. The performance-relevant
      architectural decisions (GSAP scoping, `next/image`, streaming
      loading states) are in place; whether they actually hit target
      numbers is unverified.
- [ ] Integration tests for the reservation/checkout concurrency logic
      are written but skipped (`src/tests/integration/`) — they need a
      real Postgres instance to run (testcontainers or a CI service
      container). This is the highest-value test suite in the
      project — the whole point of the reservation design is
      preventing overselling under concurrent checkout, and that
      property is currently unverified by an actual test run, only by
      code review.
- [ ] E2E tests (`src/tests/e2e/smoke.spec.ts`) are smoke-level only —
      confirm boot/404 behavior, not the actual checkout/payment flow.
      Extend once a seeded test database and payment sandbox exist.

## Business decisions still open (see AI_CONTEXT.md for full context)

- [ ] Which cities beyond the placeholder 10 in
      `lib/validation/checkout.ts` (`PAKISTAN_CITIES`) launch supports.
- [ ] COD order value cap and failed-delivery block threshold — now
      admin-configurable via `SiteSetting` (Phase 6), but the actual
      launch values still need to be decided and set, not left at
      code defaults (Rs. 100,000 / 3 failures) without a deliberate
      choice.
- [ ] Whether WhatsApp is live at launch or deferred — if live, the
      Meta Business API approval process needs to already be underway
      given its lead time.
