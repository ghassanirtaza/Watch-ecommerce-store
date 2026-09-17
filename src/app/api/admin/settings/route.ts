import { NextRequest, NextResponse } from "next/server";
import { updateSetting } from "@/domain/settings/service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.key) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const setting = await updateSetting(body);
    return NextResponse.json(setting);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update setting" }, { status: 400 });
  }
}
