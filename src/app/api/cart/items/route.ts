import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { addToCart } from "@/domain/cart/service";
import { checkRateLimit, cartMutationLimiter } from "@/lib/rate-limit/limiters";

const bodySchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().positive().max(99).default(1),
});

const CART_COOKIE = "guest_cart_id";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(cartMutationLimiter, ip);
  if (!success) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existingCartId = cookieStore.get(CART_COOKIE)?.value;

  try {
    const result = await addToCart({
      cartId: existingCartId,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
    });

    const response = NextResponse.json({ cartId: result.cartId, item: result.item });

    if (!existingCartId) {
      response.cookies.set(CART_COOKIE, result.cartId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not add to cart" },
      { status: 400 }
    );
  }
}
