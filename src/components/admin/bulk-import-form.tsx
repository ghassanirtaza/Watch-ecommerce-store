"use client";

import { useState } from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";

interface RowResult {
  row: number;
  sku: string;
  status: "OK" | "ERROR";
  error?: string;
}

/**
 * Two-phase per domain/inventory/adjustment.ts's design: dry-run
 * (commit: false) shows every row's validation result before anything
 * is written; commit is only enabled once the dry-run shows zero
 * errors, and re-validates server-side again on commit rather than
 * trusting the dry-run result blindly.
 */
export function BulkImportForm({ locationId }: { locationId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [committed, setCommitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    setResults(null);
    setCommitted(false);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => setRows(parsed.data),
      error: (err) => setError(err.message),
    });
  }

  async function runImport(commit: boolean) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inventory/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: rows.map((r) => ({ sku: r.sku, quantityChange: r.quantityChange, reason: r.reason })),
          locationId,
          commit,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Import failed");
      setResults(body.results);
      setCommitted(body.committed);
      if (body.committed) router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const allValid = results?.every((r) => r.status === "OK") ?? false;

  return (
    <div className="rounded border border-[var(--color-border)] p-4">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        Bulk Import (CSV)
      </h2>
      <p className="mb-3 text-xs text-[var(--color-text-muted)]">
        Columns: sku, quantityChange, reason (RESTOCK/DAMAGED/ADJUSTMENT/RETURN). Validated before anything is
        written — a single bad row blocks the whole import.
      </p>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="mb-3 text-sm"
      />

      {rows.length > 0 && !results && (
        <button
          onClick={() => runImport(false)}
          disabled={loading}
          className="rounded border border-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-gold)] disabled:opacity-50"
        >
          {loading ? "Validating..." : `Validate ${rows.length} rows`}
        </button>
      )}

      {results && (
        <div className="mt-3">
          <div className="max-h-48 overflow-y-auto rounded border border-[var(--color-border)]">
            {results.map((r) => (
              <div
                key={r.row}
                className={`flex justify-between border-b border-[var(--color-border)] p-2 text-xs last:border-b-0 ${
                  r.status === "ERROR" ? "text-[var(--color-error)]" : ""
                }`}
              >
                <span>
                  Row {r.row} — {r.sku}
                </span>
                <span>{r.status === "OK" ? "OK" : r.error}</span>
              </div>
            ))}
          </div>

          {committed ? (
            <p className="mt-3 text-sm text-[var(--color-success)]">Import committed.</p>
          ) : allValid ? (
            <button
              onClick={() => runImport(true)}
              disabled={loading}
              className="mt-3 rounded bg-[var(--color-gold)] px-4 py-2 text-sm text-[var(--color-bg)] disabled:opacity-50"
            >
              {loading ? "Committing..." : "Commit Import"}
            </button>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-error)]">
              Fix the errors above and re-upload — no rows have been written yet.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-[var(--color-error)]">{error}</p>}
    </div>
  );
}
