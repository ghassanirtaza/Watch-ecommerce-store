import { notFound } from "next/navigation";
import { getSharedWishlist } from "@/domain/customers/wishlist";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedWishlistPage({ params }: PageProps) {
  const { token } = await params;
  const wishlist = await getSharedWishlist(token);

  if (!wishlist) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl">Shared Wishlist</h1>

      {wishlist.items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">This wishlist is empty.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {wishlist.items.map((item) => (
            <a key={item.productSlug} href={`/products/${item.productSlug}`} className="block">
              <div className="aspect-square overflow-hidden rounded bg-[var(--color-bg-elevated)]">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- next/image domain config lives in next.config.ts already; kept simple here since this is a low-traffic public page
                  <img src={item.imageUrl} alt={item.productName} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <p className="mt-2 text-sm">{item.productName}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
