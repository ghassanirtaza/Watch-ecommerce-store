import crypto from "crypto";
import { db } from "@/lib/db/client";
import { redis } from "@/lib/rate-limit/redis";
import { getSetting } from "@/domain/settings/service";

/**
 * COD phone verification per AI_CONTEXT.md — hard requirement before a
 * COD order can be confirmed, not optional. OTP state lives in Redis
 * (short-lived, not something that belongs in Postgres) keyed by phone
 * number, separate from any cart/order identifier so a customer can
 * retry checkout without needing a fresh OTP if they already verified
 * this phone recently.
 */

const OTP_TTL_SECONDS = 5 * 60;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

function otpKey(phone: string) {
  return `otp:cod:${phone}`;
}
function otpAttemptsKey(phone: string) {
  return `otp:cod:attempts:${phone}`;
}
function otpCooldownKey(phone: string) {
  return `otp:cod:cooldown:${phone}`;
}

export async function sendCodOtp(phone: string) {
  const onCooldown = await redis.get(otpCooldownKey(phone));
  if (onCooldown) {
    throw new Error("Please wait before requesting another code");
  }

  const code = crypto.randomInt(100000, 999999).toString();

  await redis.set(otpKey(phone), code, { ex: OTP_TTL_SECONDS });
  await redis.set(otpAttemptsKey(phone), 0, { ex: OTP_TTL_SECONDS });
  await redis.set(otpCooldownKey(phone), "1", { ex: OTP_RESEND_COOLDOWN_SECONDS });

  // Actual SMS/WhatsApp dispatch is not wired yet — see AI_CONTEXT.md
  // open decision on WhatsApp Business API approval. This function
  // returns the code only in non-production so checkout can be tested
  // end-to-end before that integration exists; production must never
  // do this.
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DEV ONLY] COD OTP for ${phone}: ${code}`);
    return { devCode: code };
  }

  // TODO(Phase 4 remaining): dispatch via WhatsApp/SMS provider once
  // selected. Throwing here in production until that's wired, rather
  // than silently pretending an OTP was sent.
  throw new Error("SMS/WhatsApp OTP dispatch is not yet configured");
}

export async function verifyCodOtp(phone: string, code: string): Promise<boolean> {
  const attempts = Number((await redis.get(otpAttemptsKey(phone))) ?? 0);
  if (attempts >= OTP_MAX_ATTEMPTS) {
    throw new Error("Too many attempts — request a new code");
  }

  const storedCode = await redis.get(otpKey(phone));
  if (!storedCode) {
    throw new Error("Code expired — request a new one");
  }

  if (storedCode !== code) {
    await redis.incr(otpAttemptsKey(phone));
    return false;
  }

  await redis.del(otpKey(phone));
  await redis.del(otpAttemptsKey(phone));
  // Mark this phone verified for a short window so the checkout flow
  // can proceed without re-verifying on every retry within the same
  // session.
  await redis.set(`otp:cod:verified:${phone}`, "1", { ex: 30 * 60 });
  return true;
}

export async function isPhoneVerifiedForCod(phone: string): Promise<boolean> {
  const verified = await redis.get(`otp:cod:verified:${phone}`);
  return verified === "1";
}

/**
 * COD risk gate — checked at checkout initiation, before the order is
 * even created. Blocks or requires manual review based on
 * CustomerCodRiskFlag. A customer with no history gets no gate (new
 * customers aren't penalized); the flag only accumulates from real
 * failed-delivery history recorded by admin/courier webhook handling
 * (Phase 4 remaining — courier webhook wiring not yet built).
 */
export async function checkCodEligibility(customerId: string | null, orderValue: number) {
  const codValueCap = await getSetting("cod_order_value_cap_pkr");

  if (orderValue > codValueCap) {
    return {
      eligible: false,
      reason: `COD is not available for orders above Rs. ${codValueCap.toLocaleString("en-PK")}. Please use card payment.`,
    };
  }

  if (!customerId) {
    return { eligible: true }; // guest checkout — no history to check yet
  }

  const riskFlag = await db.customerCodRiskFlag.findUnique({ where: { customerId } });
  if (riskFlag?.isBlocked) {
    return {
      eligible: false,
      reason: "COD is not available for this account. Please use card payment or contact support.",
    };
  }

  return { eligible: true };
}
