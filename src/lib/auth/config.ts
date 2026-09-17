import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db/client";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/domain/notifications/email";

/**
 * Better Auth handles authentication (who is this person) only.
 * Authorization (what can they do) lives entirely in
 * src/lib/permissions — never conflate the two. A valid session proves
 * identity; it proves nothing about permissions on its own.
 *
 * isAdminUser on the User model is a coarse gate used by admin route
 * middleware to keep the admin surface logically separate from the
 * storefront, even though both share this same auth system. It is not
 * a substitute for the granular RBAC permission checks in
 * src/lib/permissions/permissions.ts — every admin route must still
 * run roleHasPermission() server-side.
 */
export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
  },

  // requireEmailVerification above blocks sign-in until verified, but
  // that's only meaningful if a verification email actually goes out.
  // This block was entirely absent until caught while writing
  // AI_CONTEXT.md for this phase — without it, requireEmailVerification
  // would have blocked every single registration with no way to ever
  // clear the block, since no verification email would ever be sent.
  // This is more severe than the password-reset gap it was found next
  // to: that one degraded a feature, this one would have blocked all
  // new customer signups outright.
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
    sendOnSignUp: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh session token daily
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min — reduces DB hits for session reads
    },
  },

  // Rate limiting on login/OTP/password-reset endpoints. Better Auth
  // has built-in rate limiting; production should also front this with
  // Upstash-based rate limiting at the route-handler level for
  // consistency with coupon/checkout rate limits — see
  // src/lib/rate-limit (Phase 1 remaining work).
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },

  advanced: {
    // Admin panel and storefront share cookies today (modular monolith,
    // same origin). If the admin surface is later split to a
    // subdomain, this needs cookie-domain configuration — flagged in
    // docs/AI_CONTEXT.md as a security consideration, not yet decided.
    useSecureCookies: process.env.NODE_ENV === "production",
  },
});

export type Auth = typeof auth;
