"use client";

import { useMemo, useState } from "react";

export interface VariantOption {
  id: string;
  variantName: string;
  price: number;
  isActive: boolean;
  availableQuantity: number;
  attributes: { key: string; value: string }[];
}

/**
 * PDP flow spec requires all mandatory variant attributes selected
 * before Add to Cart / Buy Now enable. This groups variants by
 * attribute key so the UI can render e.g. "Case Size" and "Strap"
 * as separate selectors, then resolves the exact variant once every
 * attribute has a selection.
 */
export function VariantSelector({
  variants,
  onSelect,
}: {
  variants: VariantOption[];
  onSelect: (variant: VariantOption | null) => void;
}) {
  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach((v) => v.attributes.forEach((a) => keys.add(a.key)));
    return Array.from(keys);
  }, [variants]);

  const [selections, setSelections] = useState<Record<string, string>>({});

  const valuesFor = (key: string) => {
    const seen = new Set<string>();
    variants.forEach((v) => {
      const match = v.attributes.find((a) => a.key === key);
      if (match) seen.add(match.value);
    });
    return Array.from(seen);
  };

  const handleSelect = (key: string, value: string) => {
    const next = { ...selections, [key]: value };
    setSelections(next);

    const allSelected = attributeKeys.every((k) => next[k]);
    if (!allSelected) {
      onSelect(null);
      return;
    }

    const matched =
      variants.find((v) =>
        attributeKeys.every((k) => v.attributes.some((a) => a.key === k && a.value === next[k]))
      ) ?? null;

    onSelect(matched);
  };

  return (
    <div className="space-y-4">
      {attributeKeys.map((key) => (
        <div key={key}>
          <label className="mb-2 block text-sm font-medium text-[var(--color-text-primary)]">
            {key}
          </label>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={key}>
            {valuesFor(key).map((value) => {
              const isSelected = selections[key] === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleSelect(key, value)}
                  className={`border px-4 py-2 text-sm transition-colors ${
                    isSelected
                      ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10"
                      : "border-[var(--color-border)]"
                  }`}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
