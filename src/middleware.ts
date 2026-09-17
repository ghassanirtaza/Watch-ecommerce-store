import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

/**
 * This middleware only checks "is there a valid session" and "is this
 * an admin user" — it is a coarse UX gate to avoid rendering the admin
 * shell for obviously-unauthenticated requests. It is NOT the
 * authorization boundary. Every admin server action / route handler
 * must still independently call requirePermission() from
 * src/lib/auth/session.ts. Do not remove those checks because
 * middleware "already handled it" — middleware can be bypassed by
 * calling server actions directly.
 */
export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  // The login page itself must be exempt — otherwise an
  // unauthenticated request to /admin/login redirects to
  // /admin/login?redirect=/admin/login, which redirects to itself
  // forever. This bug existed from Phase 1 until caught here in Phase
  // 9 while actually building the login page — middleware logic
  // written before the page it protects existed was never exercised
  // against the real case.
  if (request.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!session.user.isAdminUser) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
  // Next.js Middleware defaults to the Edge runtime, which cannot open
  // a standard Postgres connection. auth.api.getSession() goes through
  // Better Auth's Prisma adapter (a real DB query on any cache miss —
  // see the 5-minute cookieCache in lib/auth/config.ts), so this must
  // run on the Node.js runtime or it will fail/flake on Vercel. Stable
  // as of Next.js 15.5 — no experimental flag required.
  runtime: "nodejs",
};
