import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

/**
 * Per AI_CONTEXT.md / security review: rate limiting is explicitly
 * required on login, OTP requests, coupon application, checkout
 * submission, and search/autocomplete (the last one was flagged as
 * missing in review — a public, unauthenticated, DB-hitting endpoint
 * is a natural scraping/DoS target).
 */

export const otpRequestLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "10 m"),
  prefix: "ratelimit:otp-request",
});

export const otpVerifyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "10 m"),
  prefix: "ratelimit:otp-verify",
});

export const couponApplyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "5 m"),
  prefix: "ratelimit:coupon-apply",
});

export const checkoutSubmitLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  prefix: "ratelimit:checkout-submit",
});

export const searchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:search",
});

/**
 * Cart mutation (add/update item) — flagged in Phase 7 review: this
 * endpoint was live since Phase 3 with no rate limit at all, unlike
 * checkout/OTP/coupon/search which all had one from the start. A
 * public, unauthenticated, cheap-to-call, DB-writing endpoint is worth
 * protecting even though a single add-to-cart isn't as sensitive as
 * an OTP or checkout attempt.
 */
export const cartMutationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:cart-mutation",
});

/**
 * Call at the top of any route handler this applies to:
 *   const { success } = await checkRateLimit(checkoutSubmitLimiter, ip);
 *   if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
 */
export async function checkRateLimit(limiter: Ratelimit, identifier: string) {
  return limiter.limit(identifier);
}
