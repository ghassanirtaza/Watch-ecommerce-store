import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyCodOtp } from "@/domain/customers/cod-verification";
import { checkRateLimit, otpVerifyLimiter } from "@/lib/rate-limit/limiters";

const verifySchema = z.object({
  phone: z.string().regex(/^(\+92|0)3\d{9}$/),
  code: z.string().length(6),
});

export async function POST(request: NextRequest) {
  const { success } = await checkRateLimit(otpVerifyLimiter, request.headers.get("x-forwarded-for") ?? "unknown");
  if (!success) {
    return NextResponse.json({ error: "Too many attempts. Please wait before trying again." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const verified = await verifyCodOtp(parsed.data.phone, parsed.data.code);
    if (!verified) {
      return NextResponse.json({ error: "Incorrect code" }, { status: 400 });
    }
    return NextResponse.json({ verified: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Verification failed" }, { status: 400 });
  }
}
