import type { NextConfig } from "next";

/**
 * Security headers per AI_CONTEXT.md — this file was missing entirely
 * until Phase 7; every response was going out with Next.js defaults
 * only. Flagged and closed here rather than left as a silent gap.
 *
 * CSP is intentionally conservative and WILL need adjusting once real
 * third-party scripts are added (Cloudinary asset domain, PostHog,
 * Sentry, a payment gateway's hosted checkout script). Test any new
 * script/embed against this policy before assuming it "just works" —
 * a silently-blocked script is a common CSP failure mode.
 */
const cspDirectives = [
  "default-src 'self'",
  // 'unsafe-inline' for styles is a pragmatic Tailwind/Next.js
  // reality; scripts do NOT get 'unsafe-inline' — GSAP and app code
  // are bundled, not inline, so this stays tight.
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "img-src 'self' data: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self' https://res.cloudinary.com",
  "frame-ancestors 'none'", // redundant with X-Frame-Options below, kept for defense in depth
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspDirectives },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS: only meaningful over HTTPS (Vercel terminates TLS in front
  // of this) — safe to set unconditionally since it's a no-op on
  // plain HTTP.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Defense in depth alongside robots.ts: admin surface gets an
        // explicit noindex header too, not just a meta tag that could
        // be missed on some route.
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
