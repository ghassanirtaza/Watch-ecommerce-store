import { NextRequest, NextResponse } from "next/server";
import { initiateCheckout, CheckoutError } from "@/domain/orders/checkout";
import { checkRateLimit, checkoutSubmitLimiter } from "@/lib/rate-limit/limiters";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(checkoutSubmitLimiter, ip);
  if (!success) {
    return NextResponse.json({ error: "Too many checkout attempts. Please wait a moment." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const result = await initiateCheckout(body);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
