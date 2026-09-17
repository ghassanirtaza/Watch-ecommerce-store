import { db } from "@/lib/db/client";
import { CategoryManager } from "@/components/admin/category-manager";

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } }, parent: true },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl">Categories</h1>
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          parentName: c.parent?.name ?? null,
          productCount: c._count.products,
        }))}
        allCategories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
