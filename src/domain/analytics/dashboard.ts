import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";

/**
 * Per architecture review: computing dashboard metrics live against
 * the transactional order table on every page load degrades at scale.
 * This file is written as a clean read layer NOW so a caching/
 * materialization layer can be dropped in later (e.g. wrap these in
 * Next.js `unstable_cache` with a revalidate interval, or move to a
 * scheduled aggregation table) without changing every call site.
 * Flagged rather than solved — MVP traffic doesn't yet justify the
 * added complexity of a real materialized-view pipeline.
 */

function dateRangeFromFilter(filter: "today" | "yesterday" | "7d" | "30d" | { from: Date; to: Date }) {
  const now = new Date();
  if (typeof filter === "object") return filter;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (filter) {
    case "today":
      return { from: startOfToday, to: now };
    case "yesterday": {
      const yStart = new Date(startOfToday);
      yStart.setDate(yStart.getDate() - 1);
      return { from: yStart, to: startOfToday };
    }
    case "7d": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 7);
      return { from, to: now };
    }
    case "30d": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 30);
      return { from, to: now };
    }
  }
}

export async function getDashboardSummary(filter: "today" | "yesterday" | "7d" | "30d" | { from: Date; to: Date }) {
  await requirePermission("orders.read");
  const range = dateRangeFromFilter(filter);

  const [orders, revenue, statusCounts, lowStock, outOfStock] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),

    db.order.aggregate({
      where: {
        createdAt: { gte: range.from, lte: range.to },
        status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] },
      },
      _sum: { grandTotal: true },
    }),

    db.order.groupBy({
      by: ["status"],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: true,
    }),

    db.inventory.count({
      where: { availableQuantity: { gt: 0 }, /* below threshold handled below via raw comparison */ },
    }),

    db.inventory.count({ where: { availableQuantity: 0 } }),
  ]);

  // lowStock needs a per-row threshold comparison Prisma's `count`
  // can't express directly (comparing two columns) — fetched and
  // filtered in application code. Acceptable at MVP catalog size;
  // revisit with a raw query or computed column if catalog grows
  // large enough for this to matter.
  const lowStockRows = await db.inventory.findMany({
    where: { availableQuantity: { gt: 0 } },
    select: { availableQuantity: true, lowStockThreshold: true },
  });
  const lowStockCount = lowStockRows.filter((r) => r.availableQuantity <= r.lowStockThreshold).length;

  return {
    orderCount: orders,
    revenue: Number(revenue._sum.grandTotal ?? 0),
    ordersByStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
    lowStockCount,
    outOfStockCount: outOfStock,
    range,
  };
}

export async function getTopProducts(filter: "7d" | "30d", limit = 10) {
  await requirePermission("orders.read");
  const range = dateRangeFromFilter(filter);

  const results = await db.orderItem.groupBy({
    by: ["skuSnap", "productNameSnap"],
    where: { order: { createdAt: { gte: range.from, lte: range.to }, status: { notIn: ["CANCELLED"] } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });

  return results.map((r) => ({
    sku: r.skuSnap,
    productName: r.productNameSnap,
    unitsSold: r._sum.quantity ?? 0,
  }));
}

export async function getRecentOrders(limit = 20) {
  await requirePermission("orders.read");
  return db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, orderNumber: true, status: true, grandTotal: true, createdAt: true, guestEmail: true, customer: { select: { user: { select: { email: true } } } } },
  });
}

/**
 * Sales chart data — daily bucketed totals for the selected range.
 * Grouped in application code rather than a raw SQL date_trunc query,
 * consistent with the low-stock tradeoff above: simplest thing that
 * works at MVP volume, flagged for revisit rather than silently
 * assumed to scale forever.
 */
export async function getSalesChartData(filter: "7d" | "30d") {
  await requirePermission("orders.read");
  const range = dateRangeFromFilter(filter);

  const orders = await db.order.findMany({
    where: { createdAt: { gte: range.from, lte: range.to }, status: { notIn: ["CANCELLED", "PENDING_PAYMENT"] } },
    select: { createdAt: true, grandTotal: true },
  });

  const buckets = new Map<string, number>();
  for (const order of orders) {
    const key = order.createdAt.toISOString().slice(0, 10);
    buckets.set(key, (buckets.get(key) ?? 0) + Number(order.grandTotal));
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));
}
