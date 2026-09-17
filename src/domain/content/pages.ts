import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { sanitizeRichText } from "@/lib/validation/sanitize";
import { slugSchema } from "@/lib/validation/product";

const upsertContentPageSchema = z.object({
  id: z.string().cuid().optional(),
  slug: slugSchema,
  title: z.string().min(1).max(150),
  body: z.string().min(1).max(50000),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});

export async function upsertContentPage(input: z.infer<typeof upsertContentPageSchema>) {
  const session = await requirePermission(input.id ? "content.update" : "content.create");
  const data = upsertContentPageSchema.parse(input);

  const sanitizedBody = sanitizeRichText(data.body);

  if (data.id) {
    const before = await db.contentPage.findUnique({ where: { id: data.id } });
    if (!before) throw new Error("Page not found");

    if (data.slug !== before.slug) {
      const clash = await db.contentPage.findUnique({ where: { slug: data.slug } });
      if (clash) throw new Error(`Slug "${data.slug}" is already in use`);
      // Automatic redirect on slug change, consistent with the product
      // slug-change rule — a static page URL changing shouldn't 404
      // either.
      await db.redirect.create({ data: { fromPath: `/${before.slug}`, toPath: `/${data.slug}` } });
    }

    const updated = await db.contentPage.update({
      where: { id: data.id },
      data: { slug: data.slug, title: data.title, body: sanitizedBody, seoTitle: data.seoTitle, seoDescription: data.seoDescription },
    });

    await recordAuditLog({
      actorId: session.user.id,
      action: "content_page.updated",
      resource: `ContentPage:${updated.id}`,
      before: { title: before.title },
      after: { title: updated.title },
    });

    return updated;
  }

  const existing = await db.contentPage.findUnique({ where: { slug: data.slug } });
  if (existing) throw new Error(`Slug "${data.slug}" is already in use`);

  const created = await db.contentPage.create({
    data: { slug: data.slug, title: data.title, body: sanitizedBody, seoTitle: data.seoTitle, seoDescription: data.seoDescription, status: "DRAFT" },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "content_page.created",
    resource: `ContentPage:${created.id}`,
    after: created,
  });

  return created;
}

export async function publishContentPage(pageId: string) {
  const session = await requirePermission("content.publish");
  const updated = await db.contentPage.update({ where: { id: pageId }, data: { status: "PUBLISHED" } });
  await recordAuditLog({ actorId: session.user.id, action: "content_page.published", resource: `ContentPage:${pageId}` });
  return updated;
}

export async function getPublishedPageBySlug(slug: string) {
  return db.contentPage.findUnique({ where: { slug, status: "PUBLISHED" } });
}
