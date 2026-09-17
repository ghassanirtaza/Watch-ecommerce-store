import Link from "next/link";
import { db } from "@/lib/db/client";

export default async function AdminOrdersPage() {
  const orders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { customer: { include: { user: true } }, payments: true },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl">Orders</h1>

      <div className="rounded border border-[var(--color-border)]">
        {orders.length === 0 ? (
          <p className="p-4 text-sm text-[var(--color-text-muted)]">No orders yet.</p>
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              href={`/admin/orders/${o.id}`}
              className="flex items-center justify-between border-b border-[var(--color-border)] p-3 text-sm last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
            >
              <div>
                <p>#{o.orderNumber}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {o.customer?.user.email ?? o.guestEmail} · {o.payments[0]?.method ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p>Rs. {Number(o.grandTotal).toLocaleString("en-PK")}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{o.status}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
