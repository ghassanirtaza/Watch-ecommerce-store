import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getFilteredProducts } from "@/domain/products/storefront-read";
import { db } from "@/lib/db/client";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { FilterPanel } from "@/components/storefront/filter-panel";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const category = await db.category.findUnique({ where: { slug } });

  // 404 handling per spec: render an "unavailable" state with
  // recommendations rather than a bare 404 dead-end — but the route
  // itself still needs to signal not-found for correct HTTP status.
  if (!category) notFound();

  const filterInput = {
    categorySlug: slug,
    minPrice: resolvedSearchParams.minPrice ? Number(resolvedSearchParams.minPrice) : undefined,
    maxPrice: resolvedSearchParams.maxPrice ? Number(resolvedSearchParams.maxPrice) : undefined,
    inStockOnly: resolvedSearchParams.inStock === "true",
    sort: (resolvedSearchParams.sort as "newest" | "price_asc" | "price_desc") ?? "newest",
    page: resolvedSearchParams.page ? Number(resolvedSearchParams.page) : 1,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-[var(--color-text-muted)]">
        <a href="/">Home</a> / <span>{category.name}</span>
      </nav>

      <h1 className="mb-6 font-[var(--font-display)] text-3xl">{category.name}</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
        <FilterPanel currentSort={filterInput.sort} />

        <Suspense fallback={<ProductGridSkeleton count={12} />}>
          <CategoryProductGrid filterInput={filterInput} />
        </Suspense>
      </div>
    </div>
  );
}

async function CategoryProductGrid({
  filterInput,
}: {
  filterInput: Parameters<typeof getFilteredProducts>[0];
}) {
  const result = await getFilteredProducts(filterInput);

  if (result.products.length === 0) {
    // Empty collection state per spec: reassuring tone + CTA, not a
    // dead end — distinct from the "0 results after filtering" case,
    // which needs to preserve the user's filter selections.
    const hasActiveFilters =
      "minPrice" in filterInput || "maxPrice" in filterInput || filterInput.inStockOnly;

    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="mb-2 text-lg">
          {hasActiveFilters
            ? "No products match these specific filters."
            : "New items coming soon."}
        </p>
        <a href={hasActiveFilters ? "?" : "/shop"} className="text-[var(--color-gold)] underline">
          {hasActiveFilters ? "Reset all filters" : "Browse all products"}
        </a>
      </div>
    );
  }

  return <ProductGrid products={result.products} />;
}
