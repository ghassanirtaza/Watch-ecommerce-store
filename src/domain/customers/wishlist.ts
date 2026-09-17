import crypto from "crypto";
import { db } from "@/lib/db/client";

/**
 * No duplicate wishlist records — enforced both by application logic
 * here and the @@unique([wishlistId, productId, variantId]) constraint
 * on WishlistItem, so a race between two requests can't slip through.
 */
export async function getOrCreateWishlist(customerId: string) {
  const existing = await db.wishlist.findUnique({ where: { customerId } });
  if (existing) return existing;
  return db.wishlist.create({ data: { customerId } });
}

export async function toggleWishlistItem(
  customerId: string,
  productId: string,
  variantId?: string
) {
  const wishlist = await getOrCreateWishlist(customerId);

  const existing = await db.wishlistItem.findUnique({
    where: {
      wishlistId_productId_variantId: {
        wishlistId: wishlist.id,
        productId,
        variantId: variantId ?? null,
      },
    },
  });

  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    return { added: false };
  }

  await db.wishlistItem.create({
    data: { wishlistId: wishlist.id, productId, variantId },
  });
  return { added: true };
}

/**
 * Returns wishlist items with CURRENT price and stock status — per UX
 * flow spec, the wishlist page must show current price/availability,
 * not what it was when added.
 */
export async function getWishlistWithCurrentStatus(customerId: string) {
  const wishlist = await db.wishlist.findUnique({
    where: { customerId },
    include: {
      items: {
        include: {
          product: true,
          variant: { include: { inventory: true } },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });
  if (!wishlist) return { items: [] };

  return {
    items: wishlist.items.map((item) => {
      const totalAvailable =
        item.variant?.inventory.reduce((sum, inv) => sum + inv.availableQuantity, 0) ?? null;
      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        variantId: item.variantId,
        variantName: item.variant?.variantName ?? null,
        currentPrice: item.variant ? Number(item.variant.price) : null,
        isInStock: totalAvailable === null ? null : totalAvailable > 0,
        isPurchasable: item.product.status === "ACTIVE" && (item.variant?.isActive ?? true),
      };
    }),
  };
}

/**
 * Public wishlist sharing uses a non-guessable token, generated only
 * when explicitly enabled — never derived from customerId or any
 * predictable value.
 */
export async function enableWishlistSharing(customerId: string) {
  const wishlist = await getOrCreateWishlist(customerId);
  if (wishlist.shareToken) return wishlist.shareToken;

  const token = crypto.randomUUID();
  await db.wishlist.update({ where: { id: wishlist.id }, data: { shareToken: token } });
  return token;
}

/**
 * Public read for a shared wishlist link — anyone with the token can
 * view, no auth required, so this must only ever be reached via the
 * token itself, never by iterating customerIds.
 */
export async function getSharedWishlist(shareToken: string) {
  const wishlist = await db.wishlist.findUnique({
    where: { shareToken },
    include: {
      items: {
        include: { product: { include: { images: { take: 1, orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } } } } },
      },
    },
  });
  if (!wishlist) return null;

  return {
    items: wishlist.items.map((item) => ({
      productName: item.product.name,
      productSlug: item.product.slug,
      imageUrl: item.product.images[0]?.mediaAsset.url ?? null,
    })),
  };
}
