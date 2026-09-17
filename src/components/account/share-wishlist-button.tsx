"use client";

import { useState } from "react";

export function ShareWishlistButton() {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/wishlist", { method: "PUT" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not create share link");

      const url = `${window.location.origin}/wishlist/shared/${body.shareToken}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleShare} disabled={loading} className="text-sm text-[var(--color-gold)] underline disabled:opacity-50">
        {copied ? "Link copied!" : loading ? "..." : "Share Wishlist"}
      </button>
      {error && <p className="text-xs text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
