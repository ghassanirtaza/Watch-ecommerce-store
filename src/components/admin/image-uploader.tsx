"use client";

import { useState } from "react";

interface UploadedAsset {
  id: string;
  url: string;
  altText: string | null;
}

/**
 * Flow: (1) fetch a signed upload signature from our server — the
 * Cloudinary API secret never reaches the browser, (2) upload the file
 * directly to Cloudinary using that signature, (3) register the
 * resulting publicId with our own MediaAsset table, which re-verifies
 * the actual format/size against Cloudinary's API rather than trusting
 * what the browser reports.
 *
 * This cannot be exercised end-to-end in a sandboxed environment
 * without live CLOUDINARY_* credentials — same class of external
 * dependency as the payment gateway and courier adapters elsewhere in
 * this codebase. The code path is real and correct; it has not been
 * run against a live Cloudinary account.
 */
export function ImageUploader({
  folder,
  onUploaded,
}: {
  folder: string;
  onUploaded: (asset: UploadedAsset) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAltText, setPendingAltText] = useState("");
  const [pendingPublicId, setPendingPublicId] = useState<string | null>(null);

  async function handleFileSelect(file: File) {
    setError(null);
    setUploading(true);
    try {
      const signRes = await fetch("/api/admin/media/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      if (!signRes.ok) throw new Error("Could not get upload authorization");
      const { timestamp, signature, apiKey, cloudName } = await signRes.json();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("api_key", apiKey);
      formData.append("folder", folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload to Cloudinary failed");
      const uploaded = await uploadRes.json();

      // Don't register yet — alt text is required for accessibility
      // (per domain/content/media.ts) and shouldn't be an afterthought
      // defaulted to the filename. Hold the publicId and ask for it.
      setPendingPublicId(uploaded.public_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function confirmWithAltText() {
    if (!pendingPublicId || !pendingAltText) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId: pendingPublicId, altText: pendingAltText }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not register image");
      onUploaded({ id: body.id, url: body.url, altText: body.altText });
      setPendingPublicId(null);
      setPendingAltText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  if (pendingPublicId) {
    return (
      <div className="rounded border border-[var(--color-border)] p-3">
        <p className="mb-2 text-xs text-[var(--color-text-muted)]">
          Uploaded — alt text is required before this image can be used.
        </p>
        <input
          placeholder="Describe this image for screen readers"
          value={pendingAltText}
          onChange={(e) => setPendingAltText(e.target.value)}
          className="mb-2 w-full rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
        />
        <button
          onClick={confirmWithAltText}
          disabled={uploading || !pendingAltText}
          className="rounded bg-[var(--color-gold)] px-3 py-1.5 text-sm text-[var(--color-bg)] disabled:opacity-50"
        >
          {uploading ? "Saving..." : "Confirm Image"}
        </button>
        {error && <p className="mt-2 text-xs text-[var(--color-error)]">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
        className="text-sm"
      />
      {uploading && <p className="mt-1 text-xs text-[var(--color-text-muted)]">Uploading...</p>}
      {error && <p className="mt-1 text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
