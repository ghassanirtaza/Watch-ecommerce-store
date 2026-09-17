import { NextRequest, NextResponse } from "next/server";
import { sweepExpiredReservations } from "@/domain/inventory/reservation";
import { cancelStalePendingOrders } from "@/domain/orders/confirmation";

/**
 * Hygiene pass only — NOT the primary correctness mechanism for
 * reservation expiry (that's the lazy-expiry check inside
 * reserveCartStock itself). This exists to clean up reservations/orders
 * that are abandoned and never touched again, so they don't sit in the
 * database indefinitely. Configure as a Vercel Cron job (e.g. every 5
 * minutes) hitting this route with the CRON_SECRET header.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [reservationResult, orderResult] = await Promise.all([
    sweepExpiredReservations(),
    cancelStalePendingOrders(),
  ]);

  return NextResponse.json({
    reservationsReleased: reservationResult.released,
    ordersCancelled: orderResult.cancelled,
  });
}
