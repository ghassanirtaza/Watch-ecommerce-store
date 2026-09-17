import { describe, it, expect } from "vitest";
import { initiateCheckoutSchema } from "@/lib/validation/checkout";

const validAddress = {
  fullName: "Ali Khan",
  phone: "03001234567",
  addressLine1: "House 12, Street 5",
  city: "Lahore",
};

const baseInput = {
  cartId: "clh1234567890123456789ab",
  shippingAddress: validAddress,
  paymentMethod: "COD" as const,
};

describe("initiateCheckoutSchema — phone validation", () => {
  it("accepts a valid 03xxxxxxxxx number", () => {
    const result = initiateCheckoutSchema.safeParse({
      ...baseInput,
      shippingAddress: { ...validAddress, phone: "03001234567" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid +923xxxxxxxxx number", () => {
    const result = initiateCheckoutSchema.safeParse({
      ...baseInput,
      shippingAddress: { ...validAddress, phone: "+923001234567" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a number missing the leading 3", () => {
    const result = initiateCheckoutSchema.safeParse({
      ...baseInput,
      shippingAddress: { ...validAddress, phone: "02001234567" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an obviously non-Pakistani number", () => {
    const result = initiateCheckoutSchema.safeParse({
      ...baseInput,
      shippingAddress: { ...validAddress, phone: "+14155552671" },
    });
    expect(result.success).toBe(false);
  });
});

describe("initiateCheckoutSchema — required fields", () => {
  it("rejects a missing city", () => {
    const { city, ...withoutCity } = validAddress;
    const result = initiateCheckoutSchema.safeParse({
      ...baseInput,
      shippingAddress: withoutCity,
    });
    expect(result.success).toBe(false);
  });

  it("allows a missing postal code (spec: optional, low reliability in Pakistan)", () => {
    const result = initiateCheckoutSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects an invalid payment method", () => {
    const result = initiateCheckoutSchema.safeParse({ ...baseInput, paymentMethod: "PAYPAL" });
    expect(result.success).toBe(false);
  });
});
