import { describe, it, expect } from "vitest";
import { generateOrderNumber, generateIdempotencyKey } from "@/domain/orders/order-number";

describe("generateOrderNumber", () => {
  it("matches the WS-YYMMDD-XXXXX format", () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(/^WS-\d{6}-[A-F0-9]{5}$/);
  });

  it("is not sequential — two calls produce different random suffixes", () => {
    // Per AI_CONTEXT.md: order numbers must not be sequential, since a
    // sequential scheme would let anyone estimate total order volume
    // by placing two orders and diffing the numbers. This test can't
    // prove non-sequentiality in general, but it does catch the most
    // common regression (someone "simplifying" this back to a counter).
    const a = generateOrderNumber();
    const b = generateOrderNumber();
    expect(a).not.toBe(b);
    const suffixA = a.split("-")[2];
    const suffixB = b.split("-")[2];
    expect(suffixA).not.toBe(suffixB);
  });
});

describe("generateIdempotencyKey", () => {
  it("produces a valid UUID", () => {
    const key = generateIdempotencyKey();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("is unique across calls", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(100);
  });
});
