import { z } from "zod";
import { db } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { PAKISTAN_CITIES } from "@/lib/validation/checkout";

/**
 * This service didn't exist before — checkout.ts creates an Address
 * row inline during order placement, but there was nothing letting a
 * logged-in customer view, add, edit, delete, or set a default address
 * outside of checkout. Building it now for the account pages.
 */

const addressSchema = z.object({
  label: z.string().max(40).optional(),
  fullName: z.string().min(1).max(150),
  phone: z.string().regex(/^(\+92|0)3\d{9}$/, "Enter a valid Pakistan mobile number"),
  addressLine1: z.string().min(1).max(300),
  addressLine2: z.string().max(300).optional(),
  city: z.enum(PAKISTAN_CITIES as unknown as [string, ...string[]]),
  postalCode: z.string().max(20).optional(),
  isDefault: z.boolean().optional(),
});

async function getOwnCustomerProfileId(): Promise<string> {
  const session = await requireSession();
  const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) throw new Error("Customer profile not found");
  return profile.id;
}

export async function listAddresses() {
  const customerId = await getOwnCustomerProfileId();
  return db.address.findMany({ where: { customerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
}

export async function createAddress(input: z.infer<typeof addressSchema>) {
  const customerId = await getOwnCustomerProfileId();
  const data = addressSchema.parse(input);

  if (data.isDefault) {
    await db.address.updateMany({ where: { customerId }, data: { isDefault: false } });
  }

  return db.address.create({ data: { customerId, ...data } });
}

export async function updateAddress(addressId: string, input: z.infer<typeof addressSchema>) {
  const customerId = await getOwnCustomerProfileId();
  const data = addressSchema.parse(input);

  const existing = await db.address.findUnique({ where: { id: addressId } });
  if (!existing || existing.customerId !== customerId) {
    throw new Error("Address not found");
  }

  // KNOWN GAP (see docs/AI_CONTEXT.md): unlike OrderItem, Order does
  // not snapshot shipping address text — it holds a live FK to
  // Address. Editing an address here will retroactively change what a
  // past order displays as its shipping address, which contradicts
  // the immutable-snapshot principle applied everywhere else in this
  // codebase. Not fixed in this pass — flagging rather than silently
  // allowing it to look like a non-issue.
  if (data.isDefault) {
    await db.address.updateMany({ where: { customerId }, data: { isDefault: false } });
  }

  return db.address.update({ where: { id: addressId }, data });
}

export async function deleteAddress(addressId: string) {
  const customerId = await getOwnCustomerProfileId();

  const existing = await db.address.findUnique({ where: { id: addressId } });
  if (!existing || existing.customerId !== customerId) {
    throw new Error("Address not found");
  }

  // Addresses referenced by a past order (Order.shippingAddressId)
  // must not be hard-deleted — same historical-integrity rule as
  // products/categories. Since Order only has a nullable FK reference
  // (not a required snapshot of address text), check for references
  // rather than assuming cascade behavior.
  const usedInOrder = await db.order.findFirst({ where: { shippingAddressId: addressId } });
  if (usedInOrder) {
    throw new Error("This address is linked to a past order and cannot be deleted");
  }

  await db.address.delete({ where: { id: addressId } });
}
