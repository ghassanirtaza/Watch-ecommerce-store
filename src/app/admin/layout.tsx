import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Layouts wrap the login page too (Next.js nests by path), so we
  // read the session here only to decide whether to render the full
  // admin chrome — the actual access control is middleware.ts, this
  // is presentation only.
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.isAdminUser) {
    // Login page (or a request mid-redirect) — no sidebar chrome.
    return <main id="main-content">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <AdminNav userEmail={session.user.email} />
      <main id="main-content" className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
