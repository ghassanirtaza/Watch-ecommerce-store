import { db } from "@/lib/db/client";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { releaseReservations } from "@/domain/inventory/reservation";
import { getPaymentProvider } from "@/domain/payments/adapters";

const CANCELLABLE_STATUSES = new Set(["PENDING_PAYMENT", "CONFIRMED", "PROCESSING"]);

/**
 * Customer or admin cancellation before shipment. After SHIPPED, this
 * must go through the returns flow instead (domain/returns) — not this
 * function. Stock is restored via a real InventoryTransaction, not a
 * silent number change.
 */
export async function cancelOrder(orderId: string, reason: string, actorId: string | null) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) throw new Error("Order not found");
  if (!CANCELLABLE_STATUSES.has(order.status)) {
    throw new Error(`Cannot cancel an order in status ${order.status} — use the returns flow instead`);
  }

  const primaryLocation = await db.inventoryLocation.findFirst({ where: { isPrimary: true } });
  if (!primaryLocation) throw new Error("No primary inventory location configured");

  // If stock was already finalized to a sale (order was CONFIRMED),
  // restore it via a real ADJUSTMENT transaction — this is different
  // from releasing a reservation, since the stock already left the
  // reservation pool and became a completed sale.
  if (order.status !== "PENDING_PAYMENT") {
    const items = await db.orderItem.findMany({ where: { orderId: order.id } });
    await db.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventory.update({
          where: { variantId_locationId: { variantId: item.variantId, locationId: primaryLocation.id } },
          data: { availableQuantity: { increment: item.quantity } },
        });
        await tx.inventoryTransaction.create({
          data: {
            variantId: item.variantId,
            locationId: primaryLocation.id,
            type: "ADJUSTMENT",
            quantityChange: item.quantity,
            reason: `Order ${order.orderNumber} cancelled`,
            reference: order.id,
            actorId,
          },
        });
      }
    });
  } else {
    const reservations = await db.inventoryReservation.findMany({
      where: { orderId: order.id, releasedAt: null },
    });
    await releaseReservations({
      reservationIds: reservations.map((r) => r.id),
      locationId: primaryLocation.id,
    });
  }

  // Refund captured payments automatically; COD orders simply never
  // collected anything so there's nothing to refund electronically.
  for (const payment of order.payments) {
    if (payment.status === "CAPTURED" || payment.status === "AUTHORIZED") {
      if (payment.method === "CARD") {
        const provider = getPaymentProvider("CARD");
        try {
          const refund = await provider.refundPayment({
            providerRef: payment.providerRef ?? "",
            amount: Number(payment.amount),
            reason,
          });
          await db.refund.create({
            data: { paymentId: payment.id, amount: payment.amount, reason, providerRef: refund.refundRef, processedById: actorId },
          });
          await db.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
        } catch (err) {
          // Card gateway isn't configured yet (see AI_CONTEXT.md) —
          // record the refund need without pretending it succeeded.
          await recordAuditLog({
            actorId,
            action: "order.refund_failed",
            resource: `Payment:${payment.id}`,
            reason: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } else {
        await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
      }
    }
  }

  const updated = await db.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      statusHistory: { create: { status: "CANCELLED", changedBy: actorId, reason } },
    },
  });

  await recordAuditLog({
    actorId,
    action: "order.cancelled",
    resource: `Order:${order.id}`,
    reason,
  });

  return updated;
}

/**
 * Admin-only order status transitions not covered by the automatic
 * webhook-driven or courier-driven transitions above (e.g. manually
 * marking PACKED). Validates the transition is a sane forward step —
 * does not allow arbitrary jumps (e.g. PENDING_PAYMENT -> DELIVERED).
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
};

export async function transitionOrderStatus(orderId: string, newStatus: string, reason?: string) {
  const session = await requirePermission("orders.update");

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const allowed = VALID_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Cannot move an order from ${order.status} to ${newStatus}`);
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: {
      status: newStatus as never,
      statusHistory: { create: { status: newStatus as never, changedBy: session.user.id, reason } },
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "order.status_changed",
    resource: `Order:${orderId}`,
    before: { status: order.status },
    after: { status: newStatus },
    reason,
  });

  return updated;
}
