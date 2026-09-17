import crypto from "crypto";
import type {
  PaymentProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentResult,
  RefundPaymentInput,
  WebhookHandleResult,
} from "./provider";

/**
 * COD is not really a "provider" in the gateway sense — there's no
 * external party to redirect to or verify against. This adapter exists
 * so COD flows through the same PaymentProvider interface as CARD,
 * keeping order-creation logic in domain/orders uniform regardless of
 * method.
 */
export class CodPaymentProvider implements PaymentProvider {
  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return { providerRef: `cod_${input.orderId}` };
  }

  async verifyPayment(providerRef: string): Promise<VerifyPaymentResult> {
    // COD has no "authorization" step — it's confirmed at order
    // creation and actually collected on delivery. Status here reflects
    // order confirmation, not cash collection (that's tracked via
    // Shipment.codRemittedAt/codRemittedAmount, not Payment status).
    return { providerRef, status: "AUTHORIZED", rawResponse: { method: "COD" } };
  }

  async refundPayment(input: RefundPaymentInput): Promise<{ refundRef: string }> {
    // COD "refund" is an operational/manual process (cash was never
    // captured electronically) — this just records the refund intent
    // for accounting; no external call is made.
    return { refundRef: `cod_refund_${crypto.randomUUID()}` };
  }

  async handleWebhook(): Promise<WebhookHandleResult> {
    throw new Error("COD provider does not receive webhooks");
  }
}

/**
 * PLACEHOLDER — no card gateway has been selected yet (see
 * AI_CONTEXT.md open decision: needs Pakistan merchant onboarding,
 * settlement terms, 3DS support, transaction fees verified). This
 * class exists purely so the rest of the checkout/order code can be
 * built and tested against the PaymentProvider interface now, without
 * blocking on that external decision.
 *
 * DO NOT deploy this to production — every method throws. Replace with
 * a real adapter (e.g. a Stripe-like or local Pakistani gateway
 * implementation) that actually calls the provider's API and verifies
 * webhook signatures using their SDK/shared secret.
 */
export class UnimplementedCardPaymentProvider implements PaymentProvider {
  async createPayment(): Promise<CreatePaymentResult> {
    throw new Error(
      "No card payment gateway is configured yet — see docs/AI_CONTEXT.md open decisions"
    );
  }
  async verifyPayment(): Promise<VerifyPaymentResult> {
    throw new Error("No card payment gateway is configured yet");
  }
  async refundPayment(): Promise<{ refundRef: string }> {
    throw new Error("No card payment gateway is configured yet");
  }
  async handleWebhook(): Promise<WebhookHandleResult> {
    throw new Error("No card payment gateway is configured yet");
  }
}

export function getPaymentProvider(method: "CARD" | "COD"): PaymentProvider {
  if (method === "COD") return new CodPaymentProvider();
  return new UnimplementedCardPaymentProvider();
}
