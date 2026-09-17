import { db } from "@/lib/db/client";
import { finalizeReservationsToSale, releaseReservations } from "@/domain/inventory/reservation";
import { getPaymentProvider } from "@/domain/payments/adapters";
import { recordAuditLog } from "@/lib/logging/audit";
import { sendOrderConfirmationEmail } from "@/domain/notifications/email";

/**
 * Called by the payment provider's webhook route handler after
 * signature verification (the adapter's handleWebhook does that part).
 * This function is the idempotent core: duplicate webhook delivery for
 * the same event must be a safe no-op, enforced via the unique
 * constraint on PaymentTransaction.idempotencyKey — NOT by trusting the
 * adapter's own duplicate-detection alone.
 */
export async function confirmCardPayment(params: {
  orderId: string;
  providerRef: string;
  status: "AUTHORIZED" | "CAPTURED" | "FAILED";
  idempotencyKey: string;
  rawResponse: unknown;
}) {
  const order = await db.order.findUnique({ where: { id: params.orderId }, include: { payments: true } });
  if (!order) throw new Error(`Webhook referenced unknown order ${params.orderId}`);

  const payment = order.payments.find((p) => p.providerRef === params.providerRef);
  if (!payment) throw new Error(`Webhook referenced unknown payment ${params.providerRef}`);

  // Idempotency enforced at the DB level — if this transaction was
  // already recorded, the unique constraint rejects the insert and we
  // treat it as a successful no-op rather than reprocessing side
  // effects (stock finalization, order status change) a second time.
  try {
    await db.paymentTransaction.create({
      data: {
        paymentId: payment.id,
        providerTxnId: params.providerRef,
        status: params.status,
        rawResponse: params.rawResponse as object,
        idempotencyKey: params.idempotencyKey,
      },
    });
  } catch (err) {
    // Unique constraint violation on idempotencyKey -> already processed.
    return { alreadyProcessed: true };
  }

  // Order may already be in a terminal state from an earlier delivery
  // of this same webhook race — re-check status before mutating.
  if (order.status !== "PENDING_PAYMENT") {
    return { alreadyProcessed: true };
  }

  const primaryLocation = await db.inventoryLocation.findFirst({ where: { isPrimary: true } });
  if (!primaryLocation) throw new Error("No primary inventory location configured");

  const reservations = await db.inventoryReservation.findMany({
    where: { orderId: order.id, releasedAt: null },
  });

  if (params.status === "FAILED") {
    await releaseReservations({
      reservationIds: reservations.map((r) => r.id),
      locationId: primaryLocation.id,
    });

    await db.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        statusHistory: { create: { status: "CANCELLED", reason: "Payment failed" } },
      },
    });
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });

    await recordAuditLog({
      actorId: null,
      action: "order.payment_failed",
      resource: `Order:${order.id}`,
    });

    return { confirmed: false };
  }

  await finalizeReservationsToSale({
    reservationIds: reservations.map((r) => r.id),
    locationId: primaryLocation.id,
    orderId: order.id,
  });

  await db.order.update({
    where: { id: order.id },
    data: {
      status: "CONFIRMED",
      statusHistory: { create: { status: "CONFIRMED", reason: "Payment confirmed via webhook" } },
    },
  });
  await db.payment.update({ where: { id: payment.id }, data: { status: params.status } });

  // Clear the customer's cart now that payment succeeded — cart is
  // looked up via the order's items' original cart, which we don't
  // directly retain; in practice the checkout route clears the cart
  // cookie/session on redirect-back rather than here. Left as an
  // explicit note rather than silently assumed handled.

  await recordAuditLog({
    actorId: order.customerId,
    action: "order.confirmed_card",
    resource: `Order:${order.id}`,
  });

  await sendOrderConfirmationEmail(order.id);

  return { confirmed: true };
}

/**
 * Reservation TTL safety net for CARD orders that never get a webhook
 * at all (customer abandons the gateway page). The sweep job
 * (reservation.ts) will lazily expire these via normal TTL — this
 * function additionally cancels the stale PENDING_PAYMENT order itself
 * so it doesn't sit forever. Intended to be called from the same
 * scheduled sweep as sweepExpiredReservations.
 */
export async function cancelStalePendingOrders() {
  const staleThreshold = new Date(Date.now() - 30 * 60_000); // 30 min grace beyond the 15-min reservation TTL

  const staleOrders = await db.order.findMany({
    where: { status: "PENDING_PAYMENT", createdAt: { lt: staleThreshold } },
  });

  for (const order of staleOrders) {
    await db.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        statusHistory: { create: { status: "CANCELLED", reason: "Payment never completed (timeout)" } },
      },
    });
  }

  return { cancelled: staleOrders.length };
}
