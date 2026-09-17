import crypto from "crypto";

/**
 * Human-readable order number for customer-facing display (order
 * confirmation, guest tracking lookup) — distinct from the internal
 * cuid `id`. Format: WS-YYMMDD-XXXXX (5 random alphanumeric chars).
 * Not sequential — sequential order numbers let anyone estimate total
 * order volume by placing two orders and diffing the numbers.
 */
export function generateOrderNumber(): string {
  const date = new Date();
  const datePart = `${String(date.getFullYear()).slice(2)}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase().slice(0, 5);
  return `WS-${datePart}-${randomPart}`;
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
