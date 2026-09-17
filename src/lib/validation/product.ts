import { z } from "zod";

// Server-side validation is authoritative. Client-side reuse of these
// schemas is supplementary only — never trust a client-side pass as
// proof of validity.

export const slugSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase, alphanumeric, hyphen-separated");

export const skuSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z0-9-]+$/, "SKU must be uppercase alphanumeric with hyphens");

export const productAttributesSchema = z
  .object({
    // Watch-domain fields — all optional since not every product needs
    // every field, but validated when present.
    movementType: z.enum(["Automatic", "Quartz", "Mechanical", "Solar"]).optional(),
    caseMaterial: z.string().max(100).optional(),
    caseDiameterMm: z.number().positive().max(100).optional(),
    waterResistanceM: z.number().int().nonnegative().max(1000).optional(),
    warrantyMonths: z.number().int().nonnegative().max(120).optional(),
    hasAuthCertificate: z.boolean().optional(),
    boxAndPapers: z.boolean().optional(),
  })
  .partial();

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  brand: z.string().max(100).optional(),
  shortDescription: z.string().max(500).optional(),
  longDescription: z.string().max(20000).optional(), // sanitized server-side before persist
  categoryIds: z.array(z.string().cuid()).min(1, "At least one category is required"),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  ...productAttributesSchema.shape,
});

export const updateProductSchema = createProductSchema.partial().extend({
  id: z.string().cuid(),
});

export const createVariantSchema = z.object({
  productId: z.string().cuid(),
  sku: skuSchema,
  variantName: z.string().min(1).max(200),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  barcode: z.string().max(64).optional(),
  attributes: z.array(z.object({ key: z.string().min(1).max(50), value: z.string().min(1).max(200) })),
  initialStock: z.number().int().nonnegative().default(0),
});

export const updateVariantSchema = z.object({
  id: z.string().cuid(),
  variantName: z.string().min(1).max(200).optional(),
  price: z.number().positive().optional(),
  compareAtPrice: z.number().positive().optional().nullable(),
  barcode: z.string().max(64).optional(),
  isActive: z.boolean().optional(),
  // SKU is intentionally not editable after creation — it's referenced
  // by historical OrderItem snapshots and external systems (courier
  // labels, warranty records). Create a new variant instead.
});

export const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  parentId: z.string().cuid().optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
