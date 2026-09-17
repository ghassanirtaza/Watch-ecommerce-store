"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  returnId: string;
  status: string;
  inspectionPassed: boolean | null;
  hasSerializedItems: boolean;
  itemIds: { orderItemId: string; label: string }[];
  orderTotal: number;
}

export function ReturnActions({ returnId, status, inspectionPassed: recordedInspectionPassed, hasSerializedItems, itemIds, orderTotal }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inspectionPassed, setInspectionPassed] = useState(true);
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [serials, setSerials] = useState<Record<string, string>>({});
  const [refundAmount, setRefundAmount] = useState(orderTotal.toString());

  async function callAction(action: string, payload: Record<string, unknown> = {}) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/returns/${returnId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Action failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

      {status === "REQUESTED" && (
        <div className="flex gap-3">
          <button
            onClick={() => callAction("approve")}
            disabled={loading}
            className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={() => {
              const reason = window.prompt("Reason for rejection:");
              if (reason) callAction("reject", { reason });
            }}
            disabled={loading}
            className="rounded border border-[var(--color-error)] px-4 py-2 text-sm text-[var(--color-error)] disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {status === "APPROVED" && (
        <button
          onClick={() => callAction("mark_received")}
          disabled={loading}
          className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
        >
          Mark Item Received
        </button>
      )}

      {status === "ITEM_RECEIVED" && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Inspection
          </h2>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            This is the mandatory checkpoint — refund is only reachable after inspection is recorded here.
          </p>

          {hasSerializedItems && (
            <div className="mb-3 space-y-2">
              <p className="text-xs text-[var(--color-warning)]">
                This return includes serialized items. Enter the serial number physically on the returned item for
                each — a mismatch against what was sold force-fails inspection regardless of the result selected
                below.
              </p>
              {itemIds.map((item) => (
                <input
                  key={item.orderItemId}
                  placeholder={`Returned serial for ${item.label}`}
                  value={serials[item.orderItemId] ?? ""}
                  onChange={(e) => setSerials((prev) => ({ ...prev, [item.orderItemId]: e.target.value }))}
                  className="w-full rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
                />
              ))}
            </div>
          )}

          <label className="mb-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={inspectionPassed} onChange={(e) => setInspectionPassed(e.target.checked)} />
            Item passes inspection (condition matches return policy)
          </label>
          <textarea
            placeholder="Inspection notes"
            value={inspectionNotes}
            onChange={(e) => setInspectionNotes(e.target.value)}
            rows={2}
            className="mb-3 w-full rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
          />
          <button
            onClick={() =>
              callAction("inspect", {
                passed: inspectionPassed,
                notes: inspectionNotes,
                returnedSerialByOrderItem: hasSerializedItems ? serials : undefined,
              })
            }
            disabled={loading}
            className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
          >
            Record Inspection
          </button>
        </div>
      )}

      {status === "INSPECTED" && recordedInspectionPassed && (
        <div className="rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Issue Refund
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-32 rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
            />
            <button
              onClick={() => callAction("issue_refund", { refundAmount: Number(refundAmount) })}
              disabled={loading}
              className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
            >
              Issue Refund
            </button>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Only reachable because inspection passed — a failed inspection has no path to this step.
          </p>
        </div>
      )}

      {status === "INSPECTED" && !recordedInspectionPassed && (
        <div className="rounded border border-[var(--color-error)] p-4">
          <p className="text-sm text-[var(--color-error)]">
            Inspection failed — this return cannot proceed to refund. No further automated action; resolve
            manually with the customer if needed.
          </p>
        </div>
      )}

      {status === "REFUND_ISSUED" && (
        <button
          onClick={() => callAction("complete")}
          disabled={loading}
          className="rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
        >
          Mark Completed
        </button>
      )}

      {(status === "REJECTED" || status === "COMPLETED") && (
        <p className="text-sm text-[var(--color-text-muted)]">This return is finalized — no further action.</p>
      )}
    </div>
  );
}
