import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/config";
import { AccountNav } from "@/components/account/account-nav";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login?redirect=/account");
  }

  return (
    <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[180px_1fr]">
        <AccountNav />
        <div>{children}</div>
      </div>
    </main>
  );
}
