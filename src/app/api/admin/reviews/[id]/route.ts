import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { moderateReview } from "@/domain/reviews/service";

const bodySchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "FLAGGED"]),
  reason: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const review = await moderateReview(id, parsed.data.decision, parsed.data.reason);
    return NextResponse.json(review);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed" }, { status: 400 });
  }
}
