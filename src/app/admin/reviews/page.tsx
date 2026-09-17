import { db } from "@/lib/db/client";
import { ReviewModerationRow } from "@/components/admin/review-moderation-row";

export default async function AdminReviewsPage() {
  const reviews = await db.review.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { product: true, customer: { include: { user: true } } },
  });

  return (
    <div>
      <h1 className="mb-1 text-xl">Reviews</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">Pending moderation ({reviews.length})</p>

      <div className="rounded border border-[var(--color-border)]">
        {reviews.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No reviews pending moderation.</p>
        ) : (
          reviews.map((r) => (
            <ReviewModerationRow
              key={r.id}
              review={{
                id: r.id,
                productName: r.product.name,
                customerEmail: r.customer.user.email,
                rating: r.rating,
                title: r.title,
                body: r.body,
                isVerifiedPurchase: r.orderItemId !== null,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}
