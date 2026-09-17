import { Suspense } from "react";
import { headers } from "next/headers";
import { searchProducts, getZeroResultFallback } from "@/lib/search/postgres-search";
import { checkRateLimit, searchLimiter } from "@/lib/rate-limit/limiters";
import { ProductGrid } from "@/components/product/product-grid";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.q?.trim() ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-xl">
        {query ? `Search results for "${query}"` : "Search"}
      </h1>

      {query.length < 2 ? (
        <p className="text-[var(--color-text-muted)]">Enter at least 2 characters to search.</p>
      ) : (
        <Suspense fallback={<ProductGridSkeleton count={12} />}>
          <SearchResults query={query} />
        </Suspense>
      )}
    </div>
  );
}

async function SearchResults({ query }: { query: string }) {
  // Search is a public, unauthenticated, DB-hitting endpoint — rate
  // limited per IP per the architecture-review gap ("no rate limiting
  // on search/autocomplete"). A limit hit degrades to the zero-result
  // fallback rather than an error page, since a search page erroring
  // outright is worse UX than momentarily showing best-sellers.
  const ip = (await headers()).get("x-forwarded-for") ?? "unknown";
  const { success } = await checkRateLimit(searchLimiter, ip);

  const results = success ? await searchProducts(query) : [];

  if (results.length === 0) {
    const fallback = await getZeroResultFallback();
    return (
      <div>
        <div className="mb-8 text-center">
          <p className="mb-1 text-lg">No matches found for "{query}"</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Try a broader search, or check the spelling.
          </p>
        </div>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          You might like these
        </h2>
        <ProductGrid products={fallback} />
      </div>
    );
  }

  return <ProductGrid products={results} />;
}
