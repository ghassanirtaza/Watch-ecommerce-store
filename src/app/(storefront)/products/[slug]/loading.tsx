export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-md bg-[var(--color-bg-elevated)]" />
        <div className="space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
          <div className="h-7 w-3/4 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
          <div className="h-5 w-1/3 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
          <div className="h-12 w-full animate-pulse rounded bg-[var(--color-bg-elevated)]" />
        </div>
      </div>
    </div>
  );
}
