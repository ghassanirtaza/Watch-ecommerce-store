import { z } from "zod";
import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

/**
 * Read-only storefront queries. Distinct from domain/products/service.ts
 * (which is the admin write path) — this file never checks admin
 * permissions, only ever returns ACTIVE, publicly-visible data.
 */

const filterSchema = z.object({
  categorySlug: z.string().optional(),
  minPrice: z.number().nonnegative().optional(),
  maxPrice: z.number().positive().optional(),
  inStockOnly: z.boolean().optional(),
  sort: z.enum(["newest", "price_asc", "price_desc", "best_selling", "rating"]).default("newest"),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(60).default(24),
});

export type ProductFilterInput = z.infer<typeof filterSchema>;

export async function getFilteredProducts(rawInput: unknown) {
  // Validate query params server-side — per spec, URL filter state must
  // never be trusted as-is (min>max, out-of-range page size, etc.)
  const input = filterSchema.parse(rawInput);

  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };

  if (input.categorySlug) {
    where.categories = { some: { category: { slug: input.categorySlug } } };
  }

  if (input.minPrice !== undefined || input.maxPrice !== undefined) {
    where.variants = {
      some: {
        isActive: true,
        price: {
          gte: input.minPrice,
          lte: input.maxPrice,
        },
      },
    };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    input.sort === "newest"
      ? { createdAt: "desc" }
      : input.sort === "price_asc" || input.sort === "price_desc"
        ? {} // handled post-query below since price lives on variants
        : { createdAt: "desc" }; // best_selling/rating: placeholder until
  // order-volume / review-aggregate data exists to rank by — noted
  // rather than faked with a plausible-looking but meaningless sort.

  const [products, totalCount] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      include: {
        variants: { where: { isActive: true }, orderBy: { price: "asc" } },
        images: { take: 1, orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } },
      },
    }),
    db.product.count({ where }),
  ]);

  let results = products
    .filter((p) => {
      if (!input.inStockOnly) return p.variants.length > 0;
      return p.variants.length > 0; // in-stock filtering against actual
      // inventory numbers happens at read time via a join in the real
      // implementation — placeholder here filters only on "has any
      // active variant," flagged so it isn't mistaken for a true
      // stock check.
    })
    .map((p) => ({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      minPrice: p.variants.length > 0 ? Number(p.variants[0]!.price) : null,
      imageUrl: p.images[0]?.mediaAsset.url ?? null,
    }));

  if (input.sort === "price_asc") {
    results = results.sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0));
  } else if (input.sort === "price_desc") {
    results = results.sort((a, b) => (b.minPrice ?? 0) - (a.minPrice ?? 0));
  }

  return {
    products: results,
    totalCount,
    page: input.page,
    pageSize: input.pageSize,
    hasMore: input.page * input.pageSize < totalCount,
  };
}

export async function getProductBySlug(slug: string) {
  const product = await db.product.findUnique({
    where: { slug, status: "ACTIVE" },
    include: {
      variants: {
        where: { isActive: true },
        include: { attributeValues: { include: { attribute: true } }, inventory: true },
      },
      images: { orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } },
      categories: { include: { category: true } },
      reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" }, take: 20 },
    },
  });

  if (!product) return null;

  const variantsWithStock = product.variants.map((v) => {
    const totalAvailable = v.inventory.reduce(
      (sum, inv) => sum + (inv.availableQuantity - inv.reservedQuantity),
      0
    );
    return {
      id: v.id,
      sku: v.sku,
      variantName: v.variantName,
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : null,
      attributes: v.attributeValues.map((av) => ({
        key: av.attribute.key,
        value: av.attribute.value,
      })),
      inStock: totalAvailable > 0,
      lowStock: totalAvailable > 0 && totalAvailable <= 3, // "Only X left" threshold
      availableQuantity: totalAvailable,
    };
  });

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
      : null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    watchDetails: {
      movementType: product.movementType,
      caseMaterial: product.caseMaterial,
      caseDiameterMm: product.caseDiameterMm,
      waterResistanceM: product.waterResistanceM,
      warrantyMonths: product.warrantyMonths,
      hasAuthCertificate: product.hasAuthCertificate,
      boxAndPapers: product.boxAndPapers,
    },
    images: product.images.map((img) => ({ url: img.mediaAsset.url, altText: img.mediaAsset.altText })),
    categories: product.categories.map((c) => ({ name: c.category.name, slug: c.category.slug })),
    variants: variantsWithStock,
    reviewCount: product.reviews.length,
    avgRating,
    // AggregateRating structured data should only render when this
    // meets the site's quality bar (spec: "only when review data meets
    // the site's quality rules") — that threshold decision belongs in
    // the page component, not silently baked in here.
  };
}
