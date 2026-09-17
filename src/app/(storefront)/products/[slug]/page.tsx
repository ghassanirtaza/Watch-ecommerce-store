import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug } from "@/domain/products/storefront-read";
import { getProductRatingSummary } from "@/domain/reviews/service";
import { VariantSelector } from "@/components/product/variant-selector";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { ProductGalleryLoader as ProductGallery } from "@/components/product/product-gallery-loader";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per spec: canonical URL, SEO title/description, Open Graph metadata
 * for every indexable product. Was missing entirely before this
 * phase — flagged in architecture review, closed here.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const title = product.seoTitle ?? product.name;
  const description = product.seoDescription ?? product.shortDescription ?? undefined;
  const canonicalPath = `/products/${product.slug}`;
  const primaryImage = product.images[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      type: "website", // "product" isn't a valid OG type; product-specific
      // data is carried by the separate JSON-LD block instead
      images: primaryImage ? [{ url: primaryImage }] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const ratingSummary = await getProductRatingSummary(product.id);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Structured data only rendered once the review-quality bar is
          met — per spec, AggregateRating must not render for thin/no
          review data. Threshold is centralized in
          getProductRatingSummary() (domain/reviews/service.ts) so this
          page and any other surface needing it stay consistent. */}
      {ratingSummary.eligibleForStructuredData && (
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger -- JSON-LD, not HTML
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              name: product.name,
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: ratingSummary.average,
                reviewCount: ratingSummary.count,
              },
            }),
          }}
        />
      )}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ProductGallery images={product.images} />

        <div>
          {product.brand && (
            <p className="text-sm uppercase tracking-wide text-[var(--color-text-muted)]">
              {product.brand}
            </p>
          )}
          <h1 className="font-[var(--font-display)] text-2xl">{product.name}</h1>

          {product.shortDescription && (
            <p className="mt-2 text-[var(--color-text-muted)]">{product.shortDescription}</p>
          )}

          <VariantSelectorAndCart product={product} />

          <WatchDetailsAccordion details={product.watchDetails} />

          {product.longDescription && (
            <details className="mt-4 border-t border-[var(--color-border)] pt-4">
              <summary className="cursor-pointer font-medium">Description</summary>
              <div
                className="prose prose-invert mt-2 max-w-none text-sm"
                // Content is sanitized server-side at write time
                // (src/lib/validation/sanitize.ts) before it ever
                // reaches the database — safe to render here.
                dangerouslySetInnerHTML={{ __html: product.longDescription }}
              />
            </details>
          )}
        </div>
      </div>
    </div>
  );
}

function VariantSelectorAndCart({ product }: { product: Awaited<ReturnType<typeof getProductBySlug>> }) {
  if (!product || product.variants.length === 0) {
    return <p className="mt-4 text-[var(--color-error)]">This product is currently unavailable.</p>;
  }

  return (
    <div className="mt-6">
      <VariantSelector variants={product.variants} productId={product.id} />
    </div>
  );
}

function WatchDetailsAccordion({ details }: { details: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>["watchDetails"] }) {
  const rows = [
    ["Movement", details.movementType],
    ["Case Material", details.caseMaterial],
    ["Case Diameter", details.caseDiameterMm ? `${details.caseDiameterMm}mm` : null],
    ["Water Resistance", details.waterResistanceM ? `${details.waterResistanceM}m` : null],
    ["Warranty", details.warrantyMonths ? `${details.warrantyMonths} months` : null],
    ["Authenticity Certificate", details.hasAuthCertificate ? "Included" : null],
    ["Box & Papers", details.boxAndPapers ? "Included" : null],
  ].filter(([, value]) => value);

  if (rows.length === 0) return null;

  return (
    <details className="mt-4 border-t border-[var(--color-border)] pt-4" open>
      <summary className="cursor-pointer font-medium">Specifications</summary>
      <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-[var(--color-text-muted)]">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
