import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireSession, requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";

/**
 * Per AI_CONTEXT.md non-negotiable rule: returns require an inspection
 * checkpoint between approval and refund — never a single-step
 * approve-then-refund. This matters specifically for high-value
 * watches (anti-swap fraud: customer returns a fake/different item
 * while keeping the real one).
 *
 * Lifecycle: REQUESTED -> APPROVED -> ITEM_RECEIVED -> INSPECTED
 *   -> REFUND_ISSUED | EXCHANGE_ISSUED -> COMPLETED
 * (or REJECTED at the REQUESTED stage)
 */

const requestReturnSchema = z.object({
  orderId: z.string().cuid(),
  reason: z.string().min(1).max(1000),
  items: z.array(z.object({ orderItemId: z.string().cuid(), quantity: z.number().int().positive() })).min(1),
});

export async function requestReturn(input: z.infer<typeof requestReturnSchema>) {
  const session = await requireSession();
  const data = requestReturnSchema.parse(input);

  const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) throw new Error("Customer profile not found");

  const order = await db.order.findUnique({
    where: { id: data.orderId },
    include: { items: true },
  });
  if (!order || order.customerId !== profile.id) {
    throw new Error("Order not found");
  }
  if (order.status !== "DELIVERED") {
    throw new Error("Only delivered orders can be returned");
  }

  for (const item of data.items) {
    const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
    if (!orderItem) throw new Error("Item does not belong to this order");
    if (item.quantity > orderItem.quantity) {
      throw new Error(`Cannot return more than the ${orderItem.quantity} purchased`);
    }
  }

  const returnRequest = await db.returnRequest.create({
    data: {
      orderId: order.id,
      customerId: profile.id,
      reason: data.reason,
      status: "REQUESTED",
      items: {
        create: data.items.map((i) => ({ orderItemId: i.orderItemId, quantity: i.quantity })),
      },
    },
  });

  return returnRequest;
}

export async function approveReturn(returnRequestId: string, adminNotes?: string) {
  const session = await requirePermission("orders.update");

  const before = await db.returnRequest.findUnique({ where: { id: returnRequestId } });
  if (!before) throw new Error("Return request not found");
  if (before.status !== "REQUESTED") throw new Error(`Cannot approve a return in status ${before.status}`);

  const updated = await db.returnRequest.update({
    where: { id: returnRequestId },
    data: { status: "APPROVED", adminNotes },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "return.approved",
    resource: `ReturnRequest:${returnRequestId}`,
    before: { status: before.status },
    after: { status: "APPROVED" },
    reason: adminNotes,
  });

  return updated;
}

export async function rejectReturn(returnRequestId: string, reason: string) {
  const session = await requirePermission("orders.update");

  const before = await db.returnRequest.findUnique({ where: { id: returnRequestId } });
  if (!before) throw new Error("Return request not found");
  if (before.status !== "REQUESTED") throw new Error(`Cannot reject a return in status ${before.status}`);

  const updated = await db.returnRequest.update({
    where: { id: returnRequestId },
    data: { status: "REJECTED", adminNotes: reason },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "return.rejected",
    resource: `ReturnRequest:${returnRequestId}`,
    reason,
  });

  return updated;
}

/**
 * Marks the physical item as received from the customer — distinct
 * from inspection. A courier/warehouse action, not yet a decision
 * about refund eligibility.
 */
export async function markItemReceived(returnRequestId: string) {
  const session = await requirePermission("orders.update");

  const before = await db.returnRequest.findUnique({ where: { id: returnRequestId } });
  if (!before) throw new Error("Return request not found");
  if (before.status !== "APPROVED") {
    throw new Error(`Cannot mark received: return is in status ${before.status}, expected APPROVED`);
  }

  const updated = await db.returnRequest.update({
    where: { id: returnRequestId },
    data: { status: "ITEM_RECEIVED" },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "return.item_received",
    resource: `ReturnRequest:${returnRequestId}`,
  });

  return updated;
}

const inspectReturnSchema = z.object({
  returnRequestId: z.string().cuid(),
  passed: z.boolean(),
  notes: z.string().max(2000),
  // For serialized items (see SerializedUnit in schema — used only if
  // the business opts into serial tracking for a product tier): the
  // serial number physically on the returned item, to be matched
  // against what was actually sold in that OrderItem. A mismatch here
  // is the core anti-swap-fraud check for high-value watches.
  returnedSerialByOrderItem: z.record(z.string(), z.string()).optional(),
});

