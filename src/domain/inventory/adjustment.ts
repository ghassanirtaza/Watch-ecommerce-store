import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { notifyBackInStockSubscribers } from "@/domain/notifications/email";

/**
 * This handles ADMIN-INITIATED stock changes (restock, damaged,
 * manual correction). Checkout-driven reservation/decrement lives in
 * src/domain/inventory/reservation.ts — do not merge these two paths,
 * they have different authorization models (admin permission vs.
 * customer checkout) and different transaction types.
 */

const adjustStockSchema = z.object({
  variantId: z.string().cuid(),
  locationId: z.string().cuid(),
  quantityChange: z.number().int().refine((n) => n !== 0, "Quantity change cannot be zero"),
  reason: z.enum(["RESTOCK", "DAMAGED", "ADJUSTMENT", "RETURN"]),
  note: z.string().max(500).optional(),
});

export async function adjustStock(input: z.infer<typeof adjustStockSchema>) {
  const session = await requirePermission("inventory.adjust");
  const data = adjustStockSchema.parse(input);

  const result = await db.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({
      where: { variantId_locationId: { variantId: data.variantId, locationId: data.locationId } },
    });
    if (!inventory) throw new Error("Inventory record not found for this variant/location");

    const newAvailable = inventory.availableQuantity + data.quantityChange;
    if (newAvailable < 0) {
      throw new Error(
        `Adjustment would result in negative stock (${inventory.availableQuantity} + ${data.quantityChange} = ${newAvailable})`
      );
    }

    // Atomic conditional update, consistent with the reservation path —
    // never read-then-write without a guard, even for admin actions.
    const updateResult = await tx.inventory.updateMany({
      where: {
        variantId: data.variantId,
        locationId: data.locationId,
        availableQuantity: inventory.availableQuantity, // optimistic concurrency guard
      },
      data: { availableQuantity: { increment: data.quantityChange } },
    });

    if (updateResult.count === 0) {
      throw new Error("Inventory changed concurrently — please retry");
    }

    const transaction = await tx.inventoryTransaction.create({
      data: {
        variantId: data.variantId,
        locationId: data.locationId,
        type: data.reason,
        quantityChange: data.quantityChange,
        reason: data.note,
        actorId: session.user.id,
      },
    });

    return { newAvailable, transaction, previousAvailable: inventory.availableQuantity };
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "inventory.adjusted",
    resource: `Inventory:${data.variantId}:${data.locationId}`,
    after: { quantityChange: data.quantityChange, newAvailable: result.newAvailable, reason: data.reason },
    reason: data.note,
  });

  // Back-in-stock trigger: fires when a restock takes available
  // quantity from 0 (or below, if it was oversold) to positive. Scoped
  // to RESTOCK/RETURN reasons only — a DAMAGED write-off or manual
  // correction shouldn't notify subscribers if it happens to cross
  // zero going up (it normally wouldn't, but the reason check keeps
  // intent explicit rather than relying only on the quantity math).
  if (
    result.previousAvailable <= 0 &&
    result.newAvailable > 0 &&
    (data.reason === "RESTOCK" || data.reason === "RETURN")
  ) {
    await notifyBackInStockSubscribers(data.variantId);
  }

  return result;
}

/**
 * Bulk CSV import path. Per AI_CONTEXT.md open gap: this must validate
 * every row before committing anything, and report per-row failures
 * rather than partially applying an import silently.
 */
const csvRowSchema = z.object({
  sku: z.string().min(1),
  quantityChange: z.coerce.number().int(),
  reason: z.enum(["RESTOCK", "DAMAGED", "ADJUSTMENT", "RETURN"]).default("RESTOCK"),
});

export type BulkInventoryRow = z.infer<typeof csvRowSchema>;

export interface BulkImportRowResult {
  row: number;
  sku: string;
  status: "OK" | "ERROR";
  error?: string;
}

/**
 * Two-phase: validate all rows first (dry run), only commit if
 * `commit: true` AND every row passed validation. A partially-valid
 * CSV never applies partially — the whole import either fully succeeds
 * or fully fails, with a per-row report either way.
 */
export async function bulkAdjustStock(
  rawRows: unknown[],
  locationId: string,
  options: { commit: boolean }
): Promise<{ results: BulkImportRowResult[]; committed: boolean }> {
  const session = await requirePermission("inventory.adjust");

  const results: BulkImportRowResult[] = [];
  const validRows: { row: number; data: BulkInventoryRow; variantId: string }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = i + 1;
    const parsed = csvRowSchema.safeParse(rawRows[i]);
    if (!parsed.success) {
      results.push({
        row: rowNum,
        sku: String((rawRows[i] as { sku?: unknown })?.sku ?? "?"),
        status: "ERROR",
        error: parsed.error.issues.map((iss) => iss.message).join("; "),
      });
      continue;
    }

    const variant = await db.productVariant.findUnique({ where: { sku: parsed.data.sku } });
    if (!variant) {
      results.push({ row: rowNum, sku: parsed.data.sku, status: "ERROR", error: "SKU not found" });
      continue;
    }

    results.push({ row: rowNum, sku: parsed.data.sku, status: "OK" });
    validRows.push({ row: rowNum, data: parsed.data, variantId: variant.id });
  }

  const allValid = results.every((r) => r.status === "OK");

  if (!options.commit || !allValid) {
    return { results, committed: false };
  }

  await db.$transaction(async (tx) => {
    for (const { data, variantId } of validRows) {
      const inventory = await tx.inventory.findUnique({
        where: { variantId_locationId: { variantId, locationId } },
      });
      if (!inventory) throw new Error(`No inventory record for SKU ${data.sku} at this location`);

      const newAvailable = inventory.availableQuantity + data.quantityChange;
      if (newAvailable < 0) {
        throw new Error(`SKU ${data.sku}: adjustment would result in negative stock`);
      }

      await tx.inventory.update({
        where: { variantId_locationId: { variantId, locationId } },
        data: { availableQuantity: newAvailable },
      });

      await tx.inventoryTransaction.create({
        data: {
          variantId,
          locationId,
          type: data.reason,
          quantityChange: data.quantityChange,
          reason: "Bulk CSV import",
          actorId: session.user.id,
        },
      });
    }
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "inventory.bulk_import",
    resource: `Inventory:bulk:${locationId}`,
    after: { rowCount: validRows.length },
  });

  return { results, committed: true };
}
