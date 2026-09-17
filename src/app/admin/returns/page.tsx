import Link from "next/link";
import { db } from "@/lib/db/client";

export default async function AdminReturnsPage() {
  const returns = await db.returnRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: true, customer: { include: { user: true } } },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl">Returns</h1>
      <div className="rounded border border-[var(--color-border)]">
        {returns.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No return requests.</p>
        ) : (
          returns.map((r) => (
            <Link
              key={r.id}
              href={`/admin/returns/${r.id}`}
              className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
            >
              <div>
                <p>
                  Order #{r.order.orderNumber} — {r.customer?.user.email ?? "—"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{r.reason}</p>
              </div>
              <span className="text-[var(--color-text-muted)]">{r.status}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
