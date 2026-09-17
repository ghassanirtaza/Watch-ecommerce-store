import { NextRequest, NextResponse } from "next/server";
import { createCategory, deleteCategory } from "@/domain/products/categories";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const category = await createCategory(body);
    return NextResponse.json(category);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create category" }, { status: 400 });
  }
}
