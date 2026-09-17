import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { getWishlistWithCurrentStatus } from "@/domain/customers/wishlist";
import { WishlistGrid } from "@/components/account/wishlist-grid";
import { ShareWishlistButton } from "@/components/account/share-wishlist-button";

export default async function AccountWishlistPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
  const wishlist = profile ? await getWishlistWithCurrentStatus(profile.id) : { items: [] };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl">Wishlist</h1>
        {wishlist.items.length > 0 && <ShareWishlistButton />}
      </div>

      {wishlist.items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-3 text-sm text-[var(--color-text-muted)]">Your wishlist is empty.</p>
          <a href="/shop" className="text-sm text-[var(--color-gold)] underline">
            Explore New Arrivals
          </a>
        </div>
      ) : (
        <WishlistGrid items={wishlist.items} />
      )}
    </div>
  );
}
