import { db } from "@/lib/db/client";
import { ContentPageManager } from "@/components/admin/content-page-manager";
import { BannerManager } from "@/components/admin/banner-manager";

export default async function AdminContentPage() {
  const [pages, banners] = await Promise.all([
    db.contentPage.findMany({ orderBy: { updatedAt: "desc" } }),
    db.banner.findMany({ orderBy: { createdAt: "desc" }, include: { mediaAsset: true } }),
  ]);

  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="mb-6 text-xl">Content</h1>
        <ContentPageManager
          pages={pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, status: p.status }))}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg">Banners</h2>
        <BannerManager
          banners={banners.map((b) => ({
            id: b.id,
            title: b.title,
            status: b.status,
            imageUrl: b.mediaAsset?.url ?? null,
          }))}
        />
      </div>

      {/* Homepage section builder and navigation editor are still not
          built — same media-upload dependency as banners above, but
          scoped out of this pass to keep it reviewable. Banners were
          the simplest surface to wire first since they're a single
          flat model; the homepage builder's six section-type schemas
          (see domain/content/homepage.ts) warrant a dedicated pass. */}
      <div className="rounded border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-muted)]">
        Homepage section builder and navigation menus are not available
        in this admin build yet.
      </div>
    </div>
  );
}
