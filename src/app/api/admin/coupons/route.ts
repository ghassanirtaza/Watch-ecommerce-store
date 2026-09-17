import { NextRequest, NextResponse } from "next/server";
import { createCoupon, setCouponStatus } from "@/domain/coupons/admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const coupon = await createCoupon(body);
    return NextResponse.json(coupon);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create coupon" }, { status: 400 });
  }
}
