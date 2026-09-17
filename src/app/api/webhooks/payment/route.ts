import { NextRequest, NextResponse } from "next/server";
import { getPaymentProvider } from "@/domain/payments/adapters";
import { confirmCardPayment } from "@/domain/orders/confirmation";

/**
 * Per AI_CONTEXT.md: payment webhooks require signature verification +
 * idempotency key, duplicate delivery must be a no-op. Signature check
 * happens inside provider.handleWebhook() before we trust anything in
 * the payload — this route never reads the body as JSON before that
 * verification succeeds.
 *
 * NOTE: getPaymentProvider("CARD") currently returns
 * UnimplementedCardPaymentProvider (see domain/payments/adapters.ts) —
 * this route is wired and ready but will throw until a real gateway is
 * selected and implemented. Not a bug; documented in AI_CONTEXT.md open
 * decisions.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature") ?? "";

  try {
    const provider = getPaymentProvider("CARD");
    const result = await provider.handleWebhook(rawBody, signature);

    const orderId = result.providerRef.split("_")[1]; // adapter-specific parsing —
    // real gateway integration should carry orderId explicitly in the
    // webhook payload rather than parsing it out of a ref string; this
    // is a placeholder shape until that adapter exists.

    if (!orderId) {
      return NextResponse.json({ error: "Could not resolve order from webhook" }, { status: 400 });
    }

    await confirmCardPayment({
      orderId,
      providerRef: result.providerRef,
      status: result.status === "REFUNDED" ? "CAPTURED" : result.status,
      idempotencyKey: result.providerRef, // real gateways provide a
      // dedicated event/transaction ID for this — using providerRef as
      // a placeholder until the concrete adapter exists.
      rawResponse: rawBody,
    });

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Payment webhook error:", err);
    // Return 400 rather than 500 for signature failures so the gateway
    // doesn't endlessly retry a request that will never succeed — but
    // log loudly, since a failing webhook handler silently means orders
    // never confirm.
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 400 });
  }
}
