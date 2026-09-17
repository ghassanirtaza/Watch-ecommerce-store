import { z } from "zod";
import { db } from "@/lib/db/client";
import { requirePermission, requireSession } from "@/lib/auth/session";
import { recordAuditLog } from "@/lib/logging/audit";

/**
 * Typed defaults for every known setting key. Reading an unset key
 * returns its default rather than throwing — this is what makes it
 * safe for domain code (e.g. cod-verification.ts) to depend on
 * settings without every call site needing a null-check.
 */
const SETTING_DEFAULTS = {
  store_name: "Watch Store",
  support_email: "support@example.com",
  cod_order_value_cap_pkr: 100000,
  cod_failed_delivery_block_threshold: 3,
  guest_checkout_enabled: true,
  low_stock_default_threshold: 5,
  seo_default_title: "Premium Watches, Pakistan-wide",
  seo_default_description: "Shop premium watches with fast, free delivery across Pakistan.",
} as const;

type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof SETTING_DEFAULTS)[K]> {
  const row = await db.siteSetting.findUnique({ where: { key } });
  if (!row) return SETTING_DEFAULTS[key];
  return row.value as (typeof SETTING_DEFAULTS)[K];
}

export async function getAllSettings() {
  await requirePermission("settings.read");
  const rows = await db.siteSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...SETTING_DEFAULTS, ...stored };
}

const updateSettingSchema = z.object({
  key: z.enum([
    "store_name",
    "support_email",
    "cod_order_value_cap_pkr",
    "cod_failed_delivery_block_threshold",
    "guest_checkout_enabled",
    "low_stock_default_threshold",
    "seo_default_title",
    "seo_default_description",
  ]),
  value: z.unknown(),
});

export async function updateSetting(input: z.infer<typeof updateSettingSchema>) {
  const session = await requirePermission("settings.update");
  const data = updateSettingSchema.parse(input);

  const before = await db.siteSetting.findUnique({ where: { key: data.key } });

  const updated = await db.siteSetting.upsert({
    where: { key: data.key },
    update: { value: data.value as object, updatedById: session.user.id },
    create: { key: data.key, value: data.value as object, updatedById: session.user.id },
  });

  await recordAuditLog({
    actorId: session.user.id,
    action: "setting.updated",
    resource: `SiteSetting:${data.key}`,
    before: { value: before?.value ?? SETTING_DEFAULTS[data.key as SettingKey] },
    after: { value: data.value },
  });

  return updated;
}
