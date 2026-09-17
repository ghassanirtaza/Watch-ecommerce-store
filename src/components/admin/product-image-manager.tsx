"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUploader } from "@/components/admin/image-uploader";

interface ProductImg {
  id: string;
  url: string;
  altText: string | null;
}

export function ProductImageManager({ productId, images }: { productId: string; images: ProductImg[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attachImage(asset: { id: string; url: string; altText: string | null }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, mediaAssetId: asset.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not add image");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function removeImage(productImageId: string) {
    setSaving(true);
    try {
      await fetch("/api/admin/product-images", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productImageId }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Images</h2>

      {images.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- small admin thumbnail grid */}
              <img src={img.url} alt={img.altText ?? ""} className="h-20 w-20 rounded object-cover" />
              <button
                onClick={() => removeImage(img.id)}
                disabled={saving}
                className="absolute -right-1 -top-1 rounded-full bg-[var(--color-error)] px-1.5 text-xs text-white"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <ImageUploader folder="products" onUploaded={attachImage} />
      {error && <p className="mt-2 text-sm text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
