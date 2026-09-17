import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireSession, requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";

/**
 * Per AI_CONTEXT.md non-negotiable rule: "Verified Purchase" is derived
 * from order data (OrderItem linkage), never a client-supplied
 * checkbox. This service enforces that at write time — there is no
 * "isVerified: boolean" field the client can set. It's computed by
 * whether orderItemId resolves to a real, delivered order containing
 * this product for this customer.
 */

const submitReviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(150).optional(),
  body: z.string().min(10).max(5000).optional(),
});

export async function submitReview(input: z.infer<typeof submitReviewSchema>) {
  const session = await requireSession();
  const data = submitReviewSchema.parse(input);

  const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) throw new Error("Customer profile not found");

  // Resolve verified-purchase status server-side: find a delivered
  // order item for this customer + product. If none exists, the review
  // is still allowed (spec doesn't require purchase to review) but
  // orderItemId stays null, so no "Verified Purchase" badge renders.
  const qualifyingOrderItem = await db.orderItem.findFirst({
    where: {
      variant: { productId: data.productId },
      order: { customerId: profile.id, status: "DELIVERED" },
    },
    orderBy: { order: { createdAt: "desc" } },
  });

  // Rate limit: one review per customer per product, not one per
  // order item — prevents a customer who bought the same watch twice
  // from posting duplicate reviews to inflate rating counts.
  const existingReview = await db.review.findFirst({
    where: { productId: data.productId, customerId: profile.id },
  });
  if (existingReview) {
    throw new Error("You've already reviewed this product");
  }

  const review = await db.review.create({
    data: {
      productId: data.productId,
      customerId: profile.id,
      orderItemId: qualifyingOrderItem?.id, // null if no delivered order — badge simply won't render
      rating: data.rating,
      title: data.title,
      body: data.body,
      status: "PENDING",
    },
  });

  return { reviewId: review.id, isVerifiedPurchase: qualifyingOrderItem !== null };
}

const uploadReviewImageSchema = z.object({
  reviewId: z.string().cuid(),
  mediaAssetId: z.string().cuid(),
});

export async function attachReviewImage(input: z.infer<typeof uploadReviewImageSchema>) {
  const session = await requireSession();
  const data = uploadReviewImageSchema.parse(input);

  const review = await db.review.findUnique({
    where: { id: data.reviewId },
    include: { customer: true },
  });
  if (!review) throw new Error("Review not found");
  if (review.customer.userId !== session.user.id) {
    throw new Error("Not the review owner");
  }

  const existingCount = await db.reviewImage.count({ where: { reviewId: data.reviewId } });
  if (existingCount >= 5) {
    throw new Error("Maximum 5 images per review");
  }

  return db.reviewImage.create({
    data: { reviewId: data.reviewId, mediaAssetId: data.mediaAssetId },
  });
}

// --- Admin moderation ---

export async function moderateReview(
  reviewId: string,
  decision: "APPROVED" | "REJECTED" | "FLAGGED",
  reason?: string
) {
  const session = await requirePermission("content.update");

  const before = await db.review.findUnique({ where: { id: reviewId } });
  if (!before) throw new Error("Review not found");

  const updated = await db.review.update({
    where: { id: reviewId },
    data: { status: decision, moderatedById: session.user.id },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: `review.${decision.toLowerCase()}`,
    resource: `Review:${reviewId}`,
    before: { status: before.status },
    after: { status: decision },
    reason,
  });

  return updated;
}

/**
 * AggregateRating structured data eligibility, per spec: only renders
 * once review data meets a quality bar. Threshold (3 approved reviews)
 * lives here so it's consistent between the PDP page and anywhere else
 * that might need to check the same condition.
 */
const MIN_REVIEWS_FOR_AGGREGATE_RATING = 3;

export async function getProductRatingSummary(productId: string) {
  const approved = await db.review.findMany({
    where: { productId, status: "APPROVED" },
    select: { rating: true },
  });

  if (approved.length === 0) {
    return { count: 0, average: null, eligibleForStructuredData: false };
  }

  const average = approved.reduce((sum, r) => sum + r.rating, 0) / approved.length;

  return {
    count: approved.length,
    average,
    eligibleForStructuredData: approved.length >= MIN_REVIEWS_FOR_AGGREGATE_RATING,
  };
}
