import { cookies } from "next/headers";
import { computeCartTotals } from "@/domain/cart/service";
import { CartLineItem } from "@/components/cart/cart-line-item";

export default async function CartPage() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get("guest_cart_id")?.value;

  const totals = cartId ? await computeCartTotals(cartId).catch(() => null) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-xl">Your Cart</h1>

      {!totals || totals.lineItems.length === 0 ? (
        <div className="py-16 text-center">
          <p className="mb-4 text-[var(--color-text-muted)]">Your cart is empty</p>
          <a href="/shop" className="text-[var(--color-gold)] underline">
            Shop Best Sellers
          </a>
        </div>
      ) : (
        <div>
          <div className="divide-y divide-[var(--color-border)]">
            {totals.lineItems.map((item) => (
              <CartLineItem key={item.cartItemId} item={item} />
            ))}
          </div>

          <div className="mt-6 flex justify-between border-t border-[var(--color-border)] pt-4">
            <span className="font-medium">Subtotal</span>
            <span className="font-medium">Rs. {totals.subtotal.toLocaleString("en-PK")}</span>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Shipping and any discounts calculated at checkout.
          </p>

          <a
            href="/checkout"
            className="mt-6 block w-full rounded bg-[var(--color-gold)] py-3 text-center text-sm font-medium text-[var(--color-bg)]"
          >
            Proceed to Checkout
          </a>
        </div>
      )}
    </div>
  );
}
