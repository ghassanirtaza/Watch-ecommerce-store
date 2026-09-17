import { db } from "@/lib/db/client";

export interface CouponValidationResult {
  valid: boolean;
  reason?: string;
  discountAmount?: number;
  freeShipping?: boolean;
}

/**
 * Every rule from spec §20 checked server-side: expiration, minimum
 * order value, product/category eligibility, per-customer usage limit,
 * overall usage limit. Called both when the customer applies a code in
 * the cart (for display) AND again at order confirmation (authoritative)
 * — never trust that a previously-validated code is still valid by the
 * time the order is placed.
 */
export async function validateCoupon(params: {
  code: string;
  cartSubtotal: number;
  cartVariantIds: string[];
  cartCategoryIds: string[];
  customerId: string | null;
}): Promise<CouponValidationResult> {
  const coupon = await db.coupon.findUnique({
    where: { code: params.code.toUpperCase() },
    include: { eligibility: true },
  });

  if (!coupon) return { valid: false, reason: "Invalid coupon code" };
  if (coupon.status !== "ACTIVE") return { valid: false, reason: "This coupon is not active" };

  const now = new Date();
  if (coupon.startAt && coupon.startAt > now) {
    return { valid: false, reason: "This coupon is not yet active" };
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { valid: false, reason: "This coupon has expired" };
  }

  if (coupon.minimumOrderValue && params.cartSubtotal < Number(coupon.minimumOrderValue)) {
    return {
      valid: false,
      reason: `Requires a minimum order of Rs. ${Number(coupon.minimumOrderValue).toLocaleString("en-PK")}`,
    };
  }

  if (coupon.eligibility.length > 0) {
    const eligibleByProduct = coupon.eligibility.some(
      (e) => e.productId && params.cartVariantIds.includes(e.productId)
    );
    const eligibleByCategory = coupon.eligibility.some(
      (e) => e.categoryId && params.cartCategoryIds.includes(e.categoryId)
    );
    if (!eligibleByProduct && !eligibleByCategory) {
      return { valid: false, reason: "This coupon doesn't apply to items in your cart" };
    }
  }

  if (coupon.usageLimit !== null) {
    const totalRedemptions = await db.couponRedemption.count({ where: { couponId: coupon.id } });
    if (totalRedemptions >= coupon.usageLimit) {
      return { valid: false, reason: "This coupon has reached its usage limit" };
    }
  }

  if (coupon.perCustomerLimit !== null && params.customerId) {
    const customerRedemptions = await db.couponRedemption.count({
      where: { couponId: coupon.id, customerId: params.customerId },
    });
    if (customerRedemptions >= coupon.perCustomerLimit) {
      return { valid: false, reason: "You've already used this coupon the maximum number of times" };
    }
  }

  if (coupon.type === "FREE_SHIPPING") {
    return { valid: true, discountAmount: 0, freeShipping: true };
  }

  let discountAmount =
    coupon.type === "PERCENTAGE"
      ? params.cartSubtotal * (Number(coupon.amount) / 100)
      : Number(coupon.amount);

  if (coupon.maximumDiscount) {
    discountAmount = Math.min(discountAmount, Number(coupon.maximumDiscount));
  }
  discountAmount = Math.min(discountAmount, params.cartSubtotal);

  return { valid: true, discountAmount };
}

export async function recordCouponRedemption(params: {
  code: string;
  orderId: string;
  customerId: string | null;
}) {
  const coupon = await db.coupon.findUnique({ where: { code: params.code.toUpperCase() } });
  if (!coupon) return;

  await db.couponRedemption.create({
    data: { couponId: coupon.id, orderId: params.orderId, customerId: params.customerId },
  });
}
