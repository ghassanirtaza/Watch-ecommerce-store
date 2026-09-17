"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderActions({
  orderId,
  status,
  availableTransitions,
}: {
  orderId: string;
  status: string;
  availableTransitions: string[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function transition(newStatus: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transition", status: newStatus }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update status");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    const reason = window.prompt("Reason for cancellation:");
    if (!reason) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not cancel order");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const canCancel = ["CONFIRMED", "PROCESSING", "PACKED"].includes(status);

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
      {availableTransitions
        .filter((s) => s !== "CANCELLED")
        .map((s) => (
          <button
            key={s}
            onClick={() => transition(s)}
            disabled={loading}
            className="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Mark {s.replace(/_/g, " ")}
          </button>
        ))}
      {canCancel && (
        <button
          onClick={cancel}
          disabled={loading}
          className="rounded border border-[var(--color-error)] px-3 py-1.5 text-sm text-[var(--color-error)] disabled:opacity-50"
        >
          Cancel Order
        </button>
      )}
    </div>
  );
}
