import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { cancelOrder, transitionOrderStatus } from "@/domain/orders/management";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "cancel") {
      const session = await requirePermission("orders.cancel");
      await cancelOrder(id, body.reason ?? "Cancelled by admin", session.user.id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "transition") {
      await requirePermission("orders.update");
      const updated = await transitionOrderStatus(id, body.status, body.reason);
      return NextResponse.json(updated);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed" }, { status: 400 });
  }
}
