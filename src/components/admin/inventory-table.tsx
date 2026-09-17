"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Row {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  availableQuantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
}

export function InventoryTable({ rows, locationId }: { rows: Row[]; locationId: string }) {
  const router = useRouter();
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<"RESTOCK" | "DAMAGED" | "ADJUSTMENT" | "RETURN">("RESTOCK");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitAdjustment(variantId: string) {
    const quantityChange = Number(delta);
    if (!quantityChange) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, locationId, quantityChange, reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not adjust stock");
      setAdjustingId(null);
      setDelta("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-[var(--color-border)]">
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-text-muted)]">No inventory records yet.</p>
      ) : (
        rows.map((row) => {
          const isLow = row.availableQuantity > 0 && row.availableQuantity <= row.lowStockThreshold;
          const isOut = row.availableQuantity === 0;

          return (
            <div key={row.variantId} className="border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
              <div className="flex items-center justify-between">
                <div>
                  <p>
                    {row.productName} — {row.variantName}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">SKU: {row.sku}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={isOut ? "text-[var(--color-error)]" : isLow ? "text-[var(--color-warning)]" : ""}>
                    {row.availableQuantity} available
                    {row.reservedQuantity > 0 && ` (${row.reservedQuantity} reserved)`}
                  </span>
                  <button
                    onClick={() => setAdjustingId(adjustingId === row.variantId ? null : row.variantId)}
                    className="text-[var(--color-gold)] underline"
                  >
                    Adjust
                  </button>
                </div>
              </div>

              {adjustingId === row.variantId && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="+/- quantity"
                    value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    className="w-32 rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
                  />
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as typeof reason)}
                    className="rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
                  >
                    <option value="RESTOCK">Restock</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="ADJUSTMENT">Correction</option>
                    <option value="RETURN">Return</option>
                  </select>
                  <button
                    onClick={() => submitAdjustment(row.variantId)}
                    disabled={saving || !delta}
                    className="rounded bg-[var(--color-gold)] px-3 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
      {error && <p className="p-3 text-sm text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
