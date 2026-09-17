import { Redis } from "@upstash/redis";

/**
 * Redis is used for rate limiting and short-lived state (OTP codes,
 * cooldowns) ONLY — never as a system of record. Inventory reservation
 * correctness must not depend on Redis surviving; that's DB-backed
 * (see domain/inventory/reservation.ts).
 */
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL as string,
  token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
});
