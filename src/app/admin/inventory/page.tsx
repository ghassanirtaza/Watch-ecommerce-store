import { db } from "@/lib/db/client";
import { InventoryTable } from "@/components/admin/inventory-table";
import { BulkImportForm } from "@/components/admin/bulk-import-form";

export default async function AdminInventoryPage() {
  const [inventory, primaryLocation] = await Promise.all([
    db.inventory.findMany({
      include: { variant: { include: { product: true } } },
      orderBy: { availableQuantity: "asc" },
    }),
    db.inventoryLocation.findFirst({ where: { isPrimary: true } }),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl">Inventory</h1>

      {!primaryLocation ? (
        <p className="text-sm text-[var(--color-error)]">
          No primary inventory location configured — run the seed script first.
        </p>
      ) : (
        <>
          <InventoryTable
            locationId={primaryLocation.id}
            rows={inventory.map((inv) => ({
              variantId: inv.variantId,
              sku: inv.variant.sku,
              productName: inv.variant.product.name,
              variantName: inv.variant.variantName,
              availableQuantity: inv.availableQuantity,
              reservedQuantity: inv.reservedQuantity,
              lowStockThreshold: inv.lowStockThreshold,
            }))}
          />

          <div className="mt-10">
            <BulkImportForm locationId={primaryLocation.id} />
          </div>
        </>
      )}
    </div>
  );
}
