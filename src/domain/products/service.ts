import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { sanitizeRichText } from "@/lib/validation/sanitize";
import {
  createProductSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "@/lib/validation/product";

/**
 * Domain service principle (AI_CONTEXT.md): UI calls this, this
 * validates business rules and calls db directly. Do not put this logic
 * inside a React component or a route handler body.
 */

export async function createProduct(input: CreateProductInput) {
  const session = await requirePermission("products.create");
  const data = createProductSchema.parse(input);

  const existingSlug = await db.product.findUnique({ where: { slug: data.slug } });
  if (existingSlug) {
    throw new Error(`Slug "${data.slug}" is already in use`);
  }

  const product = await db.product.create({
    data: {
      name: data.name,
      slug: data.slug,
      brand: data.brand,
      shortDescription: data.shortDescription,
      longDescription: data.longDescription ? sanitizeRichText(data.longDescription) : undefined,
      status: "DRAFT",
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      movementType: data.movementType,
      caseMaterial: data.caseMaterial,
      caseDiameterMm: data.caseDiameterMm,
      waterResistanceM: data.waterResistanceM,
      warrantyMonths: data.warrantyMonths,
      hasAuthCertificate: data.hasAuthCertificate ?? false,
      boxAndPapers: data.boxAndPapers ?? false,
      categories: {
        create: data.categoryIds.map((categoryId) => ({ categoryId })),
      },
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "product.created",
    resource: `Product:${product.id}`,
    after: product,
  });

  return product;
}

export async function updateProduct(input: UpdateProductInput) {
  const session = await requirePermission("products.update");
  const data = updateProductSchema.parse(input);

  const before = await db.product.findUnique({ where: { id: data.id } });
  if (!before) throw new Error("Product not found");

  // Slug change requires an automatic redirect — non-negotiable per
  // AI_CONTEXT.md / SEO requirements. Not something an admin can opt
  // out of, because a dead product URL is a silent SEO/UX regression.
  if (data.slug && data.slug !== before.slug) {
    const clashing = await db.product.findUnique({ where: { slug: data.slug } });
    if (clashing) throw new Error(`Slug "${data.slug}" is already in use`);
  }

  const updated = await db.$transaction(async (tx) => {
    const product = await tx.product.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug: data.slug,
        brand: data.brand,
        shortDescription: data.shortDescription,
        longDescription: data.longDescription ? sanitizeRichText(data.longDescription) : undefined,
        seoTitle: data.seoTitle,
        seoDescription: data.seoDescription,
        movementType: data.movementType,
        caseMaterial: data.caseMaterial,
        caseDiameterMm: data.caseDiameterMm,
        waterResistanceM: data.waterResistanceM,
        warrantyMonths: data.warrantyMonths,
        hasAuthCertificate: data.hasAuthCertificate,
        boxAndPapers: data.boxAndPapers,
      },
    });

    if (data.slug && data.slug !== before.slug) {
      await tx.redirect.create({
        data: { fromPath: `/products/${before.slug}`, toPath: `/products/${data.slug}`, productId: product.id },
      });
    }

    if (data.categoryIds) {
      await tx.productCategory.deleteMany({ where: { productId: product.id } });
      await tx.productCategory.createMany({
        data: data.categoryIds.map((categoryId) => ({ productId: product.id, categoryId })),
      });
    }

    return product;
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "product.updated",
    resource: `Product:${updated.id}`,
    before,
    after: updated,
  });

  return updated;
}

/**
 * Product states: DRAFT -> SCHEDULED -> ACTIVE -> ARCHIVED. There is no
 * manually-assigned "Out of Stock" state — that's derived from variant
 * inventory at read time, never stored on the product itself.
 */
