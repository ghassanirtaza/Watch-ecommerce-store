"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/lib/auth/client";

const NAV_ITEMS = [
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/wishlist", label: "Wishlist" },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <nav>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block rounded px-2 py-1.5 text-sm ${
                pathname.startsWith(item.href) ? "text-[var(--color-gold)]" : "text-[var(--color-text-muted)]"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      <button onClick={handleSignOut} className="mt-4 text-sm text-[var(--color-text-muted)] underline">
        Sign out
      </button>
    </nav>
  );
}
