import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { ProductForm } from "@/components/admin/product-form";
import { VariantManager } from "@/components/admin/variant-manager";
import { ProductImageManager } from "@/components/admin/product-image-manager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        categories: true,
        variants: { include: { attributeValues: { include: { attribute: true } }, inventory: true } },
        images: { orderBy: { sortOrder: "asc" }, include: { mediaAsset: true } },
      },
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!product) notFound();

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl">{product.name}</h1>
        <span className="text-xs text-[var(--color-text-muted)]">{product.status}</span>
      </div>

      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        existing={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          shortDescription: product.shortDescription,
          longDescription: product.longDescription,
          movementType: product.movementType,
          caseMaterial: product.caseMaterial,
          caseDiameterMm: product.caseDiameterMm,
          waterResistanceM: product.waterResistanceM,
          warrantyMonths: product.warrantyMonths,
          hasAuthCertificate: product.hasAuthCertificate,
          boxAndPapers: product.boxAndPapers,
          categoryIds: product.categories.map((c) => c.categoryId),
        }}
      />

      <div className="mt-10">
        <ProductImageManager
          productId={product.id}
          images={product.images.map((img) => ({ id: img.id, url: img.mediaAsset.url, altText: img.mediaAsset.altText }))}
        />
      </div>

      <div className="mt-10">
        <VariantManager
          productId={product.id}
          variants={product.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            variantName: v.variantName,
            price: Number(v.price),
            isActive: v.isActive,
            attributes: v.attributeValues.map((av) => ({ key: av.attribute.key, value: av.attribute.value })),
            stock: v.inventory.reduce((sum, inv) => sum + inv.availableQuantity, 0),
          }))}
        />
      </div>
    </div>
  );
}
