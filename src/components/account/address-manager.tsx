"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAKISTAN_CITIES } from "@/lib/validation/checkout";

interface Address {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  city: string;
  isDefault: boolean;
}

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState(PAKISTAN_CITIES[0]);
  const [isDefault, setIsDefault] = useState(addresses.length === 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, addressLine1, city, isDefault }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save address");
      setFullName("");
      setPhone("");
      setAddressLine1("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this address?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not delete address");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <div className="mb-6 rounded border border-[var(--color-border)]">
        {addresses.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No saved addresses yet.</p>
        ) : (
          addresses.map((a) => (
            <div key={a.id} className="flex items-start justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
              <div>
                <p>
                  {a.fullName} {a.isDefault && <span className="text-xs text-[var(--color-gold)]">(Default)</span>}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {a.addressLine1}, {a.city} · {a.phone}
                </p>
              </div>
              <button onClick={() => handleDelete(a.id)} className="text-xs text-[var(--color-error)] underline">
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {error && <p className="mb-3 text-sm text-[var(--color-error)]">{error}</p>}

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="text-sm text-[var(--color-gold)] underline">
          + Add New Address
        </button>
      ) : (
        <div className="space-y-3 rounded border border-[var(--color-border)] p-4">
          <input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Phone (03xxxxxxxxx)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Address"
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          >
            {PAKISTAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Set as default
          </label>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving || !fullName || !phone || !addressLine1}
              className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Address"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-sm text-[var(--color-text-muted)]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