export async function publishProduct(productId: string, publishAt?: Date) {
  const session = await requirePermission("products.update");

  const before = await db.product.findUnique({ where: { id: productId } });
  if (!before) throw new Error("Product not found");

  const isScheduled = publishAt && publishAt.getTime() > Date.now();

  const updated = await db.product.update({
    where: { id: productId },
    data: {
      status: isScheduled ? "SCHEDULED" : "ACTIVE",
      publishedAt: isScheduled ? publishAt : new Date(),
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: isScheduled ? "product.scheduled" : "product.published",
    resource: `Product:${productId}`,
    before,
    after: updated,
  });

  return updated;
}

/**
 * Archive, never hard-delete. Products referenced by historical orders
 * must remain readable — hard delete would break OrderItem's foreign
 * key or (if cascade) silently corrupt order history. OrderItem's
 * snapshot fields mean the order display doesn't even need this row,
 * but it must still exist for accounting/audit/serial-tracking joins.
 */
export async function archiveProduct(productId: string, reason?: string) {
  const session = await requirePermission("products.archive");

  const before = await db.product.findUnique({ where: { id: productId } });
  if (!before) throw new Error("Product not found");

  const updated = await db.product.update({
    where: { id: productId },
    data: { status: "ARCHIVED" },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "product.archived",
    resource: `Product:${productId}`,
    before,
    after: updated,
    reason,
  });

  return updated;
}

export async function duplicateProduct(productId: string) {
  const session = await requirePermission("products.create");

  const original = await db.product.findUnique({
    where: { id: productId },
    include: { categories: true, variants: { include: { attributeValues: true } } },
  });
  if (!original) throw new Error("Product not found");

  let slug = `${original.slug}-copy`;
  let suffix = 1;
  while (await db.product.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${original.slug}-copy-${suffix}`;
  }

  const copy = await db.product.create({
    data: {
      name: `${original.name} (Copy)`,
      slug,
      brand: original.brand,
      shortDescription: original.shortDescription,
      longDescription: original.longDescription,
      status: "DRAFT",
      movementType: original.movementType,
      caseMaterial: original.caseMaterial,
      caseDiameterMm: original.caseDiameterMm,
      waterResistanceM: original.waterResistanceM,
      warrantyMonths: original.warrantyMonths,
      hasAuthCertificate: original.hasAuthCertificate,
      boxAndPapers: original.boxAndPapers,
      categories: {
        create: original.categories.map((c) => ({ categoryId: c.categoryId })),
      },
      // Variants are intentionally NOT copied — SKUs must be unique and
      // meaningful, not auto-generated. Admin adds variants fresh on
      // the duplicated draft.
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "product.duplicated",
    resource: `Product:${copy.id}`,
    reason: `Duplicated from Product:${productId}`,
  });

  return copy;
}

/**
 * Attach an already-uploaded MediaAsset as a product image. Was
 * missing entirely — the product form built in Phase 9 had no image
 * field because this didn't exist yet. Sort order defaults to
 * appended-at-end; reordering is a separate bulk operation below,
 * same pattern as category/homepage-section reordering.
 */
export async function addProductImage(productId: string, mediaAssetId: string) {
  const session = await requirePermission("products.update");

  const maxSortOrder = await db.productImage.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  });

  const image = await db.productImage.create({
    data: { productId, mediaAssetId, sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1 },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "product.image_added",
    resource: `Product:${productId}`,
    after: { mediaAssetId },
  });

  return image;
}

export async function removeProductImage(productImageId: string) {
  const session = await requirePermission("products.update");

  const image = await db.productImage.findUnique({ where: { id: productImageId } });
  if (!image) throw new Error("Image not found");

  await db.productImage.delete({ where: { id: productImageId } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "product.image_removed",
    resource: `Product:${image.productId}`,
  });
}

export async function reorderProductImages(updates: { id: string; sortOrder: number }[]) {
  const session = await requirePermission("products.update");

  await db.$transaction(
    updates.map((u) => db.productImage.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }))
  );

  await recordAuditLog({
    actorId: session.user.id,
    action: "product.images_reordered",
    resource: "ProductImage:bulk",
    after: updates,
  });
}
