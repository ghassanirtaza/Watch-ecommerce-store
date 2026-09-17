import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { VALID_TRANSITIONS } from "@/domain/orders/management";
import { OrderActions } from "@/components/admin/order-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: true,
      shippingAddress: true,
      payments: { include: { transactions: true, refunds: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
      customer: { include: { user: true } },
    },
  });

  if (!order) notFound();

  const availableTransitions = VALID_TRANSITIONS[order.status] ?? [];

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl">Order #{order.orderNumber}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {order.customer?.user.email ?? order.guestEmail} · {order.status}
          </p>
        </div>
        <OrderActions orderId={order.id} status={order.status} availableTransitions={availableTransitions} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Items</h2>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-1.5 text-sm">
              <span>
                {item.productNameSnap} ({item.variantNameSnap}) × {item.quantity}
              </span>
              <span>Rs. {(Number(item.unitPriceSnap) * item.quantity).toLocaleString("en-PK")}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-[var(--color-border)] pt-3 font-medium">
            <span>Total</span>
            <span>Rs. {Number(order.grandTotal).toLocaleString("en-PK")}</span>
          </div>
        </div>

        <div className="space-y-6">
          {order.shippingAddress && (
            <div className="rounded border border-[var(--color-border)] p-4 text-sm">
              <h2 className="mb-2 font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Shipping</h2>
              <p>{order.shippingAddress.fullName}</p>
              <p>{order.shippingAddress.addressLine1}</p>
              <p>{order.shippingAddress.city}</p>
              <p>{order.shippingAddress.phone}</p>
            </div>
          )}

          <div className="rounded border border-[var(--color-border)] p-4 text-sm">
            <h2 className="mb-2 font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Payment</h2>
            {order.payments.map((p) => (
              <div key={p.id}>
                <p>
                  {p.method} — {p.status}
                </p>
                {p.refunds.length > 0 && (
                  <p className="text-[var(--color-text-muted)]">
                    Refunded: Rs. {p.refunds.reduce((s, r) => s + Number(r.amount), 0).toLocaleString("en-PK")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded border border-[var(--color-border)] p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">History</h2>
        {order.statusHistory.map((h) => (
          <div key={h.id} className="flex justify-between py-1 text-xs text-[var(--color-text-muted)]">
            <span>
              {h.status} {h.reason ? `— ${h.reason}` : ""}
            </span>
            <span>{h.createdAt.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
