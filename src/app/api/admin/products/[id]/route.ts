import { NextRequest, NextResponse } from "next/server";
import { updateProduct, publishProduct, archiveProduct } from "@/domain/products/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const product = await updateProduct({ ...body, id });
    return NextResponse.json(product);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update product" }, { status: 400 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Action endpoint — publish/archive, distinguished by body.action
  // rather than separate routes, since both are simple state
  // transitions on the same resource.
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "publish") {
      const product = await publishProduct(id, body.publishAt ? new Date(body.publishAt) : undefined);
      return NextResponse.json(product);
    }
    if (body.action === "archive") {
      const product = await archiveProduct(id, body.reason);
      return NextResponse.json(product);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed" }, { status: 400 });
  }
}
