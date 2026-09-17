"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  name: string;
  quantity: number;
}

export function RequestReturnForm({ orderId, items }: { orderId: string; items: Item[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          reason,
          items: selectedIds.map((orderItemId) => ({
            orderItemId,
            quantity: items.find((i) => i.id === orderItemId)?.quantity ?? 1,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not submit return request");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return <p className="text-sm text-[var(--color-success)]">Return request submitted — we'll review it shortly.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-[var(--color-gold)] underline">
        Request a Return
      </button>
    );
  }

  return (
    <div className="rounded border border-[var(--color-border)] p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        Request a Return
      </h2>
      <div className="mb-3 space-y-2">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.includes(item.id)}
              onChange={(e) =>
                setSelectedIds((prev) => (e.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)))
              }
            />
            {item.name} × {item.quantity}
          </label>
        ))}
      </div>
      <textarea
        placeholder="Reason for return"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="mb-3 w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
      />
      {error && <p className="mb-3 text-sm text-[var(--color-error)]">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={submitting || selectedIds.length === 0 || !reason}
          className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit Request"}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--color-text-muted)]">
          Cancel
        </button>
      </div>
    </div>
  );
}
