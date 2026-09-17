import { NextRequest, NextResponse } from "next/server";
import { adjustStock } from "@/domain/inventory/adjustment";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const result = await adjustStock(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not adjust stock" }, { status: 400 });
  }
}
