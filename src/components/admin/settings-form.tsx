"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Settings {
  store_name: string;
  support_email: string;
  cod_order_value_cap_pkr: number;
  cod_failed_delivery_block_threshold: number;
  guest_checkout_enabled: boolean;
  low_stock_default_threshold: number;
  seo_default_title: string;
  seo_default_description: string;
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [values, setValues] = useState(settings);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveField(key: keyof Settings) {
    setError(null);
    setSaving(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: values[key] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(null);
    }
  }

  function Field({
    label,
    fieldKey,
    type = "text",
  }: {
    label: string;
    fieldKey: keyof Settings;
    type?: "text" | "number" | "checkbox";
  }) {
    return (
      <div className="mb-4">
        <label className="mb-1 block text-sm text-[var(--color-text-muted)]">{label}</label>
        <div className="flex gap-2">
          {type === "checkbox" ? (
            <input
              type="checkbox"
              checked={values[fieldKey] as boolean}
              onChange={(e) => setValues((v) => ({ ...v, [fieldKey]: e.target.checked }))}
            />
          ) : (
            <input
              type={type}
              value={values[fieldKey] as string | number}
              onChange={(e) =>
                setValues((v) => ({ ...v, [fieldKey]: type === "number" ? Number(e.target.value) : e.target.value }))
              }
              className="flex-1 rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
            />
          )}
          <button
            onClick={() => saveField(fieldKey)}
            disabled={saving === fieldKey}
            className="rounded border border-[var(--color-gold)] px-3 py-1.5 text-xs text-[var(--color-gold)] disabled:opacity-50"
          >
            {saving === fieldKey ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-[var(--color-error)]">{error}</p>}
      <Field label="Store name" fieldKey="store_name" />
      <Field label="Support email" fieldKey="support_email" />
      <Field label="COD order value cap (PKR)" fieldKey="cod_order_value_cap_pkr" type="number" />
      <Field label="COD failed-delivery block threshold" fieldKey="cod_failed_delivery_block_threshold" type="number" />
      <Field label="Guest checkout enabled" fieldKey="guest_checkout_enabled" type="checkbox" />
      <Field label="Low stock default threshold" fieldKey="low_stock_default_threshold" type="number" />
      <Field label="Default SEO title" fieldKey="seo_default_title" />
      <Field label="Default SEO description" fieldKey="seo_default_description" />
    </div>
  );
}
