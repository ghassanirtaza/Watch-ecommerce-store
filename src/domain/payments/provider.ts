// Payment provider abstraction. Business logic (domain/orders,
// domain/payments) must never depend on a specific gateway's API shape.
// Implement one concrete adapter per gateway once selected — see
// docs/AI_CONTEXT.md open decision on gateway choice.

export interface CreatePaymentInput {
  orderId: string;
  amount: number; // smallest currency unit handling done inside adapter
  currency: "PKR";
  idempotencyKey: string;
}

export interface CreatePaymentResult {
  providerRef: string;
  redirectUrl?: string; // for hosted checkout flows
  clientSecret?: string; // for tokenized/embedded flows
}

export interface VerifyPaymentResult {
  providerRef: string;
  status: "AUTHORIZED" | "CAPTURED" | "FAILED";
  rawResponse: unknown;
}

export interface RefundPaymentInput {
  providerRef: string;
  amount: number;
  reason?: string;
}

export interface WebhookHandleResult {
  providerRef: string;
  status: "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";
  isDuplicate: boolean; // adapter/service must dedupe via idempotency key
}

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(providerRef: string): Promise<VerifyPaymentResult>;
  refundPayment(input: RefundPaymentInput): Promise<{ refundRef: string }>;
  /**
   * Must verify signature before returning. Caller is responsible for
   * enforcing idempotency at the database level (unique constraint on
   * PaymentTransaction.idempotencyKey) — never trust isDuplicate alone.
   */
  handleWebhook(rawBody: string, signatureHeader: string): Promise<WebhookHandleResult>;
}
