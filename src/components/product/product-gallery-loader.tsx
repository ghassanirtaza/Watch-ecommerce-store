"use client";

import dynamic from "next/dynamic";
import type { GalleryImage } from "./product-gallery";

/**
 * `next/dynamic(..., { ssr: false })` is only allowed inside a Client
 * Component — Next.js 15 rejects it at build time if called directly
 * from a Server Component (see src/app/(storefront)/products/[slug]/page.tsx,
 * which is an async Server Component). This tiny "use client" wrapper
 * is the fix: the server page imports THIS as a normal component, and
 * the ssr:false dynamic-import call happens in here instead, keeping
 * the GSAP-bearing gallery out of the server-rendered payload per the
 * scoping rule in docs/DESIGN_SYSTEM.md.
 */
const ProductGalleryDynamic = dynamic(
  () => import("./product-gallery").then((m) => m.ProductGallery),
  {
    ssr: false,
    loading: () => (
      <div className="aspect-square animate-pulse rounded-md bg-[var(--color-bg-elevated)]" />
    ),
  }
);

export function ProductGalleryLoader({ images }: { images: GalleryImage[] }) {
  return <ProductGalleryDynamic images={images} />;
}
