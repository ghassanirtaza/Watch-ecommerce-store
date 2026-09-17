import { NextRequest, NextResponse } from "next/server";
import { publishBanner, archiveBanner } from "@/domain/content/banners";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (body.action === "publish") return NextResponse.json(await publishBanner(id));
    if (body.action === "archive") {
      await archiveBanner(id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed" }, { status: 400 });
  }
}