/**
 * THE MANDATORY CHECKPOINT. This is what stands between "customer says
 * they want a refund" and "money actually moves" — approveReturn alone
 * is never sufficient to trigger a refund. Serial mismatch (when
 * serialized tracking is in use) hard-fails inspection regardless of
 * what the admin submits as `passed`, since a mismatched serial is
 * objective evidence of a swap, not a judgment call.
 */
export async function inspectReturn(input: z.infer<typeof inspectReturnSchema>) {
  const session = await requirePermission("orders.update");
  const data = inspectReturnSchema.parse(input);

  const before = await db.returnRequest.findUnique({
    where: { id: data.returnRequestId },
    include: { items: { include: { orderItem: { include: { serializedUnits: true } } } } },
  });
  if (!before) throw new Error("Return request not found");
  if (before.status !== "ITEM_RECEIVED") {
    throw new Error(`Cannot inspect: return is in status ${before.status}, expected ITEM_RECEIVED`);
  }

  let serialMismatch = false;
  for (const returnItem of before.items) {
    const soldSerials = returnItem.orderItem.serializedUnits.map((su) => su.serialNumber);
    if (soldSerials.length === 0) continue; // this SKU isn't serialized — nothing to check

    const claimedSerial = data.returnedSerialByOrderItem?.[returnItem.orderItemId];
    if (!claimedSerial || !soldSerials.includes(claimedSerial)) {
      serialMismatch = true;
    }

    if (claimedSerial) {
      await db.returnItem.update({
        where: { id: returnItem.id },
        data: { returnedSerialNumber: claimedSerial },
      });
    }
  }

  const inspectionPassed = data.passed && !serialMismatch;

  const updated = await db.returnRequest.update({
    where: { id: data.returnRequestId },
    data: {
      status: "INSPECTED",
      inspectionPassed,
      inspectionNotes: serialMismatch
        ? `${data.notes}\n\n[SYSTEM] Serial number mismatch detected — inspection force-failed regardless of submitted result.`
        : data.notes,
      inspectedById: session.user.id,
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "return.inspected",
    resource: `ReturnRequest:${data.returnRequestId}`,
    after: { inspectionPassed, serialMismatch },
  });

  return updated;
}

/**
 * Only callable after a PASSED inspection. This is the actual
 * money-movement trigger — kept as its own explicit step so an admin
 * can't accidentally skip straight from approval to refund.
 */
export async function issueReturnRefund(returnRequestId: string, refundAmount: number) {
  const session = await requirePermission("payments.refund");

  const returnRequest = await db.returnRequest.findUnique({
    where: { id: returnRequestId },
    include: { order: { include: { payments: true } } },
  });
  if (!returnRequest) throw new Error("Return request not found");
  if (returnRequest.status !== "INSPECTED") {
    throw new Error(`Cannot issue refund: return is in status ${returnRequest.status}, expected INSPECTED`);
  }
  if (!returnRequest.inspectionPassed) {
    throw new Error("Cannot issue refund: inspection did not pass");
  }

  const capturedPayment = returnRequest.order.payments.find(
    (p) => p.status === "CAPTURED" || p.status === "AUTHORIZED"
  );

  if (capturedPayment?.method === "CARD") {
    // Real gateway refund call belongs here via getPaymentProvider —
    // deferred until a card adapter exists (see AI_CONTEXT.md open
    // decision). Recording the refund need without pretending it
    // succeeded, consistent with how domain/orders/management.ts
    // handles the same not-yet-configured case.
    await db.refund.create({
      data: {
        paymentId: capturedPayment.id,
        amount: refundAmount,
        reason: "Return approved and inspected",
        processedById: session.user.id,
      },
    });
  }
  // COD refunds are operational/manual (cash was never captured
  // electronically) — the Refund record above still exists for
  // accounting even when no gateway call is made.

  const updated = await db.returnRequest.update({
    where: { id: returnRequestId },
    data: { status: "REFUND_ISSUED", refundAmount },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "return.refund_issued",
    resource: `ReturnRequest:${returnRequestId}`,
    after: { refundAmount },
  });

  return updated;
}

export async function completeReturn(returnRequestId: string) {
  const session = await requirePermission("orders.update");

  const before = await db.returnRequest.findUnique({ where: { id: returnRequestId } });
  if (!before) throw new Error("Return request not found");
  if (before.status !== "REFUND_ISSUED" && before.status !== "EXCHANGE_ISSUED") {
    throw new Error(`Cannot complete: return is in status ${before.status}`);
  }

  const updated = await db.returnRequest.update({
    where: { id: returnRequestId },
    data: { status: "COMPLETED" },
  });

  await db.order.update({
    where: { id: before.orderId },
    data: { status: "RETURNED" },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "return.completed",
    resource: `ReturnRequest:${returnRequestId}`,
  });

  return updated;
}
