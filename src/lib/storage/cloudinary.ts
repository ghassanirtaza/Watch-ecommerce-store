import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Server-side signed-upload pattern: the browser uploads directly to
 * Cloudinary using a signature we generate here, so the API secret
 * never reaches the client. Upload security requirements from
 * AI_CONTEXT.md (MIME allowlist, size limit) are enforced via the
 * upload preset configuration in the Cloudinary dashboard AND
 * revalidated server-side in confirmMediaUpload below — never trust
 * the client's reported file type/size alone.
 */
export function createSignedUploadParams(folder: string) {
  const timestamp = Math.round(Date.now() / 1000);

  const paramsToSign = {
    timestamp,
    folder,
    // Restrict what the client is allowed to do with this signature —
    // do not allow arbitrary transformation params from the client.
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET as string
  );

  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
  };
}

const ALLOWED_FORMATS = new Set(["jpg", "jpeg", "png", "webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB, matches review-image limit from spec

/**
 * Called after the client reports a successful direct upload. We
 * re-fetch the asset's actual metadata from Cloudinary rather than
 * trusting whatever the client tells us about format/size — the
 * client-reported values are not authorization.
 */
export async function confirmMediaUpload(publicId: string) {
  const resource = await cloudinary.api.resource(publicId);

  if (!ALLOWED_FORMATS.has(resource.format)) {
    await cloudinary.uploader.destroy(publicId);
    throw new Error(`Rejected upload: format "${resource.format}" not allowed`);
  }

  if (resource.bytes > MAX_BYTES) {
    await cloudinary.uploader.destroy(publicId);
    throw new Error(`Rejected upload: file exceeds ${MAX_BYTES / 1024 / 1024}MB limit`);
  }

  return {
    publicId: resource.public_id as string,
    url: resource.secure_url as string,
    width: resource.width as number,
    height: resource.height as number,
    format: resource.format as string,
    sizeBytes: resource.bytes as number,
  };
}
