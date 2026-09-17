import { NextRequest, NextResponse } from "next/server";
import { setCouponStatus } from "@/domain/coupons/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.status !== "ACTIVE" && body.status !== "DISABLED") {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  try {
    const coupon = await setCouponStatus(id, body.status);
    return NextResponse.json(coupon);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update coupon" }, { status: 400 });
  }
}
