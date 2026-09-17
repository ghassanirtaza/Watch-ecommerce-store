import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";

const auditLogFilterSchema = z.object({
  actorId: z.string().cuid().optional(),
  resource: z.string().optional(), // supports prefix match, e.g. "Order:" for all order events
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(50),
});

/**
 * Only SUPER_ADMIN and roles with explicit audit visibility should
 * reach this in the UI — using "settings.read" as the gate since audit
 * visibility is a system-level concern, not a per-domain one. Revisit
 * if a dedicated "audit.read" permission proves necessary once the
 * admin UI defines exactly who should see this.
 */
export async function getAuditLogs(rawFilter: unknown) {
  await requirePermission("settings.read");
  const filter = auditLogFilterSchema.parse(rawFilter);

  const where = {
    actorId: filter.actorId,
    resource: filter.resource ? { startsWith: filter.resource } : undefined,
    action: filter.action,
    createdAt:
      filter.from || filter.to
        ? { gte: filter.from, lte: filter.to }
        : undefined,
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { actor: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      id: log.id,
      actorEmail: log.actor?.email ?? "System",
      action: log.action,
      resource: log.resource,
      reason: log.reason,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt,
    })),
    total,
    page: filter.page,
    pageSize: filter.pageSize,
  };
}

/**
 * Convenience view for "what happened to this specific thing" —
 * e.g. an order or product detail page's activity tab.
 */
export async function getAuditLogForResource(resource: string) {
  await requirePermission("settings.read");
  return db.auditLog.findMany({
    where: { resource },
    include: { actor: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
  });
}
