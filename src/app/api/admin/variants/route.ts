import { NextRequest, NextResponse } from "next/server";
import { createVariant } from "@/domain/products/variants";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const variant = await createVariant(body);
    return NextResponse.json(variant);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create variant" }, { status: 400 });
  }
}
