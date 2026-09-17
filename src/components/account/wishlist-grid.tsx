"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string | null;
  currentPrice: number | null;
  isInStock: boolean | null;
  isPurchasable: boolean;
}

export function WishlistGrid({ items }: { items: Item[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function remove(productId: string, variantId: string | null) {
    setRemovingId(productId);
    try {
      await fetch("/api/account/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, variantId: variantId ?? undefined }),
      });
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className="rounded border border-[var(--color-border)] p-3">
          <a href={`/products/${item.productSlug}`} className="text-sm">
            {item.productName}
          </a>
          {item.currentPrice !== null && (
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Rs. {item.currentPrice.toLocaleString("en-PK")}
            </p>
          )}
          {item.isInStock === false && <p className="mt-1 text-xs text-[var(--color-error)]">Out of stock</p>}
          <button
            onClick={() => remove(item.productId, item.variantId)}
            disabled={removingId === item.productId}
            className="mt-2 text-xs text-[var(--color-text-muted)] underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
