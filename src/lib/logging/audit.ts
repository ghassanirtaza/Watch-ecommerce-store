import { db } from "@/lib/db/client";

/**
 * Every product/inventory/order/content mutation from an admin action
 * must call this. Per AI_CONTEXT.md: audit logs record actor, action,
 * resource, before/after where appropriate, reason, timestamp — never
 * log passwords, raw card data, or secrets.
 */
export async function recordAuditLog(params: {
  actorId: string | null;
  action: string; // e.g. "product.price_changed"
  resource: string; // e.g. "Product:cku123"
  before?: unknown;
  after?: unknown;
  reason?: string;
}) {
  await db.auditLog.create({
    data: {
      actorId: params.actorId,
      action: params.action,
      resource: params.resource,
      before: params.before === undefined ? undefined : (params.before as object),
      after: params.after === undefined ? undefined : (params.after as object),
      reason: params.reason,
    },
  });
}
