import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { sanitizeRichText } from "@/lib/validation/sanitize";

/**
 * Per AI_CONTEXT.md / docs/DESIGN_SYSTEM.md: MVP homepage is a FIXED
 * catalog of section types (Hero, Banner, Featured Category, Product
 * Carousel, Text Block, Newsletter Signup), each independently
 * orderable/visible/schedulable — no arbitrary drag-and-drop block
 * builder. The `content` Json field's shape is validated against the
 * schema for its `type` below; this is what keeps "fixed section
 * types" from silently becoming "arbitrary JSON blob" in practice.
 */

const heroContentSchema = z.object({
  headline: z.string().min(1).max(120),
  subheadline: z.string().max(200).optional(),
  mediaAssetId: z.string().cuid(),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: z.string().max(500).optional(),
});

const promotionalBannerContentSchema = z.object({
  mediaAssetId: z.string().cuid(),
  headline: z.string().max(120).optional(),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: z.string().max(500).optional(),
});

const featuredCategoryContentSchema = z.object({
  title: z.string().max(120).optional(),
  categoryIds: z.array(z.string().cuid()).min(1).max(8),
});

const productCarouselContentSchema = z.object({
  title: z.string().max(120).optional(),
  productIds: z.array(z.string().cuid()).min(1).max(20),
});

const textBlockContentSchema = z.object({
  heading: z.string().max(120).optional(),
  body: z.string().max(5000), // sanitized before persist
});

const newsletterSignupContentSchema = z.object({
  headline: z.string().max(120).optional(),
  subtext: z.string().max(300).optional(),
});

const CONTENT_SCHEMAS = {
  HERO: heroContentSchema,
  PROMOTIONAL_BANNER: promotionalBannerContentSchema,
  FEATURED_CATEGORY: featuredCategoryContentSchema,
  PRODUCT_CAROUSEL: productCarouselContentSchema,
  TEXT_BLOCK: textBlockContentSchema,
  NEWSLETTER_SIGNUP: newsletterSignupContentSchema,
} as const;

type SectionType = keyof typeof CONTENT_SCHEMAS;

const createSectionSchema = z.object({
  homepageId: z.string().cuid(),
  type: z.enum(["HERO", "PROMOTIONAL_BANNER", "FEATURED_CATEGORY", "PRODUCT_CAROUSEL", "TEXT_BLOCK", "NEWSLETTER_SIGNUP"]),
  content: z.record(z.string(), z.unknown()),
  scheduledAt: z.coerce.date().optional(),
});

export async function createHomepageSection(input: z.infer<typeof createSectionSchema>) {
  const session = await requirePermission("content.create");
  const data = createSectionSchema.parse(input);

  const schema = CONTENT_SCHEMAS[data.type as SectionType];
  const validatedContent = schema.parse(data.content);

  // Rich text within TEXT_BLOCK sections must be sanitized before
  // persist, same rule as product descriptions — no raw HTML/script
  // anywhere in admin content.
  const finalContent =
    data.type === "TEXT_BLOCK"
      ? { ...validatedContent, body: sanitizeRichText((validatedContent as { body: string }).body) }
      : validatedContent;

  const maxSortOrder = await db.contentSection.aggregate({
    where: { homepageId: data.homepageId },
    _max: { sortOrder: true },
  });

  const section = await db.contentSection.create({
    data: {
      homepageId: data.homepageId,
      type: data.type,
      content: finalContent as object,
      sortOrder: (maxSortOrder._max.sortOrder ?? -1) + 1,
      status: "DRAFT",
      scheduledAt: data.scheduledAt,
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "homepage_section.created",
    resource: `ContentSection:${section.id}`,
    after: { type: section.type },
  });

  return section;
}

const updateSectionSchema = z.object({
  id: z.string().cuid(),
  content: z.record(z.string(), z.unknown()).optional(),
  isVisible: z.boolean().optional(),
});

export async function updateHomepageSection(input: z.infer<typeof updateSectionSchema>) {
  const session = await requirePermission("content.update");
  const data = updateSectionSchema.parse(input);

  const before = await db.contentSection.findUnique({ where: { id: data.id } });
  if (!before) throw new Error("Section not found");

  let finalContent: object | undefined;
  if (data.content) {
    const schema = CONTENT_SCHEMAS[before.type as SectionType];
    const validated = schema.parse(data.content);
    finalContent =
      before.type === "TEXT_BLOCK"
        ? { ...validated, body: sanitizeRichText((validated as { body: string }).body) }
        : (validated as object);
  }

  const updated = await db.contentSection.update({
    where: { id: data.id },
    data: {
      content: finalContent,
      isVisible: data.isVisible,
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "homepage_section.updated",
    resource: `ContentSection:${data.id}`,
    before: { content: before.content },
    after: { content: updated.content },
  });

  return updated;
}

/**
 * Reorder is a single bulk operation, not N individual updates — per
 * spec, admin drags sections into a new order and the whole set
 * commits together.
 */
export async function reorderHomepageSections(updates: { id: string; sortOrder: number }[]) {
  const session = await requirePermission("content.update");

  await db.$transaction(
    updates.map((u) => db.contentSection.update({ where: { id: u.id }, data: { sortOrder: u.sortOrder } }))
  );

  await recordAuditLog({
    actorId: session.user.id,
    action: "homepage_section.reordered",
    resource: "ContentSection:bulk",
    after: updates,
  });
}

export async function publishHomepageSection(sectionId: string) {
  const session = await requirePermission("content.publish");

  const before = await db.contentSection.findUnique({ where: { id: sectionId } });
  if (!before) throw new Error("Section not found");

  const isScheduled = before.scheduledAt && before.scheduledAt.getTime() > Date.now();

  const updated = await db.contentSection.update({
    where: { id: sectionId },
    data: { status: isScheduled ? "SCHEDULED" : "PUBLISHED" },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "homepage_section.published",
    resource: `ContentSection:${sectionId}`,
  });

  // Global cache invalidation on publish — the homepage read path
  // (Phase 3-style storefront query, not yet written for the
  // homepage specifically) should be revalidated here once that
  // caching layer exists. Flagged rather than silently assumed.
  return updated;
}

/**
 * Rollback: revert to a previous version of a section's content. Per
 * spec, CMS needs "revert to previous version" for instant rollback.
 * MVP implementation: before/after values already captured in
 * AuditLog on every update — this reads the last AuditLog entry for
 * the resource and re-applies its `before` content rather than
 * maintaining a separate version-history table.
 */
export async function revertHomepageSectionToPreviousVersion(sectionId: string) {
  const session = await requirePermission("content.update");

  const lastChange = await db.auditLog.findFirst({
    where: { resource: `ContentSection:${sectionId}`, action: "homepage_section.updated" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastChange?.before) {
    throw new Error("No previous version found for this section");
  }

  const before = await db.contentSection.findUnique({ where: { id: sectionId } });
  const restoredContent = (lastChange.before as { content: unknown }).content;

  const updated = await db.contentSection.update({
    where: { id: sectionId },
    data: { content: restoredContent as object },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "homepage_section.reverted",
    resource: `ContentSection:${sectionId}`,
    before: { content: before?.content },
    after: { content: restoredContent },
  });

  return updated;
}
