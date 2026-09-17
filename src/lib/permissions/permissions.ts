// Granular permission keys. Seed these into the Permission table and
// assign to roles via RolePermission — see prisma/seed.ts (to be written
// in Phase 1).

export const PERMISSIONS = {
  products: ["read", "create", "update", "archive"],
  inventory: ["read", "adjust"],
  orders: ["read", "update", "cancel"],
  payments: ["refund"],
  customers: ["read", "update"],
  content: ["read", "create", "update", "publish"],
  coupons: ["read", "create", "update"],
  settings: ["read", "update"],
  admins: ["create", "disable"],
  roles: ["assign"],
} as const;

export type PermissionDomain = keyof typeof PERMISSIONS;

export function permissionKey(domain: PermissionDomain, action: string): string {
  return `${domain}.${action}`;
}

// Fixed roles for MVP — custom role editor is Phase 2. Do not build a
// role-editing UI against this; it's a hardcoded mapping.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  CUSTOMER: [],
  SUPPORT_AGENT: ["customers.read", "orders.read"],
  CONTENT_MANAGER: [
    "content.read",
    "content.create",
    "content.update",
    "content.publish",
  ],
  ORDER_MANAGER: ["orders.read", "orders.update", "orders.cancel", "payments.refund"],
  STORE_MANAGER: [
    "products.read",
    "products.create",
    "products.update",
    "products.archive",
    "inventory.read",
    "inventory.adjust",
    "orders.read",
    "orders.update",
    "customers.read",
    "coupons.read",
    "coupons.create",
    "coupons.update",
  ],
  SUPER_ADMIN: ["*"], // full access — expand at authorization-check time
};

/**
 * Server-side authorization check. Never trust a frontend permission
 * check as the actual gate — this must run on every protected request.
 */
export function roleHasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(permission);
}
