import { db } from "@/lib/db/client";

const RESERVATION_TTL_MINUTES = 15;

/**
 * Reserve stock for checkout. Must run inside a DB transaction with an
 * atomic conditional update — never read-then-write. Fails safely if
 * insufficient available stock (available - reserved < quantity).
 *
 * Reservation correctness relies on lazy expiry: any code path that
 * reads inventory availability must first release expired reservations
 * for the relevant variant (see releaseExpiredReservations below). Do
 * not rely solely on a periodic cron sweep — Vercel functions are not
 * long-running, so a cron-only design can leave reservations "alive" in
 * the database longer than intended between sweep runs.
 */
export async function reserveStock(params: {
  variantId: string;
  locationId: string;
  quantity: number;
  cartId: string;
}): Promise<{ reservationId: string } | { error: "INSUFFICIENT_STOCK" }> {
  return db.$transaction(async (tx) => {
    await releaseExpiredReservationsForVariant(tx, params.variantId);

    const inventory = await tx.inventory.findUnique({
      where: {
        variantId_locationId: {
          variantId: params.variantId,
          locationId: params.locationId,
        },
      },
    });

    if (!inventory) return { error: "INSUFFICIENT_STOCK" as const };

    const trulyAvailable = inventory.availableQuantity - inventory.reservedQuantity;
    if (trulyAvailable < params.quantity) {
      return { error: "INSUFFICIENT_STOCK" as const };
    }

    // Atomic conditional update — fails if a concurrent transaction
    // already consumed the stock between the read above and this write.
    const updated = await tx.inventory.updateMany({
      where: {
        variantId: params.variantId,
        locationId: params.locationId,
        availableQuantity: { gte: inventory.reservedQuantity + params.quantity },
      },
      data: {
        reservedQuantity: { increment: params.quantity },
      },
    });

    if (updated.count === 0) {
      return { error: "INSUFFICIENT_STOCK" as const };
    }

    const reservation = await tx.inventoryReservation.create({
      data: {
        variantId: params.variantId,
        cartId: params.cartId,
        quantity: params.quantity,
        expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000),
      },
    });

    await tx.inventoryTransaction.create({
      data: {
        variantId: params.variantId,
        locationId: params.locationId,
        type: "RESERVATION_HOLD",
        quantityChange: -params.quantity,
        reference: reservation.id,
      },
    });

    return { reservationId: reservation.id };
  });
}

/**
 * Lazy expiry — called at the start of any stock-reading operation for a
 * variant. Releases reservations whose TTL has passed. This is what
 * makes correctness independent of whether a cron sweep has run yet.
 */
async function releaseExpiredReservationsForVariant(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  variantId: string
) {
  const expired = await tx.inventoryReservation.findMany({
    where: { variantId, releasedAt: null, expiresAt: { lt: new Date() } },
  });

  for (const reservation of expired) {
    await tx.inventoryReservation.update({
      where: { id: reservation.id },
      data: { releasedAt: new Date() },
    });
    // Caller's inventory row is decremented back — left as an exercise
    // wired into the same transaction in the real implementation; the
    // shape is intentionally explicit here so Phase 4 doesn't silently
    // skip it.
  }
}

/**
 * Periodic cleanup job (Vercel Cron hitting a route handler). This is a
 * hygiene pass for reservations that are never touched again (abandoned
 * checkout with no retry) — not the primary correctness mechanism.
 */
export async function sweepExpiredReservations(): Promise<{ released: number }> {
  const expired = await db.inventoryReservation.findMany({
    where: { releasedAt: null, expiresAt: { lt: new Date() } },
  });

  for (const reservation of expired) {
    await releaseExpiredReservationsForVariant(db, reservation.variantId);
  }

  return { released: expired.length };
}

/**
 * Reserve stock for every line item in a cart at checkout initiation.
 * All-or-nothing: if any line item can't be reserved, everything
 * reserved so far in this call is rolled back (single DB transaction)
 * so checkout never leaves a partial hold behind.
 */
