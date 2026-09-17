export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-square rounded-md bg-[var(--color-bg-elevated)]" />
          <div className="mt-2 h-3 w-2/3 rounded bg-[var(--color-bg-elevated)]" />
          <div className="mt-1 h-3 w-1/3 rounded bg-[var(--color-bg-elevated)]" />
        </div>
      ))}
    </div>
  );
}
