import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { computeCartTotals } from "@/domain/cart/service";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get("guest_cart_id")?.value;

  if (!cartId) {
    redirect("/");
  }

  const totals = await computeCartTotals(cartId).catch(() => null);

  if (!totals || totals.lineItems.length === 0) {
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl">Checkout</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <CheckoutForm cartId={cartId} />

        <aside className="h-fit rounded border border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Order Summary
          </h2>
          {totals.lineItems.map((item) => (
            <div key={item.cartItemId} className="flex justify-between py-2 text-sm">
              <span>
                {item.variantName} × {item.quantity}
              </span>
              <span>Rs. {item.lineTotal.toLocaleString("en-PK")}</span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t border-[var(--color-border)] pt-3 font-medium">
            <span>Total</span>
            <span>Rs. {totals.estimatedTotal.toLocaleString("en-PK")}</span>
          </div>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Final total is recalculated at order confirmation.
          </p>
        </aside>
      </div>
    </div>
  );
}
