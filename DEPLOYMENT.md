# Deploying to Vercel

This app is a standard Next.js App Router project, so Vercel is the
natural host for it. This guide is the gap between "it's a Next.js
app" and "it's actually live" — the four things below are the parts
that don't work out of the box and would otherwise fail silently or
fail the build.

## 0. What was fixed to make this Vercel-ready

If you're diffing this against an earlier copy of the repo, this is
what changed and why:

- **`package.json`** — added `"postinstall": "prisma generate"`.
  Vercel caches `node_modules` between deploys, so without this the
  Prisma Client can go stale (or never get generated at all) and every
  page that touches the database throws `@prisma/client did not
  initialize yet`. Also bumped the `next` version floor to `^15.5.0`
  and added an `engines.node` field.
- **`src/middleware.ts`** — added `runtime: "nodejs"` to the exported
  config. Middleware defaults to the Edge runtime, which can't open a
  standard Postgres connection. This middleware calls
  `auth.api.getSession()`, which queries the database through Prisma
  on any cache miss — on Edge that fails (or behaves inconsistently,
  since a 5-minute session cookie cache was masking it). Node
  middleware has been stable since Next.js 15.5, no experimental flag
  needed.
- **`vercel.json`** — changed the cron schedule from every 5 minutes
  to once daily (`0 3 * * *`). Vercel's **Hobby plan rejects the
  deploy outright** if a cron expression resolves to more than once a
  day. The sweep route is a hygiene pass, not the correctness
  mechanism (reservations expire lazily on read), so daily is fine on
  Hobby. On Pro, change the schedule back to something like
  `*/5 * * * *` if you want tighter cleanup.

## 1. Provision Postgres

Use Vercel Postgres (via the Marketplace, powered by Neon), Neon
directly, or Supabase — any managed Postgres works. Whichever you
pick, you need **two** connection strings:

- `DATABASE_URL` — the **pooled** connection string (PgBouncer /
  the provider's pooler). The app uses this at runtime.
- `DIRECT_DATABASE_URL` — the **direct**, unpooled connection string.
  Prisma needs this only for running migrations.

This project's `prisma/schema.prisma` already expects both (see the
`directUrl` field), and `src/lib/db/client.ts` already uses a
singleton Prisma Client, so no code changes are needed here — just
set both env vars correctly.

## 2. Create the first migration (do this before your first deploy)

No migrations are committed to this repo yet — `prisma/migrations/`
doesn't exist. Run this locally, once, against your new database:

```bash
cp .env.example .env
# fill in DATABASE_URL and DIRECT_DATABASE_URL from step 1
npm install
npx prisma migrate dev --name init
npm run prisma:seed   # creates the 6 RBAC roles + a Super Admin user
```

Commit the `prisma/migrations/` folder this creates. Skipping this
step doesn't fail the build — it fails silently at runtime instead,
with every database query erroring because the tables don't exist.

## 3. Set environment variables in Vercel

Push the repo to GitHub and import it into Vercel, then add every
variable from `.env.example` under Project Settings → Environment
Variables. At minimum, for the site to boot and the admin panel to be
usable:

- `DATABASE_URL`, `DIRECT_DATABASE_URL`
- `AUTH_SECRET` (generate one: `openssl rand -base64 32`), `AUTH_URL`
  (your production URL)
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_DEFAULT_CURRENCY`,
  `NEXT_PUBLIC_DEFAULT_COUNTRY`
- `CRON_SECRET` (any random string — protects `/api/cron/sweep`)
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` /
  `CLOUDINARY_API_SECRET` (needed for any image upload — product
  images, banners)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (rate
  limiting)
- `RESEND_API_KEY` (order/shipping emails, password reset, email
  verification)

Leave `PAYMENT_*`, `WHATSAPP_*` blank for now if you don't have those
accounts yet — card checkout and COD OTP will throw rather than
silently misbehave, so this is safe to defer, just not something to
launch to real customers on.

## 4. Apply migrations on every future deploy (optional but recommended)

Step 2 gets your first migration onto the database, but you'll create
more migrations as the schema evolves. Rather than running
`prisma migrate deploy` by hand each time, override Vercel's **Build
Command** (Project Settings → Build & Development Settings) to:

```
prisma generate && prisma migrate deploy && next build
```

This is safe to leave in permanently — `migrate deploy` only applies
migrations it hasn't applied before, so it's a no-op on deploys with
no schema changes.

## 5. Deploy

Push to your connected branch, or run `vercel --prod`. On the first
successful deploy, log in at `/admin/login` with the Super Admin
credentials the seed script created.

## After the site is live

`docs/LAUNCH_CHECKLIST.md` is the accurate, current list of what's
still open before this is ready for real customers (payment gateway,
courier integration, a verified Resend sending domain, real
SMS/WhatsApp OTP, connection-pooling confirmation, backups). None of
it blocks the site being live and clickable on Vercel — all of it
blocks taking real orders.
