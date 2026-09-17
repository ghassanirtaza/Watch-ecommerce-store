import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { db } from "@/lib/db/client";
import { toggleWishlistItem, enableWishlistSharing } from "@/domain/customers/wishlist";

async function getOwnCustomerId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const profile = await db.customerProfile.findUnique({ where: { userId: session.user.id } });
  return profile?.id ?? null;
}

export async function POST(request: NextRequest) {
  const customerId = await getOwnCustomerId();
  if (!customerId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.productId) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const result = await toggleWishlistItem(customerId, body.productId, body.variantId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update wishlist" }, { status: 400 });
  }
}

export async function PUT() {
  // Enable sharing — separate verb since it's a distinct action from toggling an item.
  const customerId = await getOwnCustomerId();
  if (!customerId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const shareToken = await enableWishlistSharing(customerId);
    return NextResponse.json({ shareToken });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not enable sharing" }, { status: 400 });
  }
}
