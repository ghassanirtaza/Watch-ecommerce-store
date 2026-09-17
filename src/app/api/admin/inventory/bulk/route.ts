import { NextRequest, NextResponse } from "next/server";
import { bulkAdjustStock } from "@/domain/inventory/adjustment";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.rows || !body?.locationId) {
    return NextResponse.json({ error: "Missing rows or locationId" }, { status: 400 });
  }

  try {
    const result = await bulkAdjustStock(body.rows, body.locationId, { commit: !!body.commit });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 400 });
  }
}
