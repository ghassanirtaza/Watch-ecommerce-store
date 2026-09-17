"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Coupon {
  id: string;
  code: string;
  type: string;
  amount: number;
  status: string;
  redemptionCount: number;
  usageLimit: number | null;
}

export function CouponManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING">("PERCENTAGE");
  const [amount, setAmount] = useState("");
  const [minimumOrderValue, setMinimumOrderValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          type,
          amount: Number(amount),
          minimumOrderValue: minimumOrderValue ? Number(minimumOrderValue) : undefined,
          expiresAt: expiresAt || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create coupon");
      setCode("");
      setAmount("");
      setMinimumOrderValue("");
      setExpiresAt("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "DISABLED" : "ACTIVE";
    await fetch(`/api/admin/coupons/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 rounded border border-[var(--color-border)]">
        {coupons.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No coupons yet.</p>
        ) : (
          coupons.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
              <div>
                <p>
                  {c.code} — {c.type === "PERCENTAGE" ? `${c.amount}%` : c.type === "FIXED_AMOUNT" ? `Rs. ${c.amount}` : "Free Shipping"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {c.redemptionCount} used{c.usageLimit ? ` / ${c.usageLimit}` : ""} · {c.status}
                </p>
              </div>
              {(c.status === "ACTIVE" || c.status === "DRAFT" || c.status === "DISABLED") && (
                <button onClick={() => toggleStatus(c.id, c.status)} className="text-xs text-[var(--color-gold)] underline">
                  {c.status === "ACTIVE" ? "Disable" : "Activate"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 rounded border border-[var(--color-border)] p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">New Coupon</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Code (e.g. SAVE20)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          >
            <option value="PERCENTAGE">Percentage</option>
            <option value="FIXED_AMOUNT">Fixed Amount</option>
            <option value="FREE_SHIPPING">Free Shipping</option>
          </select>
          <input
            placeholder={type === "PERCENTAGE" ? "Percent (e.g. 10)" : "Amount (PKR)"}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
            disabled={type === "FREE_SHIPPING"}
          />
          <input
            placeholder="Minimum order value (optional)"
            type="number"
            value={minimumOrderValue}
            onChange={(e) => setMinimumOrderValue(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
        </div>
        <input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        <p className="text-xs text-[var(--color-text-muted)]">
          New coupons are created as Draft — activate from the list above once ready.
        </p>
        <button
          onClick={handleCreate}
          disabled={saving || !code || (type !== "FREE_SHIPPING" && !amount)}
          className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Coupon"}
        </button>
      </div>
    </div>
  );
}
