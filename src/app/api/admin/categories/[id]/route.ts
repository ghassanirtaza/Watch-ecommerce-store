import { NextRequest, NextResponse } from "next/server";
import { deleteCategory } from "@/domain/products/categories";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteCategory(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete category" }, { status: 400 });
  }
}
