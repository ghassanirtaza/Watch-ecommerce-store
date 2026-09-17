"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Page {
  id: string;
  slug: string;
  title: string;
  status: string;
}

export function ContentPageManager({ pages }: { pages: Page[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleSave(publish: boolean) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/content-pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug: slug || slugify(title), body, publish }),
      });
      const responseBody = await res.json();
      if (!res.ok) throw new Error(responseBody.error ?? "Could not save page");
      setTitle("");
      setSlug("");
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 rounded border border-[var(--color-border)]">
        {pages.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No pages yet.</p>
        ) : (
          pages.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
              <span>{p.title}</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                /{p.slug} · {p.status}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="space-y-3 rounded border border-[var(--color-border)] p-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">New Page</h2>
        <input
          placeholder="Title (e.g. Shipping Information)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <input
          placeholder="Slug (auto if blank)"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <textarea
          placeholder="Page content"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !title || !body}
            className="rounded border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !title || !body}
            className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save & Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
