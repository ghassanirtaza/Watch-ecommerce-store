import type { MetadataRoute } from "next";
import { db } from "@/lib/db/client";

/**
 * Next.js App Router sitemap convention — served automatically at
 * /sitemap.xml. Per spec: crawlable product links, no accidental
 * indexing of admin/private pages (admin routes are excluded by never
 * appearing here, and also blocked in robots.ts).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  const [products, categories, pages] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
    }),
    db.category.findMany({ select: { slug: true } }),
    db.contentPage.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${baseUrl}/products/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${baseUrl}/category/${c.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const pageRoutes: MetadataRoute.Sitemap = pages.map((p) => ({
    url: `${baseUrl}/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly",
    priority: 0.3,
  }));

  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...pageRoutes];
}
