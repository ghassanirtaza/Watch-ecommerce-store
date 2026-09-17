import { NextRequest, NextResponse } from "next/server";
import { registerMediaAsset } from "@/domain/content/media";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.publicId || !body?.altText) {
    return NextResponse.json({ error: "publicId and altText are required" }, { status: 400 });
  }

  try {
    const asset = await registerMediaAsset({ publicId: body.publicId, altText: body.altText });
    return NextResponse.json(asset);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not register upload" }, { status: 400 });
  }
}
