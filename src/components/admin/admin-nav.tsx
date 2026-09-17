"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/returns", label: "Returns" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="w-56 shrink-0 border-r border-[var(--color-border)] p-4">
      <p className="mb-6 text-xs text-[var(--color-text-muted)]">{userEmail}</p>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded px-3 py-2 text-sm ${
                  isActive ? "bg-[var(--color-bg-elevated)] text-[var(--color-gold)]" : "text-[var(--color-text-muted)]"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        onClick={handleSignOut}
        className="mt-6 text-sm text-[var(--color-text-muted)] underline"
      >
        Sign out
      </button>
    </nav>
  );
}
