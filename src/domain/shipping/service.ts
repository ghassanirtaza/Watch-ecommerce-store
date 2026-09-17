import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { sendShipmentUpdateEmail } from "@/domain/notifications/email";
import { getSetting } from "@/domain/settings/service";
import type { CourierProvider } from "./provider";

/**
 * PLACEHOLDER — no courier has been selected yet (see AI_CONTEXT.md
 * open decision: TCS / Leopards / PostEx / M&P). Same pattern as the
 * card payment provider: the rest of the fulfillment flow is built and
 * testable against the CourierProvider interface now, without blocking
 * on that external decision.
 */
class UnimplementedCourierProvider implements CourierProvider {
  async createShipment(): Promise<never> {
    throw new Error("No courier is configured yet — see docs/AI_CONTEXT.md open decisions");
  }
  async voidShipment(): Promise<void> {
    throw new Error("No courier is configured yet");
  }
  async handleWebhook(): Promise<never> {
    throw new Error("No courier is configured yet");
  }
}

function getCourierProvider(): CourierProvider {
  return new UnimplementedCourierProvider();
}

/**
 * Called by admin fulfillment action (order management, Phase 6) once
 * an order is CONFIRMED/PROCESSING and ready to ship. Not auto-called
 * from checkout — admin decides when packing/label creation happens.
 */
export async function createShipmentForOrder(orderId: string) {
  const session = await requirePermission("orders.update");

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { shippingAddress: true, payments: true },
  });
  if (!order) throw new Error("Order not found");
  if (!order.shippingAddress) throw new Error("Order has no shipping address");
  if (order.status !== "CONFIRMED" && order.status !== "PROCESSING") {
    throw new Error(`Cannot create a shipment for an order in status ${order.status}`);
  }

  const isCod = order.payments.some((p) => p.method === "COD");
  const provider = getCourierProvider();

  const result = await provider.createShipment({
    orderId: order.id,
    isCod,
    codAmount: isCod ? Number(order.grandTotal) : undefined,
    shippingAddress: {
      fullName: order.shippingAddress.fullName,
      phone: order.shippingAddress.phone,
      addressLine1: order.shippingAddress.addressLine1,
      addressLine2: order.shippingAddress.addressLine2 ?? undefined,
      city: order.shippingAddress.city,
      postalCode: order.shippingAddress.postalCode ?? undefined,
    },
  });

  const shipment = await db.shipment.create({
    data: {
      orderId: order.id,
      waybillNumber: result.waybillNumber,
      trackingUrl: result.trackingUrl,
      status: "LABEL_CREATED",
      isCod,
      codAmount: isCod ? order.grandTotal : undefined,
      statusEvents: { create: { status: "LABEL_CREATED" } },
    },
  });

  await db.order.update({
    where: { id: order.id },
    data: {
      status: "PROCESSING",
      statusHistory: { create: { status: "PROCESSING", changedBy: session.user.id, reason: "Shipping label created" } },
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "shipment.created",
    resource: `Shipment:${shipment.id}`,
    after: { waybillNumber: shipment.waybillNumber },
  });

  return shipment;
}

/**
 * Courier webhook handler — mirrors the payment webhook idempotency
 * pattern via ShipmentStatusEvent, though couriers don't typically
 * provide idempotency keys the way payment gateways do, so dedup here
 * is best-effort (same status + same waybill within a short window is
 * treated as a duplicate at the caller's discretion, not enforced by a
 * unique constraint the way PaymentTransaction is).
 */
export async function handleCourierStatusUpdate(params: {
  waybillNumber: string;
  status:
    | "PICKED_UP"
    | "IN_TRANSIT"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "FAILED_DELIVERY"
    | "RETURNED_TO_ORIGIN";
  codRemittedAmount?: number;
  rawPayload: unknown;
}) {
  const shipment = await db.shipment.findUnique({ where: { waybillNumber: params.waybillNumber } });
  if (!shipment) throw new Error(`Unknown waybill ${params.waybillNumber}`);

  await db.shipmentStatusEvent.create({
    data: { shipmentId: shipment.id, status: params.status, rawPayload: params.rawPayload as object },
  });

  const updateData: Parameters<typeof db.shipment.update>[0]["data"] = { status: params.status };
  if (params.codRemittedAmount !== undefined) {
    updateData.codRemittedAt = new Date();
    updateData.codRemittedAmount = params.codRemittedAmount;
  }

  await db.shipment.update({ where: { id: shipment.id }, data: updateData });

  const orderStatusMap: Record<string, string> = {
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",
  };
  const mappedOrderStatus = orderStatusMap[params.status];
  if (mappedOrderStatus) {
    await db.order.update({
      where: { id: shipment.orderId },
      data: {
        status: mappedOrderStatus as "OUT_FOR_DELIVERY" | "DELIVERED",
        statusHistory: { create: { status: mappedOrderStatus as "OUT_FOR_DELIVERY" | "DELIVERED", reason: `Courier status: ${params.status}` } },
      },
    });
    await sendShipmentUpdateEmail(shipment.orderId, mappedOrderStatus);
  }

  // Failed delivery / RTO feeds back into the COD risk model per
  // AI_CONTEXT.md — this is the wiring that was flagged as missing in
  // architecture review (COD remittance/RTO reconciliation).
  if (params.status === "FAILED_DELIVERY" || params.status === "RETURNED_TO_ORIGIN") {
    await incrementCodFailureCount(shipment.orderId);
  }
}

async function incrementCodFailureCount(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order?.customerId) return; // guest order — no standing risk profile to update

  const flag = await db.customerCodRiskFlag.upsert({
    where: { customerId: order.customerId },
    update: { failedDeliveryCount: { increment: 1 } },
    create: { customerId: order.customerId, failedDeliveryCount: 1, totalCodOrders: 1 },
  });

  const threshold = await getSetting("cod_failed_delivery_block_threshold");
  if (flag.failedDeliveryCount >= threshold && !flag.isBlocked) {
    await db.customerCodRiskFlag.update({
      where: { customerId: order.customerId },
      data: { isBlocked: true, blockedReason: `${threshold}+ failed COD deliveries` },
    });
  }
}
