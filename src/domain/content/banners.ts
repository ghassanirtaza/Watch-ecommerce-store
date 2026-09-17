import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";

const createBannerSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  ctaLabel: z.string().max(40).optional(),
  ctaUrl: z.string().max(500).optional(),
  mediaAssetId: z.string().cuid(),
  startAt: z.coerce.date().optional(),
  endAt: z.coerce.date().optional(),
});

export async function createBanner(input: z.infer<typeof createBannerSchema>) {
  const session = await requirePermission("content.create");
  const data = createBannerSchema.parse(input);

  if (data.startAt && data.endAt && data.startAt >= data.endAt) {
    throw new Error("Start date must be before end date");
  }

  const banner = await db.banner.create({ data: { ...data, status: "DRAFT" } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "banner.created",
    resource: `Banner:${banner.id}`,
    after: banner,
  });

  return banner;
}

export async function publishBanner(bannerId: string) {
  const session = await requirePermission("content.publish");

  const before = await db.banner.findUnique({ where: { id: bannerId } });
  if (!before) throw new Error("Banner not found");

  const isScheduled = before.startAt && before.startAt.getTime() > Date.now();

  const updated = await db.banner.update({
    where: { id: bannerId },
    data: { status: isScheduled ? "SCHEDULED" : "PUBLISHED" },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "banner.published",
    resource: `Banner:${bannerId}`,
  });

  return updated;
}

/**
 * Active banners for the storefront to render — resolves scheduling
 * (startAt/endAt window) and status server-side, storefront never has
 * to reason about "is this banner currently live" itself.
 */
export async function getActiveBanners() {
  const now = new Date();
  return db.banner.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
    },
    include: { mediaAsset: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function archiveBanner(bannerId: string) {
  const session = await requirePermission("content.update");

  await db.banner.update({ where: { id: bannerId }, data: { status: "ARCHIVED" } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "banner.archived",
    resource: `Banner:${bannerId}`,
  });
}
