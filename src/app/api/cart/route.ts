import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { computeCartTotals } from "@/domain/cart/service";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const cartId = request.nextUrl.searchParams.get("cartId") ?? cookieStore.get("guest_cart_id")?.value;

  if (!cartId) {
    return NextResponse.json({ cartId: null, lineItems: [], subtotal: 0, shippingTotal: 0, estimatedTotal: 0 });
  }

  try {
    const totals = await computeCartTotals(cartId);
    return NextResponse.json(totals);
  } catch {
    return NextResponse.json({ cartId: null, lineItems: [], subtotal: 0, shippingTotal: 0, estimatedTotal: 0 });
  }
}
