import { NextRequest, NextResponse } from "next/server";
import { createAddress } from "@/domain/customers/addresses";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const address = await createAddress(body);
    return NextResponse.json(address);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save address" }, { status: 400 });
  }
}
