import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { RequestReturnForm } from "@/components/account/request-return-form";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function AccountOrderDetailPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true, shippingAddress: true, payments: true, returnRequests: true },
  });

  // Ownership check: ownership mismatch and non-existence are both a
  // 404, never a distinguishing error — the order shouldn't be
  // confirmable-to-exist for someone who doesn't own it.
  if (!order || !profile || order.customerId !== profile.id) {
    notFound();
  }

  const hasOpenReturn = order.returnRequests.some((r) => !["REJECTED", "COMPLETED"].includes(r.status));

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl">Order #{order.orderNumber}</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">{order.status}</p>

      <div className="rounded border border-[var(--color-border)] p-4">
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

      {order.shippingAddress && (
        <div className="mt-4 rounded border border-[var(--color-border)] p-4 text-sm">
          <h2 className="mb-2 font-medium uppercase tracking-wide text-[var(--color-text-muted)]">Shipping To</h2>
          <p>{order.shippingAddress.fullName}</p>
          <p>{order.shippingAddress.addressLine1}</p>
          <p>{order.shippingAddress.city}</p>
        </div>
      )}

      {order.status === "DELIVERED" && !hasOpenReturn && (
        <div className="mt-6">
          <RequestReturnForm orderId={order.id} items={order.items.map((i) => ({ id: i.id, name: `${i.productNameSnap} (${i.variantNameSnap})`, quantity: i.quantity }))} />
        </div>
      )}

      {hasOpenReturn && (
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">A return request is already in progress for this order.</p>
      )}
    </div>
  );
}
