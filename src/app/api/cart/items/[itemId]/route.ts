import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { updateCartItemQuantity, removeCartItem } from "@/domain/cart/service";
import { checkRateLimit, cartMutationLimiter } from "@/lib/rate-limit/limiters";

const bodySchema = z.object({ quantity: z.number().int().min(0).max(99) });

// Cart items are addressed by (cartId, variantId) in the data model —
// there's no standalone cartItemId lookup (see cartId_variantId
// compound key in domain/cart/service.ts) — so the cart must be
// resolved the same way the GET /api/cart route resolves it.
async function resolveCartId(request: NextRequest): Promise<string | null> {
  const cookieStore = await cookies();
  return request.nextUrl.searchParams.get("cartId") ?? cookieStore.get("guest_cart_id")?.value ?? null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId: variantId } = await params;
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(cartMutationLimiter, ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const cartId = await resolveCartId(request);
  if (!cartId) return NextResponse.json({ error: "No active cart" }, { status: 400 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });

  try {
    await updateCartItemQuantity(cartId, variantId, parsed.data.quantity);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update quantity" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId: variantId } = await params;
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(cartMutationLimiter, ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const cartId = await resolveCartId(request);
  if (!cartId) return NextResponse.json({ error: "No active cart" }, { status: 400 });

  try {
    await removeCartItem(cartId, variantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not remove item" }, { status: 400 });
  }
}
