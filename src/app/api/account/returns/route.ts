import { NextRequest, NextResponse } from "next/server";
import { requestReturn } from "@/domain/returns/service";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const returnRequest = await requestReturn(body);
    return NextResponse.json(returnRequest);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not submit return request" }, { status: 400 });
  }
}
