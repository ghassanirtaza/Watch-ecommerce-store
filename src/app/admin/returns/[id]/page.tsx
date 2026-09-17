import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { ReturnActions } from "@/components/admin/return-actions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminReturnDetailPage({ params }: PageProps) {
  const { id } = await params;
  const returnRequest = await db.returnRequest.findUnique({
    where: { id },
    include: {
      order: true,
      customer: { include: { user: true } },
      items: { include: { orderItem: { include: { serializedUnits: true } } } },
    },
  });

  if (!returnRequest) notFound();

  const hasSerializedItems = returnRequest.items.some((i) => i.orderItem.serializedUnits.length > 0);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-xl">Return Request</h1>
      <p className="mb-6 text-sm text-[var(--color-text-muted)]">
        Order #{returnRequest.order.orderNumber} — {returnRequest.customer?.user.email ?? "—"}
      </p>

      <div className="mb-6 rounded border border-[var(--color-border)] p-4 text-sm">
        <p className="mb-2">
          <span className="text-[var(--color-text-muted)]">Status:</span> {returnRequest.status}
        </p>
        <p className="mb-2">
          <span className="text-[var(--color-text-muted)]">Reason:</span> {returnRequest.reason}
        </p>
        {returnRequest.adminNotes && (
          <p className="mb-2">
            <span className="text-[var(--color-text-muted)]">Notes:</span> {returnRequest.adminNotes}
          </p>
        )}
        {returnRequest.inspectionPassed !== null && (
          <p>
            <span className="text-[var(--color-text-muted)]">Inspection:</span>{" "}
            <span className={returnRequest.inspectionPassed ? "text-[var(--color-success)]" : "text-[var(--color-error)]"}>
              {returnRequest.inspectionPassed ? "Passed" : "Failed"}
            </span>
          </p>
        )}
      </div>

      <div className="mb-6 rounded border border-[var(--color-border)] p-4">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Items
        </h2>
        {returnRequest.items.map((item) => (
          <div key={item.id} className="border-b border-[var(--color-border)] py-2 text-sm last:border-b-0">
            <p>
              {item.orderItem.productNameSnap} ({item.orderItem.variantNameSnap}) × {item.quantity}
            </p>
            {item.orderItem.serializedUnits.length > 0 && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Sold serial(s): {item.orderItem.serializedUnits.map((s) => s.serialNumber).join(", ")}
                {item.returnedSerialNumber && ` — returned: ${item.returnedSerialNumber}`}
              </p>
            )}
          </div>
        ))}
      </div>

      <ReturnActions
        returnId={returnRequest.id}
        status={returnRequest.status}
        inspectionPassed={returnRequest.inspectionPassed}
        hasSerializedItems={hasSerializedItems}
        itemIds={returnRequest.items.map((i) => ({ orderItemId: i.orderItemId, label: i.orderItem.productNameSnap }))}
        orderTotal={Number(returnRequest.order.grandTotal)}
      />
    </div>
  );
}
