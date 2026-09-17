# Watch E-commerce Platform

Premium watch e-commerce platform — Pakistan-only launch.

**Read `docs/AI_CONTEXT.md` first.** It holds the architecture summary,
non-negotiable rules, open decisions, and known gaps. Keep it updated as
the project progresses.

**Deploying this to Vercel? Read [`DEPLOYMENT.md`](./DEPLOYMENT.md).**
It covers the steps this README doesn't — provisioning Postgres,
creating the first Prisma migration (none are committed yet), and the
Vercel-specific settings this project needs (cron frequency, Node
middleware runtime, env vars).

## Project status

Storefront, checkout, customer accounts, and the full admin panel are
built end-to-end (domain/service layer + UI), across 12 build phases —
see `docs/AI_CONTEXT.md` for the phase-by-phase history and
`docs/LAUNCH_CHECKLIST.md` for the current, itemized punch list. In
short, still open before this is genuinely launch-ready:

- No payment gateway, courier, or SMS/WhatsApp OTP provider is wired
  yet (all are external accounts with their own approval lead time) —
  card checkout and COD OTP will throw in a production build until
  one is connected.
- No Postgres migrations have been generated or committed yet (see
  `DEPLOYMENT.md` — this is the first thing to do).
- Resend is using a placeholder sending domain; no email will actually
  send until a real domain is verified.
- `@sentry/nextjs` and `posthog-js`/`posthog-node` are installed but
  not wired up anywhere — they're harmless as unused dependencies, not
  yet doing anything.

None of the above blocks getting the site running and clickable on
Vercel — see `DEPLOYMENT.md`.

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL / DIRECT_DATABASE_URL at minimum
npm install
npx prisma migrate dev --name init   # first time only — see DEPLOYMENT.md
npm run prisma:seed                  # bootstraps RBAC roles + a Super Admin
npm run dev
```
