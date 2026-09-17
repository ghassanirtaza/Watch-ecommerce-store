import { NextRequest, NextResponse } from "next/server";
import { deleteAddress } from "@/domain/customers/addresses";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await deleteAddress(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete address" }, { status: 400 });
  }
}
