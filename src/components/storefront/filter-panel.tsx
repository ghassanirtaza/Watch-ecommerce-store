"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

/**
 * Plain client component — no GSAP here. Per docs/DESIGN_SYSTEM.md,
 * GSAP is reserved for PDP gallery / hero / cart drawer only. Filter
 * panel interactions use ordinary React state + CSS transitions.
 */
export function FilterPanel({ currentSort }: { currentSort: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page"); // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <aside className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-medium">Sort by</h2>
        <select
          value={currentSort}
          onChange={(e) => updateParam("sort", e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="best_selling">Best Selling</option>
        </select>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium">Price Range</h2>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            min={0}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
            onBlur={(e) => updateParam("minPrice", e.target.value || null)}
          />
          <input
            type="number"
            placeholder="Max"
            min={0}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
            onBlur={(e) => updateParam("maxPrice", e.target.value || null)}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          onChange={(e) => updateParam("inStock", e.target.checked ? "true" : null)}
        />
        In stock only
      </label>

      <button
        onClick={() => router.push(pathname)}
        className="text-sm text-[var(--color-gold)] underline"
      >
        Clear all filters
      </button>
    </aside>
  );
}
