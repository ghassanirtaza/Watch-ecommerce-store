// Courier provider abstraction — mirrors the PaymentProvider pattern.
// Flagged as a missing piece in architecture review: shipping/courier had
// no equivalent adapter despite being just as central to Pakistan
// fulfillment as payment. Implement one adapter per courier (TCS,
// Leopards, PostEx, M&P, etc.) once selected.

export interface CreateShipmentInput {
  orderId: string;
  isCod: boolean;
  codAmount?: number;
  shippingAddress: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    postalCode?: string;
  };
}

export interface CreateShipmentResult {
  waybillNumber: string;
  trackingUrl?: string;
}

export interface CourierWebhookResult {
  waybillNumber: string;
  status:
    | "PICKED_UP"
    | "IN_TRANSIT"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "FAILED_DELIVERY"
    | "RETURNED_TO_ORIGIN";
  codRemittedAmount?: number; // present when courier reports cash remittance
  rawPayload: unknown;
}

export interface CourierProvider {
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;
  voidShipment(waybillNumber: string): Promise<void>;
  handleWebhook(rawBody: string, signatureHeader: string): Promise<CourierWebhookResult>;
}
