import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import {
  createVariantSchema,
  updateVariantSchema,
  type CreateVariantInput,
  type UpdateVariantInput,
} from "@/lib/validation/product";

export async function createVariant(input: CreateVariantInput) {
  const session = await requirePermission("products.update");
  const data = createVariantSchema.parse(input);

  const existingSku = await db.productVariant.findUnique({ where: { sku: data.sku } });
  if (existingSku) throw new Error(`SKU "${data.sku}" is already in use`);

  const primaryLocation = await db.inventoryLocation.findFirst({ where: { isPrimary: true } });
  if (!primaryLocation) {
    throw new Error("No primary inventory location configured — run the location seed first");
  }

  const variant = await db.$transaction(async (tx) => {
    const created = await tx.productVariant.create({
      data: {
        productId: data.productId,
        sku: data.sku,
        variantName: data.variantName,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        barcode: data.barcode,
      },
    });

    for (const attr of data.attributes) {
      const attribute = await tx.productAttribute.upsert({
        where: { productId_key: { productId: data.productId, key: attr.key } },
        update: { value: attr.value },
        create: { productId: data.productId, key: attr.key, value: attr.value },
      });
      await tx.productAttributeValue.create({
        data: { variantId: created.id, attributeId: attribute.id },
      });
    }

    await tx.inventory.create({
      data: {
        variantId: created.id,
        locationId: primaryLocation.id,
        availableQuantity: data.initialStock,
      },
    });

    if (data.initialStock > 0) {
      await tx.inventoryTransaction.create({
        data: {
          variantId: created.id,
          locationId: primaryLocation.id,
          type: "RESTOCK",
          quantityChange: data.initialStock,
          reason: "Initial stock on variant creation",
          actorId: session.user.id,
        },
      });
    }

    return created;
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "variant.created",
    resource: `ProductVariant:${variant.id}`,
    after: variant,
  });

  return variant;
}

export async function updateVariant(input: UpdateVariantInput) {
  const session = await requirePermission("products.update");
  const data = updateVariantSchema.parse(input);

  const before = await db.productVariant.findUnique({ where: { id: data.id } });
  if (!before) throw new Error("Variant not found");

  const updated = await db.productVariant.update({
    where: { id: data.id },
    data: {
      variantName: data.variantName,
      price: data.price,
      compareAtPrice: data.compareAtPrice,
      barcode: data.barcode,
      isActive: data.isActive,
    },
  });

  // Price changes are a meaningful enough event to log distinctly, not
  // just bundled into a generic "updated" entry — pricing errors are
  // exactly the kind of thing an admin needs to be able to trace later.
  if (data.price !== undefined && Number(before.price) !== data.price) {
    await recordAuditLog({
      actorId: session.user.id,
      action: "variant.price_changed",
      resource: `ProductVariant:${updated.id}`,
      before: { price: before.price },
      after: { price: updated.price },
    });
  }

  await recordAuditLog({
    actorId: session.user.id,
    action: "variant.updated",
    resource: `ProductVariant:${updated.id}`,
    before,
    after: updated,
  });

  return updated;
}

/**
 * Generates the cartesian product of attribute value sets as draft
 * variants. E.g. { "Case Size": ["38mm","42mm"], "Strap": ["Leather","Steel"] }
 * -> 4 variant shells. Admin still sets price/SKU/stock per generated
 * row before saving — this only produces the combinations, it does not
 * silently create priced, purchasable variants.
 */
export function generateVariantMatrix(
  attributeSets: Record<string, string[]>
): { variantName: string; attributes: { key: string; value: string }[] }[] {
  const entries = Object.entries(attributeSets);
  if (entries.length === 0) return [];

  let combinations: { key: string; value: string }[][] = [[]];

  for (const [key, values] of entries) {
    const next: { key: string; value: string }[][] = [];
    for (const combo of combinations) {
      for (const value of values) {
        next.push([...combo, { key, value }]);
      }
    }
    combinations = next;
  }

  return combinations.map((combo) => ({
    variantName: combo.map((c) => c.value).join(" / "),
    attributes: combo,
  }));
}
