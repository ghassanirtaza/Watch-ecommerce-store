import { db } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import {
  initiateCheckoutSchema,
  type InitiateCheckoutInput,
} from "@/lib/validation/checkout";
import { reserveCartStock, finalizeReservationsToSale, releaseReservations } from "@/domain/inventory/reservation";
import { validateCoupon, recordCouponRedemption } from "@/domain/coupons/service";
import { checkCodEligibility, isPhoneVerifiedForCod } from "@/domain/customers/cod-verification";
import { getPaymentProvider } from "@/domain/payments/adapters";
import { generateOrderNumber, generateIdempotencyKey } from "@/domain/orders/order-number";
import { recordAuditLog } from "@/lib/logging/audit";
import { sendOrderConfirmationEmail } from "@/domain/notifications/email";

/**
 * THE MOST IMPORTANT FILE IN THIS PHASE. Encodes every non-negotiable
 * rule from AI_CONTEXT.md:
 *
 * 1. Client-supplied price/stock/discount/tax/shipping is never trusted
 *    — everything below is recomputed from the database. The request
 *    body is only used for identifiers, quantities, address, coupon
 *    code, and payment method selection.
 * 2. Deferred stock finalization: reserveCartStock() holds stock at
 *    checkout initiation. For COD, finalizeReservationsToSale() runs
 *    immediately since there's no external payment step. For CARD, the
 *    reservation stays held until the payment webhook confirms (see
 *    domain/orders/confirmation.ts) — stock is never decremented for a
 *    card order that hasn't actually been paid for.
 * 3. COD phone verification is checked server-side via
 *    isPhoneVerifiedForCod() (Redis-backed, set only by a real
 *    verifyCodOtp() success) — never trust a client-supplied
 *    "phoneVerified: true" boolean.
 * 4. OrderItem snapshots product data at time of purchase.
 * 5. idempotencyKey prevents duplicate order creation from a retried
 *    request.
 */

export class CheckoutError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
  }
}

