"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/admin/image-uploader";

interface Banner {
  id: string;
  title: string;
  status: string;
  imageUrl: string | null;
}

export function BannerManager({ banners }: { banners: Banner[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [mediaAssetId, setMediaAssetId] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!mediaAssetId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, ctaLabel: ctaLabel || undefined, ctaUrl: ctaUrl || undefined, mediaAssetId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create banner");
      setTitle("");
      setCtaLabel("");
      setCtaUrl("");
      setMediaAssetId(null);
      setUploadedUrl(null);
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(id: string, currentStatus: string) {
    const action = currentStatus === "PUBLISHED" ? "archive" : "publish";
    await fetch(`/api/admin/banners/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 rounded border border-[var(--color-border)]">
        {banners.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No active promotional banners configured.</p>
        ) : (
          banners.map((b) => (
            <div key={b.id} className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0">
              <div className="flex items-center gap-3">
                {b.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail, next/image overhead not warranted here
                  <img src={b.imageUrl} alt="" className="h-10 w-10 rounded object-cover" />
                )}
                <span>{b.title}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-text-muted)]">{b.status}</span>
                <button onClick={() => togglePublish(b.id, b.status)} className="text-xs text-[var(--color-gold)] underline">
                  {b.status === "PUBLISHED" ? "Archive" : "Publish"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="text-sm text-[var(--color-gold)] underline">
          + New Banner
        </button>
      ) : (
        <div className="space-y-3 rounded border border-[var(--color-border)] p-4">
          <input
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Button label (optional)"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <input
            placeholder="Button link (optional)"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />

          {uploadedUrl ? (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={uploadedUrl} alt="" className="h-16 w-16 rounded object-cover" />
              <span className="text-xs text-[var(--color-success)]">Image uploaded</span>
            </div>
          ) : (
            <ImageUploader
              folder="banners"
              onUploaded={(asset) => {
                setMediaAssetId(asset.id);
                setUploadedUrl(asset.url);
              }}
            />
          )}

          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={saving || !title || !mediaAssetId}
              className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Banner"}
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
