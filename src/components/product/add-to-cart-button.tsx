"use client";

import { useState } from "react";

export function AddToCartButton({
  variantId,
  inStock,
  availableQuantity,
}: {
  variantId: string;
  inStock: boolean;
  availableQuantity: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  async function handleAdd() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, quantity: 1 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not add to cart");
      }
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!inStock) {
    return (
      <button
        disabled
        className="w-full rounded bg-[var(--color-bg-elevated)] py-3 text-sm text-[var(--color-text-muted)]"
      >
        Sold Out
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleAdd}
        disabled={loading || availableQuantity === 0}
        className="w-full rounded bg-[var(--color-gold)] py-3 text-sm font-medium text-[var(--color-bg)] disabled:opacity-60"
      >
        {loading ? "Adding..." : added ? "Added to Cart" : "Add to Cart"}
      </button>
      {error && <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
