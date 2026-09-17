import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";

/**
 * Next.js file-convention loading UI — renders instantly while the
 * page's async work (data fetch) is in flight, before the page's own
 * internal Suspense boundaries even engage. This is what makes
 * navigation feel instant rather than blank-then-populated.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
      <ProductGridSkeleton count={12} />
    </div>
  );
}
