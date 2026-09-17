import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendCodOtp, verifyCodOtp } from "@/domain/customers/cod-verification";
import { checkRateLimit, otpRequestLimiter, otpVerifyLimiter } from "@/lib/rate-limit/limiters";

const phoneSchema = z.object({ phone: z.string().regex(/^(\+92|0)3\d{9}$/) });

export async function POST(request: NextRequest) {
  const { success } = await checkRateLimit(otpRequestLimiter, request.headers.get("x-forwarded-for") ?? "unknown");
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = phoneSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });

  try {
    const result = await sendCodOtp(parsed.data.phone);
    return NextResponse.json({ sent: true, ...(process.env.NODE_ENV !== "production" ? result : {}) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not send code" }, { status: 400 });
  }
}
