import { db } from "@/lib/db/client";

/**
 * MVP search per AI_CONTEXT.md: PostgreSQL search only, no dedicated
 * search engine. Prefix/substring matching, no typo tolerance/synonyms
 * (Phase 2). Do not reach for Elasticsearch/Meilisearch/Algolia here —
 * that's an explicit non-goal until real catalog/traffic justifies it.
 */

const MIN_QUERY_LENGTH = 2;

export interface SearchResult {
  productId: string;
  name: string;
  slug: string;
  brand: string | null;
  minPrice: number;
  imageUrl: string | null;
}

export async function searchProducts(rawQuery: string, limit = 24): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) return [];

  // Sanitize: strip anything that isn't alphanumeric/space/hyphen before
  // building the ILIKE pattern — this is a defense-in-depth measure on
  // top of Prisma's parameterization, not a substitute for it.
  const safeQuery = query.replace(/[^a-zA-Z0-9\s-]/g, "");
  const pattern = `%${safeQuery}%`;

  const products = await db.product.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { name: { contains: safeQuery, mode: "insensitive" } },
        { brand: { contains: safeQuery, mode: "insensitive" } },
        { variants: { some: { sku: { contains: safeQuery, mode: "insensitive" } } } },
        { categories: { some: { category: { name: { contains: safeQuery, mode: "insensitive" } } } } },
      ],
    },
    include: {
      variants: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1 },
      images: { take: 1, orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } },
    },
    take: limit,
  });

  return products
    .filter((p) => p.variants.length > 0) // no purchasable variants -> exclude from results
    .map((p) => ({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      minPrice: Number(p.variants[0]!.price),
      imageUrl: p.images[0]?.mediaAsset.url ?? null,
    }));
}

/**
 * Autocomplete: same query, smaller result set, no full product detail —
 * just enough for a dropdown (thumbnail + name + price per spec).
 * Begins at 2 characters per the UX flow doc.
 */
export async function autocompleteProducts(rawQuery: string): Promise<SearchResult[]> {
  return searchProducts(rawQuery, 6);
}

/**
 * Zero-result fallback per UX flow: broadened query, then popular/
 * best-seller fallback. "Popular" here is a placeholder — real
 * implementation should rank by order count once analytics data exists.
 */
export async function getZeroResultFallback(limit = 8): Promise<SearchResult[]> {
  const products = await db.product.findMany({
    where: { status: "ACTIVE" },
    include: {
      variants: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1 },
      images: { take: 1, orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } },
    },
    orderBy: { createdAt: "desc" }, // placeholder ranking — swap for
    // real best-seller ranking once order-volume data exists
    take: limit,
  });

  return products
    .filter((p) => p.variants.length > 0)
    .map((p) => ({
      productId: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      minPrice: Number(p.variants[0]!.price),
      imageUrl: p.images[0]?.mediaAsset.url ?? null,
    }));
}
