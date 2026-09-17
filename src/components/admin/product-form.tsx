"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
}

interface ExistingProduct {
  id: string;
  name: string;
  slug: string;
  brand?: string | null;
  shortDescription?: string | null;
  longDescription?: string | null;
  movementType?: string | null;
  caseMaterial?: string | null;
  caseDiameterMm?: number | null;
  waterResistanceM?: number | null;
  warrantyMonths?: number | null;
  hasAuthCertificate?: boolean;
  boxAndPapers?: boolean;
  categoryIds?: string[];
}

export function ProductForm({ categories, existing }: { categories: Category[]; existing?: ExistingProduct }) {
  const router = useRouter();
  const isEdit = !!existing;

  const [name, setName] = useState(existing?.name ?? "");
  const [slug, setSlug] = useState(existing?.slug ?? "");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [shortDescription, setShortDescription] = useState(existing?.shortDescription ?? "");
  const [longDescription, setLongDescription] = useState(existing?.longDescription ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(existing?.categoryIds ?? []);

  const [movementType, setMovementType] = useState(existing?.movementType ?? "");
  const [caseMaterial, setCaseMaterial] = useState(existing?.caseMaterial ?? "");
  const [caseDiameterMm, setCaseDiameterMm] = useState(existing?.caseDiameterMm?.toString() ?? "");
  const [waterResistanceM, setWaterResistanceM] = useState(existing?.waterResistanceM?.toString() ?? "");
  const [warrantyMonths, setWarrantyMonths] = useState(existing?.warrantyMonths?.toString() ?? "");
  const [hasAuthCertificate, setHasAuthCertificate] = useState(existing?.hasAuthCertificate ?? false);
  const [boxAndPapers, setBoxAndPapers] = useState(existing?.boxAndPapers ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function handleSave(publish: boolean) {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name,
        slug: slug || slugify(name),
        brand: brand || undefined,
        shortDescription: shortDescription || undefined,
        longDescription: longDescription || undefined,
        categoryIds,
        movementType: movementType || undefined,
        caseMaterial: caseMaterial || undefined,
        caseDiameterMm: caseDiameterMm ? Number(caseDiameterMm) : undefined,
        waterResistanceM: waterResistanceM ? Number(waterResistanceM) : undefined,
        warrantyMonths: warrantyMonths ? Number(warrantyMonths) : undefined,
        hasAuthCertificate,
        boxAndPapers,
      };

      const res = await fetch(isEdit ? `/api/admin/products/${existing!.id}` : "/api/admin/products", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save product");

      const productId = isEdit ? existing!.id : body.id;

      if (publish) {
        const publishRes = await fetch(`/api/admin/products/${productId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "publish" }),
        });
        if (!publishRes.ok) {
          const publishBody = await publishRes.json();
          throw new Error(publishBody.error ?? "Product saved, but could not publish");
        }
      }

      router.push(`/admin/products/${productId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          General
        </legend>
        <input
          placeholder="Product name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <input
          placeholder="Slug (auto-generated if left blank)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <input
          placeholder="Brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <textarea
          placeholder="Short description"
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <textarea
          placeholder="Full description"
          value={longDescription}
          onChange={(e) => setLongDescription(e.target.value)}
          rows={5}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Categories
        </legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={categoryIds.includes(c.id)}
                onChange={(e) =>
                  setCategoryIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                }
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Watch Details
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={movementType}
            onChange={(e) => setMovementType(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          >
            <option value="">Movement type</option>
            <option value="Automatic">Automatic</option>
            <option value="Quartz">Quartz</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Solar">Solar</option>
          </select>
          <input
            placeholder="Case material"
            value={caseMaterial}
            onChange={(e) => setCaseMaterial(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Case diameter (mm)"
            type="number"
            value={caseDiameterMm}
            onChange={(e) => setCaseDiameterMm(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Water resistance (m)"
            type="number"
            value={waterResistanceM}
            onChange={(e) => setWaterResistanceM(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Warranty (months)"
            type="number"
            value={warrantyMonths}
            onChange={(e) => setWarrantyMonths(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={hasAuthCertificate} onChange={(e) => setHasAuthCertificate(e.target.checked)} />
          Includes authenticity certificate
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={boxAndPapers} onChange={(e) => setBoxAndPapers(e.target.checked)} />
          Includes box &amp; papers
        </label>
      </fieldset>

      {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => handleSave(false)}
          disabled={saving || !name || categoryIds.length === 0}
          className="rounded border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          Save as Draft
        </button>
        <button
          onClick={() => handleSave(true)}
          disabled={saving || !name || categoryIds.length === 0}
          className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
