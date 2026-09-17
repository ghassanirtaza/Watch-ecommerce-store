import { NextRequest, NextResponse } from "next/server";
import { upsertContentPage, publishContentPage } from "@/domain/content/pages";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const page = await upsertContentPage(body);
    if (body.publish) {
      await publishContentPage(page.id);
    }
    return NextResponse.json(page);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save page" }, { status: 400 });
  }
}