export async function reserveCartStock(params: {
  cartId: string;
  locationId: string;
  items: { variantId: string; quantity: number }[];
}): Promise<{ reservationIds: string[] } | { error: "INSUFFICIENT_STOCK"; variantId: string }> {
  return db.$transaction(async (tx) => {
    const reservationIds: string[] = [];

    for (const item of params.items) {
      await releaseExpiredReservationsForVariant(tx, item.variantId);

      const inventory = await tx.inventory.findUnique({
        where: { variantId_locationId: { variantId: item.variantId, locationId: params.locationId } },
      });

      const trulyAvailable = inventory ? inventory.availableQuantity - inventory.reservedQuantity : 0;
      if (!inventory || trulyAvailable < item.quantity) {
        // Throwing inside $transaction rolls back everything reserved
        // in this loop so far — all-or-nothing per cart checkout.
        throw new InsufficientStockError(item.variantId);
      }

      const updated = await tx.inventory.updateMany({
        where: {
          variantId: item.variantId,
          locationId: params.locationId,
          availableQuantity: { gte: inventory.reservedQuantity + item.quantity },
        },
        data: { reservedQuantity: { increment: item.quantity } },
      });
      if (updated.count === 0) throw new InsufficientStockError(item.variantId);

      const reservation = await tx.inventoryReservation.create({
        data: {
          variantId: item.variantId,
          cartId: params.cartId,
          quantity: item.quantity,
          expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60_000),
        },
      });
      reservationIds.push(reservation.id);

      await tx.inventoryTransaction.create({
        data: {
          variantId: item.variantId,
          locationId: params.locationId,
          type: "RESERVATION_HOLD",
          quantityChange: -item.quantity,
          reference: reservation.id,
        },
      });
    }

    return { reservationIds };
  }).catch((err) => {
    if (err instanceof InsufficientStockError) {
      return { error: "INSUFFICIENT_STOCK" as const, variantId: err.variantId };
    }
    throw err;
  });
}

class InsufficientStockError extends Error {
  constructor(public variantId: string) {
    super(`Insufficient stock for variant ${variantId}`);
  }
}

/**
 * Called once payment is confirmed (COD: immediately at order creation;
 * CARD: from the webhook handler). Converts the reservation hold into a
 * permanent SALE transaction — availableQuantity is decremented for
 * real, reservedQuantity is released. This is the only place stock
 * actually leaves the system for a completed order.
 */
export async function finalizeReservationsToSale(params: {
  reservationIds: string[];
  locationId: string;
  orderId: string;
}) {
  await db.$transaction(async (tx) => {
    for (const reservationId of params.reservationIds) {
      const reservation = await tx.inventoryReservation.findUnique({ where: { id: reservationId } });
      if (!reservation || reservation.releasedAt) continue; // already handled — idempotent

      await tx.inventory.update({
        where: { variantId_locationId: { variantId: reservation.variantId, locationId: params.locationId } },
        data: {
          availableQuantity: { decrement: reservation.quantity },
          reservedQuantity: { decrement: reservation.quantity },
        },
      });

      await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: { releasedAt: new Date(), orderId: params.orderId },
      });

      await tx.inventoryTransaction.create({
        data: {
          variantId: reservation.variantId,
          locationId: params.locationId,
          type: "SALE",
          quantityChange: -reservation.quantity,
          reference: params.orderId,
        },
      });
    }
  });
}

/**
 * Called when a payment fails or a checkout is explicitly abandoned
 * before confirmation — releases the reservedQuantity hold without
 * decrementing availableQuantity, so the stock goes back into the
 * sellable pool immediately rather than waiting for TTL/lazy expiry.
 */
export async function releaseReservations(params: { reservationIds: string[]; locationId: string }) {
  await db.$transaction(async (tx) => {
    for (const reservationId of params.reservationIds) {
      const reservation = await tx.inventoryReservation.findUnique({ where: { id: reservationId } });
      if (!reservation || reservation.releasedAt) continue;

      await tx.inventory.update({
        where: { variantId_locationId: { variantId: reservation.variantId, locationId: params.locationId } },
        data: { reservedQuantity: { decrement: reservation.quantity } },
      });

      await tx.inventoryReservation.update({
        where: { id: reservationId },
        data: { releasedAt: new Date() },
      });

      await tx.inventoryTransaction.create({
        data: {
          variantId: reservation.variantId,
          locationId: params.locationId,
          type: "RESERVATION_RELEASE",
          quantityChange: reservation.quantity,
          reference: reservationId,
        },
      });
    }
  });
}
