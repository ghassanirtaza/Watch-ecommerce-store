import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";

export default async function AccountOrdersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null; // layout already redirects unauthenticated requests

  const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
  const orders = profile
    ? await db.order.findMany({
        where: { customerId: profile.id },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      })
    : [];

  return (
    <div>
      <h1 className="mb-6 text-xl">Orders</h1>

      {orders.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">You haven't placed any orders yet.</p>
          <Link href="/shop" className="text-sm text-[var(--color-gold)] underline">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="rounded border border-[var(--color-border)]">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${order.orderNumber}`}
              className="flex items-center justify-between border-b border-[var(--color-border)] p-4 text-sm last:border-b-0 hover:bg-[var(--color-bg-elevated)]"
            >
              <div>
                <p>#{order.orderNumber}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {order.items.length} item(s) · {order.createdAt.toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p>Rs. {Number(order.grandTotal).toLocaleString("en-PK")}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{order.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
