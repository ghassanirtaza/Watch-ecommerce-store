import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";

/**
 * Cart totals shown here are always indicative — the server recomputes
 * authoritative totals again at checkout confirmation (price, stock,
 * coupon, shipping, tax). Never persist a "total" field on Cart itself;
 * always derive it fresh from current variant prices.
 */

const addToCartSchema = z.object({
  variantId: z.string().cuid(),
  quantity: z.number().int().min(1).max(99),
});

/**
 * Resolves the current cart for a request: authenticated customer's
 * cart, or a guest cart identified by an opaque token stored in a
 * cookie. Callers are responsible for setting/reading the guestToken
 * cookie — this function just resolves/creates the underlying row.
 */
export async function resolveCart(guestToken: string | null): Promise<{ cartId: string; guestToken: string | null }> {
  const session = await getOptionalSession();

  if (session?.user) {
    const customerProfile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
    if (!customerProfile) throw new Error("Customer profile not found for authenticated user");

    let cart = await db.cart.findFirst({ where: { customerId: customerProfile.id } });
    if (!cart) {
      cart = await db.cart.create({ data: { customerId: customerProfile.id } });
    }
    return { cartId: cart.id, guestToken: null };
  }

  if (guestToken) {
    const existing = await db.cart.findUnique({ where: { guestToken } });
    if (existing) return { cartId: existing.id, guestToken };
  }

  const newToken = crypto.randomUUID();
  const cart = await db.cart.create({ data: { guestToken: newToken } });
  return { cartId: cart.id, guestToken: newToken };
}

async function getOptionalSession() {
  try {
    return await requireSession();
  } catch {
    return null;
  }
}

export async function addToCart(cartId: string, input: z.infer<typeof addToCartSchema>) {
  const data = addToCartSchema.parse(input);

  const variant = await db.productVariant.findUnique({
    where: { id: data.variantId },
    include: { product: true, inventory: true },
  });
  if (!variant || !variant.isActive || variant.product.status !== "ACTIVE") {
    throw new Error("This item is not currently available");
  }

  // Adding to cart does NOT reserve stock — reservation only happens at
  // checkout initiation (see domain/inventory/reservation.ts). This is
  // just an informational cap so the cart doesn't quietly grow past
  // what's realistically purchasable.
  const totalAvailable = variant.inventory.reduce((sum, inv) => sum + inv.availableQuantity, 0);

  const existingItem = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId: data.variantId } },
  });
  const requestedTotal = (existingItem?.quantity ?? 0) + data.quantity;

  if (requestedTotal > totalAvailable) {
    throw new Error(
      `Only ${totalAvailable} unit(s) available in stock` +
        (existingItem ? ` (you already have ${existingItem.quantity} in cart)` : "")
    );
  }

  const item = await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId: data.variantId } },
    update: { quantity: requestedTotal },
    create: { cartId, variantId: data.variantId, quantity: data.quantity },
  });

  return item;
}

export async function updateCartItemQuantity(cartId: string, variantId: string, quantity: number) {
  if (quantity < 1 || quantity > 99) throw new Error("Quantity must be between 1 and 99");

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { inventory: true },
  });
  if (!variant) throw new Error("Variant not found");

  const totalAvailable = variant.inventory.reduce((sum, inv) => sum + inv.availableQuantity, 0);
  if (quantity > totalAvailable) {
    throw new Error(`Only ${totalAvailable} unit(s) available in stock`);
  }

  return db.cartItem.update({
    where: { cartId_variantId: { cartId, variantId } },
    data: { quantity },
  });
}

export async function removeCartItem(cartId: string, variantId: string) {
  return db.cartItem.delete({ where: { cartId_variantId: { cartId, variantId } } });
}

/**
 * Returns cart contents with SERVER-COMPUTED current pricing and stock
 * status per line — never trust a stored total. If an item's variant
 * has gone inactive or out of stock since it was added, that's
 * surfaced here so the UI can show "adjusted due to availability"
 * rather than silently letting checkout fail later.
 */
export async function getCartSummary(cartId: string) {
  const items = await db.cartItem.findMany({
    where: { cartId },
    include: {
      variant: {
        include: { product: true, inventory: true },
      },
    },
  });

  const lines = items.map((item) => {
    const totalAvailable = item.variant.inventory.reduce((sum, inv) => sum + inv.availableQuantity, 0);
    const isAvailable = item.variant.isActive && item.variant.product.status === "ACTIVE" && totalAvailable > 0;
    const cappedQuantity = Math.min(item.quantity, totalAvailable);

    return {
      cartItemId: item.id,
      variantId: item.variantId,
      productName: item.variant.product.name,
      variantName: item.variant.variantName,
      unitPrice: item.variant.price,
      quantity: item.quantity,
      effectiveQuantity: cappedQuantity, // what will actually be purchasable
      isAvailable,
      wasAdjusted: cappedQuantity !== item.quantity,
      lineTotal: Number(item.variant.price) * cappedQuantity,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  return { lines, subtotal, isEstimate: true };
}

/**
 * Thin wrapper around getCartSummary() that shapes the response the way
 * the cart page, checkout page, and GET /api/cart all expect
 * (cartId + lineItems + subtotal + shippingTotal + estimatedTotal).
 * Shipping estimation isn't wired in yet (see docs/LAUNCH_CHECKLIST.md)
 * — reported as 0 rather than omitted, so callers get a stable shape.
 */
export async function computeCartTotals(cartId: string) {
  const summary = await getCartSummary(cartId);
  const shippingTotal = 0;
  return {
    cartId,
    lineItems: summary.lines,
    subtotal: summary.subtotal,
    shippingTotal,
    estimatedTotal: summary.subtotal + shippingTotal,
  };
}

/**
 * Deterministic merge on login: guest cart items are folded into the
 * customer's existing cart (summing quantities, capped by stock),
 * never overwriting the customer's cart wholesale. Guest cart is
 * deleted after merge.
 */
export async function mergeGuestCartOnLogin(guestToken: string, customerId: string) {
  const guestCart = await db.cart.findUnique({ where: { guestToken }, include: { items: true } });
  if (!guestCart || guestCart.items.length === 0) return;

  let customerCart = await db.cart.findFirst({ where: { customerId } });
  if (!customerCart) {
    customerCart = await db.cart.create({ data: { customerId } });
  }

  for (const guestItem of guestCart.items) {
    try {
      await addToCart(customerCart.id, { variantId: guestItem.variantId, quantity: guestItem.quantity });
    } catch {
      // Stock-limited item during merge — skip rather than fail the
      // whole login flow. The cart summary will simply show whatever
      // fit; user sees it immediately on the cart page.
    }
  }

  await db.cart.delete({ where: { id: guestCart.id } });
}
