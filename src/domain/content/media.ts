import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";
import { confirmMediaUpload } from "@/lib/storage/cloudinary";

const registerMediaSchema = z.object({
  publicId: z.string().min(1),
  altText: z.string().min(1, "Alt text is required for accessibility").max(300),
});

/**
 * Two-step upload flow: (1) client uploads directly to Cloudinary using
 * a signed request, (2) client calls this with the resulting publicId
 * to register it in our own MediaAsset table — at which point we
 * re-verify the actual file (format/size) server-side and require alt
 * text before the asset becomes usable anywhere in the CMS/catalog.
 */
export async function registerMediaAsset(input: z.infer<typeof registerMediaSchema>) {
  const session = await requirePermission("content.create");
  const data = registerMediaSchema.parse(input);

  const verified = await confirmMediaUpload(data.publicId);

  const asset = await db.mediaAsset.create({
    data: {
      publicId: verified.publicId,
      url: verified.url,
      width: verified.width,
      height: verified.height,
      format: verified.format,
      sizeBytes: verified.sizeBytes,
      altText: data.altText,
      createdById: session.user.id,
    },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "media.uploaded",
    resource: `MediaAsset:${asset.id}`,
    after: { publicId: asset.publicId, format: asset.format },
  });

  return asset;
}

export async function deleteMediaAsset(mediaAssetId: string) {
  const session = await requirePermission("content.update");

  const usageInProducts = await db.productImage.count({ where: { mediaAssetId } });
  const usageInBanners = await db.banner.count({ where: { mediaAssetId } });
  const usageInReviews = await db.reviewImage.count({ where: { mediaAssetId } });

  const totalUsage = usageInProducts + usageInBanners + usageInReviews;
  if (totalUsage > 0) {
    throw new Error(
      `Cannot delete: media asset is used in ${totalUsage} place(s). Remove those references first.`
    );
  }

  const before = await db.mediaAsset.findUnique({ where: { id: mediaAssetId } });
  await db.mediaAsset.delete({ where: { id: mediaAssetId } });

  await recordAuditLog({
    actorId: session.user.id,
    action: "media.deleted",
    resource: `MediaAsset:${mediaAssetId}`,
    before,
  });
}
