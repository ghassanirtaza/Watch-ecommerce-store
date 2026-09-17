import { NextRequest, NextResponse } from "next/server";
import { createProduct } from "@/domain/products/service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const product = await createProduct(body);
    return NextResponse.json(product);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create product" }, { status: 400 });
  }
}
