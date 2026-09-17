import { headers } from "next/headers";
import { auth } from "./config";
import { db } from "@/lib/db/client";
import { roleHasPermission } from "@/lib/permissions/permissions";

export class UnauthenticatedError extends Error {}
export class UnauthorizedError extends Error {}

/**
 * Every protected server action / route handler must call this (or
 * requirePermission below) at the top. Frontend permission checks are
 * UX only — they never substitute for this.
 */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new UnauthenticatedError("Not authenticated");
  }
  return session;
}

/**
 * Full authorization pipeline per docs/AI_CONTEXT.md:
 * authentication -> permission check -> (caller adds ownership/business
 * rule checks after this returns).
 */
export async function requirePermission(permission: string) {
  const session = await requireSession();

  const userRoles = await db.userRole.findMany({
    where: { userId: session.user.id },
    include: { role: true },
  });

  const hasPermission = userRoles.some((ur) => roleHasPermission(ur.role.name, permission));

  if (!hasPermission) {
    throw new UnauthorizedError(`Missing permission: ${permission}`);
  }

  return session;
}

/**
 * Ownership check helper. Example usage:
 *   const session = await requireSession();
 *   requireOwnership(order.customerId, session.user.customerProfileId);
 * Reject rather than silently scope — an authenticated user requesting
 * another user's resource is a hard failure, not a filtered result.
 */
export function requireOwnership(resourceOwnerId: string | null, requesterId: string) {
  if (resourceOwnerId !== requesterId) {
    throw new UnauthorizedError("Not the resource owner");
  }
}
