import Link from "next/link";
import { db } from "@/lib/db/client";

export default async function AdminProductsPage() {
  const products = await db.product.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { variants: { select: { id: true, price: true } } },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl">Products</h1>
        <Link href="/admin/products/new" className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)]">
          + New Product
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No products yet.</p>
      ) : (
        <div className="rounded border border-[var(--color-border)]">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/admin/products/${p.id}`}
              className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
            >
              <span>{p.name}</span>
              <div className="flex items-center gap-4 text-[var(--color-text-muted)]">
                <span>{p.variants.length} variant(s)</span>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "text-[var(--color-success)]",
    DRAFT: "text-[var(--color-text-muted)]",
    SCHEDULED: "text-[var(--color-warning)]",
    ARCHIVED: "text-[var(--color-error)]",
  };
  return <span className={colors[status] ?? ""}>{status}</span>;
}
