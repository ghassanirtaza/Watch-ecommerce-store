import { NextRequest, NextResponse } from "next/server";
import {
  approveReturn,
  rejectReturn,
  markItemReceived,
  inspectReturn,
  issueReturnRefund,
  completeReturn,
} from "@/domain/returns/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    switch (body.action) {
      case "approve":
        return NextResponse.json(await approveReturn(id, body.adminNotes));
      case "reject":
        return NextResponse.json(await rejectReturn(id, body.reason));
      case "mark_received":
        return NextResponse.json(await markItemReceived(id));
      case "inspect":
        return NextResponse.json(
          await inspectReturn({
            returnRequestId: id,
            passed: body.passed,
            notes: body.notes,
            returnedSerialByOrderItem: body.returnedSerialByOrderItem,
          })
        );
      case "issue_refund":
        return NextResponse.json(await issueReturnRefund(id, body.refundAmount));
      case "complete":
        return NextResponse.json(await completeReturn(id));
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed" }, { status: 400 });
  }
}
