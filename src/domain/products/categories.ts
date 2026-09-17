import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { createCategorySchema, type CreateCategoryInput } from "@/lib/validation/product";

export async function createCategory(input: CreateCategoryInput) {
  const session = await requirePermission("products.create");
  const data = createCategorySchema.parse(input);

  const existing = await db.category.findUnique({ where: { slug: data.slug } });
  if (existing) throw new Error(`Slug "${data.slug}" is already in use`);

  if (data.parentId) {
    const parent = await db.category.findUnique({ where: { id: data.parentId } });
    if (!parent) throw new Error("Parent category not found");
  }

  const category = await db.category.create({ data });

  await recordAuditLog({
    actorId: session.user.id,
    action: "category.created",
    resource: `Category:${category.id}`,
    after: category,
  });

  return category;
}

/**
 * Categories are not soft-deletable via a status field (unlike Product)
 * — they either exist or they don't, but deletion is blocked if any
 * product still references them, forcing an explicit reassignment
 * first. This avoids silently orphaning product-category assignments.
 */
export async function deleteCategory(categoryId: string) {
  const session = await requirePermission("products.update");

  const productCount = await db.productCategory.count({ where: { categoryId } });
  if (productCount > 0) {
    throw new Error(
      `Cannot delete category with ${productCount} assigned product(s). Reassign products first.`
    );
  }

  const childCount = await db.category.count({ where: { parentId: categoryId } });
  if (childCount > 0) {
    throw new Error(`Cannot delete category with ${childCount} subcategor(y/ies). Remove or reassign first.`);
  }

  const before = await db.category.findUnique({ where: { id: categoryId } });
  await db.category.delete({ where: { id: categoryId } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "category.deleted",
    resource: `Category:${categoryId}`,
    before,
  });
}

export async function reorderCategories(updates: { id: string; sortOrder: number }[]) {
  const session = await requirePermission("products.update");

  await db.$transaction(
    updates.map((u) => db.category.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }))
  );

  await recordAuditLog({
    actorId: session.user.id,
    action: "category.reordered",
    resource: "Category:bulk",
    after: updates,
  });
}
