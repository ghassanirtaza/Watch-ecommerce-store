import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { createSignedUploadParams } from "@/lib/storage/cloudinary";

export async function POST(request: NextRequest) {
  try {
    // Same permission as registerMediaAsset (content.create) — no
    // point letting someone get a valid upload signature if they
    // couldn't register the result anyway.
    await requirePermission("content.create");
  } catch {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const folder = typeof body.folder === "string" ? body.folder : "uploads";

  const params = createSignedUploadParams(folder);
  return NextResponse.json(params);
}
