import { NextRequest, NextResponse } from "next/server";
import { addProductImage, removeProductImage } from "@/domain/products/service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.productId || !body?.mediaAssetId) {
    return NextResponse.json({ error: "productId and mediaAssetId are required" }, { status: 400 });
  }

  try {
    const image = await addProductImage(body.productId, body.mediaAssetId);
    return NextResponse.json(image);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not add image" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.productImageId) {
    return NextResponse.json({ error: "productImageId is required" }, { status: 400 });
  }

  try {
    await removeProductImage(body.productImageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not remove image" }, { status: 400 });
  }
}
