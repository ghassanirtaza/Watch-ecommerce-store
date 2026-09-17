import { z } from "zod";

// Pakistan cities — controlled list per spec (postal code optional, low
// reliability). Extend this list as real launch cities are confirmed;
// treat it as data, not a hardcoded enum, once the admin needs to edit
// it — placeholder here is deliberately a plain array, not baked into
// the schema as a z.enum, to keep that swap cheap.
export const PAKISTAN_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
] as const;

export const shippingAddressSchema = z.object({
  fullName: z.string().min(1).max(100),
  phone: z
    .string()
    .regex(/^(\+92|0)3\d{9}$/, "Enter a valid Pakistani mobile number"),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(100), // validated against PAKISTAN_CITIES at the UI layer via a select, not enforced here so new cities can be added without a schema change
  postalCode: z.string().max(20).optional(),
});

export const initiateCheckoutSchema = z.object({
  cartId: z.string().cuid(),
  guestEmail: z.string().email().optional(),
  shippingAddress: shippingAddressSchema,
  saveAddress: z.boolean().default(false),
  paymentMethod: z.enum(["CARD", "COD"]),
  couponCode: z.string().max(50).optional(),
});

export type InitiateCheckoutInput = z.infer<typeof initiateCheckoutSchema>;

export const confirmCodOrderSchema = z.object({
  orderId: z.string().cuid(),
  otpCode: z.string().length(6),
});
