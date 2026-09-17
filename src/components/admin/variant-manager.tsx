"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Variant {
  id: string;
  sku: string;
  variantName: string;
  price: number;
  isActive: boolean;
  attributes: { key: string; value: string }[];
  stock: number;
}

export function VariantManager({ productId, variants }: { productId: string; variants: Variant[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [sku, setSku] = useState("");
  const [variantName, setVariantName] = useState("");
  const [price, setPrice] = useState("");
  const [initialStock, setInitialStock] = useState("0");
  const [attributesText, setAttributesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Attributes entered as "Key: Value" lines — simplest input that
  // maps directly onto the attributes array the API expects, without
  // building a full dynamic key-value row editor for this admin pass.
  function parseAttributes(): { key: string; value: string }[] {
    return attributesText
      .split("\n")
      .map((line) => line.split(":").map((s) => s.trim()))
      .filter((parts) => parts.length === 2 && parts[0] && parts[1])
      .map(([key, value]) => ({ key, value }));
  }

  async function handleAddVariant() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          sku: sku.toUpperCase(),
          variantName,
          price: Number(price),
          attributes: parseAttributes(),
          initialStock: Number(initialStock),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create variant");

      setSku("");
      setVariantName("");
      setPrice("");
      setInitialStock("0");
      setAttributesText("");
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Variants</h2>
        <button onClick={() => setShowForm((v) => !v)} className="text-sm text-[var(--color-gold)] underline">
          {showForm ? "Cancel" : "+ Add Variant"}
        </button>
      </div>

      {variants.length === 0 ? (
        <p className="mb-4 text-sm text-[var(--color-text-muted)]">
          No variants yet — this product cannot be purchased until at least one is added.
        </p>
      ) : (
        <div className="mb-4 rounded border border-[var(--color-border)]">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
              <div>
                <p>{v.variantName}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  SKU: {v.sku} {v.attributes.map((a) => `${a.key}: ${a.value}`).join(", ")}
                </p>
              </div>
              <div className="text-right text-xs text-[var(--color-text-muted)]">
                <p>Rs. {v.price.toLocaleString("en-PK")}</p>
                <p className={v.stock === 0 ? "text-[var(--color-error)]" : ""}>{v.stock} in stock</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="space-y-3 rounded border border-[var(--color-border)] p-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="SKU"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
            />
            <input
              placeholder="Variant name (e.g. 42mm / Steel)"
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
            />
            <input
              placeholder="Price (PKR)"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
            />
            <input
              placeholder="Initial stock"
              type="number"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
              className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
            />
          </div>
          <textarea
            placeholder={"Attributes, one per line, e.g.:\nCase Size: 42mm\nStrap: Leather"}
            value={attributesText}
            onChange={(e) => setAttributesText(e.target.value)}
            rows={3}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          <button
            onClick={handleAddVariant}
            disabled={saving || !sku || !variantName || !price}
            className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add Variant"}
          </button>
        </div>
      )}
    </div>
  );
}