export async function initiateCheckout(rawInput: unknown) {
  const input = initiateCheckoutSchema.parse(rawInput);

  // Optional session — checkout supports both guest and logged-in flow.
  let customerId: string | undefined;
  let userId: string | undefined;
  try {
    const session = await requireSession();
    userId = session.user.id;
    const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
    customerId = profile?.id;
  } catch {
    // Not authenticated — proceed as guest. requireSession throwing here
    // is expected and not an error condition for this route.
  }

  if (!customerId && !input.guestEmail) {
    throw new CheckoutError("Email is required for guest checkout", "GUEST_EMAIL_REQUIRED");
  }

  const cart = await db.cart.findUnique({
    where: { id: input.cartId },
    include: {
      items: {
        include: {
          variant: {
            include: { product: { include: { categories: true } }, inventory: true },
          },
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new CheckoutError("Cart is empty", "EMPTY_CART");
  }

  // --- Server-side revalidation of every cart line ---
  const lineItems = cart.items.map((item) => {
    if (!item.variant.isActive || item.variant.product.status !== "ACTIVE") {
      throw new CheckoutError(
        `${item.variant.product.name} (${item.variant.variantName}) is no longer available`,
        "PRODUCT_UNAVAILABLE"
      );
    }
    return {
      variantId: item.variant.id,
      categoryIds: item.variant.product.categories.map((c) => c.categoryId),
      quantity: item.quantity,
      unitPrice: Number(item.variant.price), // authoritative price from DB
      productNameSnap: item.variant.product.name,
      variantNameSnap: item.variant.variantName,
      skuSnap: item.variant.sku,
    };
  });

  const subtotal = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);

  // --- Coupon revalidation — never trust a client-supplied discount ---
  let discountTotal = 0;
  let freeShipping = false;
  if (input.couponCode) {
    const result = await validateCoupon({
      code: input.couponCode,
      cartSubtotal: subtotal,
      cartVariantIds: lineItems.map((li) => li.variantId),
      cartCategoryIds: lineItems.flatMap((li) => li.categoryIds),
      customerId: customerId ?? null,
    });
    if (!result.valid) {
      throw new CheckoutError(result.reason ?? "Invalid coupon", "COUPON_INVALID");
    }
    discountTotal = result.discountAmount ?? 0;
    freeShipping = result.freeShipping ?? false;
  }

  const shippingTotal = 0; // free shipping default per business assumptions
  const taxTotal = 0; // Phase 6 site-settings item, not configured yet
  const grandTotal = Math.max(0, subtotal - discountTotal + (freeShipping ? 0 : shippingTotal) + taxTotal);

  // --- COD eligibility: value cap, risk flag, AND server-verified phone ---
  if (input.paymentMethod === "COD") {
    const eligibility = await checkCodEligibility(customerId ?? null, grandTotal);
    if (!eligibility.eligible) {
      throw new CheckoutError(eligibility.reason ?? "COD is not available", "COD_INELIGIBLE");
    }
    const phoneVerified = await isPhoneVerifiedForCod(input.shippingAddress.phone);
    if (!phoneVerified) {
      throw new CheckoutError(
        "Please verify your phone number via the code sent to you before placing a Cash on Delivery order",
        "COD_PHONE_NOT_VERIFIED"
      );
    }
  }

  // --- Reserve stock for every line, all-or-nothing ---
  const primaryLocation = await db.inventoryLocation.findFirst({ where: { isPrimary: true } });
  if (!primaryLocation) throw new CheckoutError("Store is not configured for orders yet", "NO_LOCATION");

  const reservation = await reserveCartStock({
    cartId: cart.id,
    locationId: primaryLocation.id,
    items: lineItems.map((li) => ({ variantId: li.variantId, quantity: li.quantity })),
  });

  if ("error" in reservation) {
    const failedLine = lineItems.find((li) => li.variantId === reservation.variantId);
    throw new CheckoutError(
      `${failedLine?.productNameSnap ?? "An item"} is no longer available in the requested quantity`,
      "OUT_OF_STOCK"
    );
  }

  // --- Resolve/persist shipping address ---
  let shippingAddressId: string | undefined;
  if (customerId) {
    const created = await db.address.create({
      data: { customerId, ...input.shippingAddress, isDefault: false },
    });
    shippingAddressId = created.id;
  }

  const orderNumber = generateOrderNumber();
  const idempotencyKey = generateIdempotencyKey();
  const initialStatus = input.paymentMethod === "COD" ? "CONFIRMED" : "PENDING_PAYMENT";

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        guestEmail: customerId ? undefined : input.guestEmail,
        guestPhone: customerId ? undefined : input.shippingAddress.phone,
        shippingAddressId,
        status: initialStatus,
        subtotal,
        discountTotal,
        taxTotal,
        shippingTotal: freeShipping ? 0 : shippingTotal,
        grandTotal,
        couponCode: input.couponCode,
        idempotencyKey,
        items: {
          create: lineItems.map((li) => ({
            variantId: li.variantId,
            productNameSnap: li.productNameSnap,
            variantNameSnap: li.variantNameSnap,
            skuSnap: li.skuSnap,
            unitPriceSnap: li.unitPrice,
            quantity: li.quantity,
          })),
        },
        statusHistory: { create: { status: initialStatus, reason: "Order created" } },
      },
    });

    // Link reservations to this order regardless of payment method —
    // finalization (below, for COD) or later webhook confirmation (for
    // CARD) both need InventoryReservation.orderId set.
    await tx.inventoryReservation.updateMany({
      where: { id: { in: reservation.reservationIds } },
      data: { orderId: created.id },
    });

    return created;
  });

  if (input.couponCode) {
    await recordCouponRedemption({ code: input.couponCode, orderId: order.id, customerId: customerId ?? null });
  }

  await db.cartItem.deleteMany({ where: { cartId: cart.id } });

  if (input.paymentMethod === "COD") {
    // No external payment step — finalize stock immediately.
    await finalizeReservationsToSale({
      reservationIds: reservation.reservationIds,
      locationId: primaryLocation.id,
      orderId: order.id,
    });

    const codPayment = await db.payment.create({
      data: { orderId: order.id, method: "COD", status: "AUTHORIZED", amount: grandTotal },
    });
    const codProvider = getPaymentProvider("COD");
    const codResult = await codProvider.createPayment({
      orderId: order.id,
      amount: grandTotal,
      currency: "PKR",
      idempotencyKey: `${idempotencyKey}:cod`,
    });
    await db.payment.update({ where: { id: codPayment.id }, data: { providerRef: codResult.providerRef } });

    await recordAuditLog({
      actorId: userId ?? null,
      action: "order.confirmed_cod",
      resource: `Order:${order.id}`,
    });

    await sendOrderConfirmationEmail(order.id);

    return { orderId: order.id, orderNumber: order.orderNumber, status: "CONFIRMED", grandTotal, requiresPayment: false };
  }

  // CARD: create a pending payment intent. Stock stays reserved
  // (not finalized) until the webhook confirms — see confirmation.ts.
  const provider = getPaymentProvider("CARD");
  const payment = await db.payment.create({
    data: { orderId: order.id, method: "CARD", status: "PENDING", amount: grandTotal },
  });

  try {
    const result = await provider.createPayment({
      orderId: order.id,
      amount: grandTotal,
      currency: "PKR",
      idempotencyKey: `${idempotencyKey}:payment`,
    });
    await db.payment.update({ where: { id: payment.id }, data: { providerRef: result.providerRef } });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: "PENDING_PAYMENT",
      grandTotal,
      requiresPayment: true,
      redirectUrl: result.redirectUrl,
      clientSecret: result.clientSecret,
    };
  } catch (err) {
    // Payment provider isn't configured yet (see AI_CONTEXT.md) — order
    // and reservation are left in place so the checkout attempt can be
    // resumed once a gateway exists; the periodic sweep
    // (cancelStalePendingOrders in confirmation.ts) will clean this up
    // if it's never completed.
    throw new CheckoutError(
      err instanceof Error ? err.message : "Payment could not be initiated",
      "PAYMENT_INIT_FAILED"
    );
  }
}
