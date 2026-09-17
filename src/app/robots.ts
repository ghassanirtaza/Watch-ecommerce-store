import type { MetadataRoute } from "next";

/**
 * Per spec: "no accidental indexing of admin/private pages." Blocks
 * admin, account, checkout, cart, and API routes explicitly rather
 * than relying on noindex meta tags alone — belt and suspenders, since
 * a misconfigured page-level meta tag shouldn't be the only thing
 * standing between a crawler and the admin panel.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/checkout", "/cart", "/api", "/order-confirmation"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
