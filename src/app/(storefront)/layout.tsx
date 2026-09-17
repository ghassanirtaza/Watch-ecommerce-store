/**
 * Shared layout for every route in the (storefront) group. Provides
 * the <main id="main-content"> landmark that the skip link in
 * app/layout.tsx targets, so every current and future storefront page
 * gets this for free instead of needing it added by hand per page.
 * Header/footer/nav components belong here once built — not yet
 * added, this phase focused on the accessibility landmark itself.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return <main id="main-content">{children}</main>;
}
