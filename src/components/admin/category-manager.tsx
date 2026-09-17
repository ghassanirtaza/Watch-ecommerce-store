"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  slug: string;
  parentName: string | null;
  productCount: number;
}

export function CategoryManager({
  categories,
  allCategories,
}: {
  categories: Category[];
  allCategories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleCreate() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug: slug || slugify(name), parentId: parentId || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create category");
      setName("");
      setSlug("");
      setParentId("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this category?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not delete category");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  return (
    <div>
      <div className="mb-6 rounded border border-[var(--color-border)]">
        {categories.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No categories yet.</p>
        ) : (
          categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
              <div>
                <p>{c.parentName ? `${c.parentName} / ${c.name}` : c.name}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {c.slug} · {c.productCount} product(s)
                </p>
              </div>
              <button onClick={() => handleDelete(c.id)} className="text-xs text-[var(--color-error)] underline">
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 rounded border border-[var(--color-border)] p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          New Category
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Slug (auto if blank)"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
        </div>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        >
          <option value="">No parent (top-level)</option>
          {allCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={saving || !name}
          className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create Category"}
        </button>
      </div>
    </div>
  );
}
