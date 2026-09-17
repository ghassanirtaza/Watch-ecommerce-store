import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function OrderConfirmationPage({ params }: PageProps) {
  const { orderNumber } = await params;
  const order = await db.order.findUnique({
    where: { orderNumber },
    include: { items: true, shippingAddress: true, payments: true },
  });

  if (!order) notFound();

  const isPending = order.status === "PENDING_PAYMENT";

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      {isPending ? (
        <div className="mb-6 rounded border border-[var(--color-warning)] p-4 text-sm">
          Your order is awaiting payment confirmation. This page will update once payment completes.
        </div>
      ) : (
        <div className="mb-6 text-center">
          <p className="text-2xl">✓</p>
          <h1 className="text-xl">Order Confirmed</h1>
          <p className="mt-1 text-[var(--color-text-muted)]">Order #{order.orderNumber}</p>
        </div>
      )}

      <div className="rounded border border-[var(--color-border)] p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Order Summary
        </h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between py-2 text-sm">
            <span>
              {item.productNameSnap} ({item.variantNameSnap}) × {item.quantity}
            </span>
            <span>Rs. {(Number(item.unitPriceSnap) * item.quantity).toLocaleString("en-PK")}</span>
          </div>
        ))}
        <div className="mt-3 border-t border-[var(--color-border)] pt-3">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>Rs. {Number(order.subtotal).toLocaleString("en-PK")}</span>
          </div>
          {Number(order.discountTotal) > 0 && (
            <div className="flex justify-between text-sm text-[var(--color-success)]">
              <span>Discount</span>
              <span>-Rs. {Number(order.discountTotal).toLocaleString("en-PK")}</span>
            </div>
          )}
          <div className="mt-1 flex justify-between font-medium">
            <span>Total</span>
            <span>Rs. {Number(order.grandTotal).toLocaleString("en-PK")}</span>
          </div>
        </div>
      </div>

      {order.shippingAddress && (
        <div className="mt-4 rounded border border-[var(--color-border)] p-4 text-sm">
          <h2 className="mb-2 font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Shipping To
          </h2>
          <p>{order.shippingAddress.fullName}</p>
          <p>{order.shippingAddress.addressLine1}</p>
          <p>
            {order.shippingAddress.city}
            {order.shippingAddress.postalCode ? `, ${order.shippingAddress.postalCode}` : ""}
          </p>
          <p>{order.shippingAddress.phone}</p>
        </div>
      )}

      <p className="mt-4 text-sm text-[var(--color-text-muted)]">
        Payment method: {order.payments[0]?.method === "COD" ? "Cash on Delivery" : "Card"}
      </p>

      <div className="mt-6 flex gap-4 text-sm">
        <a href="/" className="text-[var(--color-gold)] underline">
          Continue Shopping
        </a>
        <a href={`/account/orders/${order.orderNumber}`} className="text-[var(--color-gold)] underline">
          Track Order
        </a>
      </div>
    </div>
  );
}
