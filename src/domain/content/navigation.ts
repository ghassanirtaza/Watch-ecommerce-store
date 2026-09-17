import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";

const createNavItemSchema = z.object({
  navigationId: z.string().cuid(),
  label: z.string().min(1).max(60),
  url: z.string().min(1).max(500),
  parentId: z.string().cuid().optional(),
});

export async function createNavigationItem(input: z.infer<typeof createNavItemSchema>) {
  const session = await requirePermission("content.create");
  const data = createNavItemSchema.parse(input);

  // Depth guard: nav items support parent/child (dropdowns), but per
  // spec avoid arbitrary nesting depth — cap at one level of children
  // to match "header navigation, dropdowns" rather than an unbounded
  // tree.
  if (data.parentId) {
    const parent = await db.navigationItem.findUnique({ where: { id: data.parentId } });
    if (parent?.parentId) {
      throw new Error("Navigation items support only one level of nesting (no dropdowns within dropdowns)");
    }
  }

  const maxSortOrder = await db.navigationItem.aggregate({
    where: { navigationId: data.navigationId, parentId: data.parentId ?? null },
    _max: { sortOrder: true },
  });

  const item = await db.navigationItem.create({
    data: { ...data, sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1 },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "navigation_item.created",
    resource: `NavigationItem:${item.id}`,
    after: item,
  });

  return item;
}

export async function deleteNavigationItem(itemId: string) {
  const session = await requirePermission("content.update");

  const childCount = await db.navigationItem.count({ where: { parentId: itemId } });
  if (childCount > 0) {
    throw new Error(`Cannot delete: item has ${childCount} sub-item(s). Remove those first.`);
  }

  await db.navigationItem.delete({ where: { id: itemId } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "navigation_item.deleted",
    resource: `NavigationItem:${itemId}`,
  });
}

export async function reorderNavigationItems(updates: { id: string; sortOrder: number }[]) {
  const session = await requirePermission("content.update");

  await db.$transaction(
    updates.map((u) => db.navigationItem.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }))
  );

  await recordAuditLog({
    actorId: session.user.id,
    action: "navigation_item.reordered",
    resource: "NavigationItem:bulk",
    after: updates,
  });
}

export async function getNavigationByName(name: string) {
  const nav = await db.navigation.findFirst({
    where: { name },
    include: {
      items: {
        where: { parentId: null },
        orderBy: { sortOrder: "asc" },
        include: { children: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return nav;
}
