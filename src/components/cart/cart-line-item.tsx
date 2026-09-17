"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LineItem {
  cartItemId: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export function CartLineItem({ item }: { item: LineItem }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateQuantity(newQuantity: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cart/items/${item.cartItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: newQuantity }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update quantity");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    try {
      await fetch(`/api/cart/items/${item.cartItemId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="py-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm">{item.variantName}</p>
          <p className="text-sm text-[var(--color-text-muted)]">Rs. {item.unitPrice.toLocaleString("en-PK")}</p>
        </div>
        <p className="text-sm font-medium">Rs. {item.lineTotal.toLocaleString("en-PK")}</p>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center gap-2 rounded border border-[var(--color-border)]">
          <button
            onClick={() => updateQuantity(item.quantity - 1)}
            disabled={loading}
            className="px-2 py-1 text-sm disabled:opacity-50"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="text-sm">{item.quantity}</span>
          <button
            onClick={() => updateQuantity(item.quantity + 1)}
            disabled={loading}
            className="px-2 py-1 text-sm disabled:opacity-50"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <button onClick={remove} disabled={loading} className="text-sm text-[var(--color-text-muted)] underline">
          Remove
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
