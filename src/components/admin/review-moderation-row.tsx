"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Review {
  id: string;
  productName: string;
  customerEmail: string;
  rating: number;
  title: string | null;
  body: string | null;
  isVerifiedPurchase: boolean;
}

export function ReviewModerationRow({ review }: { review: Review }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function moderate(decision: "APPROVED" | "REJECTED" | "FLAGGED") {
    setLoading(true);
    try {
      await fetch(`/api/admin/reviews/${review.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-[var(--color-border)] p-4 text-sm last:border-b-0">
      <div className="mb-1 flex items-center justify-between">
        <p>
          {review.productName} — {"★".repeat(review.rating)}
          {review.isVerifiedPurchase && (
            <span className="ml-2 text-xs text-[var(--color-success)]">Verified Purchase</span>
          )}
        </p>
        <span className="text-xs text-[var(--color-text-muted)]">{review.customerEmail}</span>
      </div>
      {review.title && <p className="font-medium">{review.title}</p>}
      {review.body && <p className="text-[var(--color-text-muted)]">{review.body}</p>}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => moderate("APPROVED")}
          disabled={loading}
          className="rounded border border-[var(--color-success)] px-3 py-1.5 text-xs text-[var(--color-success)] disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => moderate("REJECTED")}
          disabled={loading}
          className="rounded border border-[var(--color-error)] px-3 py-1.5 text-xs text-[var(--color-error)] disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={() => moderate("FLAGGED")}
          disabled={loading}
          className="rounded border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-50"
        >
          Flag
        </button>
      </div>
    </div>
  );
}
