import { z } from "zod";
import { db } from "@/lib/db/client";

const subscribeSchema = z.object({
  variantId: z.string().cuid(),
  email: z.string().email(),
});

export async function subscribeBackInStock(input: z.infer<typeof subscribeSchema>) {
  const data = subscribeSchema.parse(input);

  const variant = await db.productVariant.findUnique({
    where: { id: data.variantId },
    include: { inventory: true },
  });
  if (!variant) throw new Error("Product variant not found");

  const stillInStock = variant.inventory.some((inv) => inv.availableQuantity - inv.reservedQuantity > 0);
  if (stillInStock) {
    throw new Error("This item is currently in stock");
  }

  const existing = await db.backInStockSubscription.findUnique({
    where: { variantId_email: { variantId: data.variantId, email: data.email } },
  });
  if (existing) {
    return { alreadySubscribed: true };
  }

  await db.backInStockSubscription.create({
    data: { variantId: data.variantId, email: data.email },
  });

  return { alreadySubscribed: false };
}

/**
 * Called from the restock path (domain/inventory/adjustment.ts) when a
 * variant's available quantity goes from 0 to >0. Not wired into
 * adjustStock() yet — Phase 2 shipped inventory adjustment before this
 * subscription model existed; wiring the trigger is Phase 3 remaining
 * work (needs the email dispatch queue from domain/notifications,
 * which isn't built yet either).
 */
export async function getUnnotifiedSubscribersForVariant(variantId: string) {
  return db.backInStockSubscription.findMany({
    where: { variantId, notifiedAt: null },
  });
}

export async function markSubscribersNotified(subscriptionIds: string[]) {
  await db.backInStockSubscription.updateMany({
    where: { id: { in: subscriptionIds } },
    data: { notifiedAt: new Date() },
  });
}
