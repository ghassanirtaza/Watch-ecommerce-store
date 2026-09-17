import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";

/**
 * Admin-side coupon management. Validation/redemption logic (the
 * customer-facing, checkout-time authoritative check) lives in
 * domain/coupons/service.ts — this file is create/edit/list only, kept
 * separate the same way domain/products/service.ts (admin writes) is
 * kept separate from domain/products/storefront-read.ts (public reads).
 */

const createCouponSchema = z.object({
  code: z.string().min(3).max(30).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, and hyphens only"),
  type: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "FREE_SHIPPING"]),
  amount: z.number().nonnegative(),
  minimumOrderValue: z.number().nonnegative().optional(),
  maximumDiscount: z.number().positive().optional(),
  startAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  usageLimit: z.number().int().positive().optional(),
  perCustomerLimit: z.number().int().positive().optional(),
  eligibleProductIds: z.array(z.string().cuid()).optional(),
  eligibleCategoryIds: z.array(z.string().cuid()).optional(),
});

export async function createCoupon(input: z.infer<typeof createCouponSchema>) {
  const session = await requirePermission("coupons.create");
  const data = createCouponSchema.parse(input);

  const code = data.code.toUpperCase();
  const existing = await db.coupon.findUnique({ where: { code } });
  if (existing) throw new Error(`Coupon code "${code}" already exists`);

  if (data.startAt && data.expiresAt && data.startAt >= data.expiresAt) {
    throw new Error("Start date must be before expiry date");
  }
  if (data.type === "PERCENTAGE" && data.amount > 100) {
    throw new Error("Percentage discount cannot exceed 100");
  }

  const eligibility = [
    ...(data.eligibleProductIds ?? []).map((productId) => ({ productId })),
    ...(data.eligibleCategoryIds ?? []).map((categoryId) => ({ categoryId })),
  ];

  const coupon = await db.coupon.create({
    data: {
      code,
      type: data.type,
      amount: data.amount,
      minimumOrderValue: data.minimumOrderValue,
      maximumDiscount: data.maximumDiscount,
      startAt: data.startAt,
      expiresAt: data.expiresAt,
      usageLimit: data.usageLimit,
      perCustomerLimit: data.perCustomerLimit,
      status: "DRAFT",
      eligibility: eligibility.length > 0 ? { create: eligibility } : undefined,
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "coupon.created",
    resource: `Coupon:${coupon.id}`,
    after: coupon,
  });

  return coupon;
}

export async function setCouponStatus(couponId: string, status: "ACTIVE" | "DISABLED") {
  const session = await requirePermission("coupons.update");

  const before = await db.coupon.findUnique({ where: { id: couponId } });
  if (!before) throw new Error("Coupon not found");

  const updated = await db.coupon.update({ where: { id: couponId }, data: { status } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "coupon.status_changed",
    resource: `Coupon:${couponId}`,
    before: { status: before.status },
    after: { status },
  });

  return updated;
}

export async function listCoupons(filter?: { status?: string }) {
  await requirePermission("coupons.read");
  return db.coupon.findMany({
    where: filter?.status ? { status: filter.status as never } : undefined,
    include: { _count: { select: { redemptions: true } } },
    orderBy: { createdAt: "desc" },
  });
}
