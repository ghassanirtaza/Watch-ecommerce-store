import { NextRequest, NextResponse } from "next/server";
import { createBanner, publishBanner, archiveBanner } from "@/domain/content/banners";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const banner = await createBanner(body);
    return NextResponse.json(banner);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not create banner" }, { status: 400 });
  }
}
