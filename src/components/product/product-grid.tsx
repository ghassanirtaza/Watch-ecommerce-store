import Image from "next/image";

interface Product {
  productId: string;
  name: string;
  slug: string;
  brand: string | null;
  minPrice: number | null;
  imageUrl: string | null;
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <a
          key={product.productId}
          href={`/products/${product.slug}`}
          className="group block"
        >
          <div className="relative aspect-square overflow-hidden rounded-md bg-[var(--color-bg-elevated)]">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
                No image
              </div>
            )}
          </div>
          <div className="mt-2">
            {product.brand && (
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                {product.brand}
              </p>
            )}
            <p className="text-sm">{product.name}</p>
            {product.minPrice !== null && (
              <p className="text-sm font-medium">Rs. {product.minPrice.toLocaleString("en-PK")}</p>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
