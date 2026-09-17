"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { withReducedMotionGuard } from "@/lib/motion/reduced-motion";

/**
 * One of the two-or-three approved GSAP surfaces per
 * docs/DESIGN_SYSTEM.md. This component must always be imported via
 * next/dynamic({ ssr: false }) from its parent — never imported
 * directly — so GSAP never ships in the server-rendered payload.
 */
export interface GalleryImage {
  url: string;
  altText: string;
}

export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!imageRef.current) return;

    withReducedMotionGuard(
      () =>
        gsap.fromTo(
          imageRef.current,
          { opacity: 0, scale: 1.02 },
          { opacity: 1, scale: 1, duration: 0.4, ease: "power2.out" }
        ),
      () => gsap.set(imageRef.current, { opacity: 1, scale: 1 })
    );
  }, [activeIndex]);

  if (images.length === 0) {
    return (
      <div className="aspect-square bg-[var(--color-bg-elevated)] flex items-center justify-center text-[var(--color-text-muted)]">
        No image available
      </div>
    );
  }

  const active = images[activeIndex];

  return (
    <div>
      <div ref={imageRef} className="relative aspect-square overflow-hidden bg-[var(--color-bg-elevated)]">
        <Image
          src={active.url}
          alt={active.altText}
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div
          className="mt-3 flex gap-2 overflow-x-auto"
          role="tablist"
          aria-label="Product image thumbnails"
        >
          {images.map((img, i) => (
            <button
              key={img.url}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`View image ${i + 1} of ${images.length}`}
              onClick={() => setActiveIndex(i)}
              className={`relative h-16 w-16 shrink-0 overflow-hidden border ${
                i === activeIndex ? "border-[var(--color-gold)]" : "border-[var(--color-border)]"
              }`}
            >
              <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
