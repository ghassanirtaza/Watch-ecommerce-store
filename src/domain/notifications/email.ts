import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { getUnnotifiedSubscribersForVariant, markSubscribersNotified } from "@/domain/products/back-in-stock";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Every send attempt is logged via EmailLog regardless of success —
 * this is what makes "email delivery fails" (an explicit edge case in
 * the original spec) debuggable rather than silently swallowed.
 */
async function sendEmail(params: { to: string; subject: string; template: string; html: string }) {
  try {
    await resend.emails.send({
      from: "Watch Store <orders@example.com>", // replace with the real verified sending domain before launch
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    await db.emailLog.create({
      data: { to: params.to, subject: params.subject, template: params.template, status: "SENT" },
    });
    return { sent: true };
  } catch (err) {
    await db.emailLog.create({
      data: { to: params.to, subject: params.subject, template: params.template, status: "FAILED" },
    });
    console.error(`Email send failed (${params.template}) to ${params.to}:`, err);
    return { sent: false };
  }
}

/**
 * Called from domain/orders/confirmation.ts on order confirmation and
 * from domain/orders/checkout.ts on COD order creation. Not calling
 * this yet from either — see AI_CONTEXT.md Phase 5 remaining work; the
 * function exists and is ready to be wired in.
 */
export async function sendOrderConfirmationEmail(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, customer: { include: { user: true } } },
  });
  if (!order) return;

  const to = order.customer?.user.email ?? order.guestEmail;
  if (!to) return;

  const itemsHtml = order.items
    .map((item) => `<li>${item.productNameSnap} (${item.variantNameSnap}) × ${item.quantity}</li>`)
    .join("");

  return sendEmail({
    to,
    subject: `Order Confirmed — #${order.orderNumber}`,
    template: "order_confirmed",
    html: `<h1>Thank you for your order</h1><p>Order #${order.orderNumber}</p><ul>${itemsHtml}</ul><p>Total: Rs. ${Number(order.grandTotal).toLocaleString("en-PK")}</p>`,
  });
}

export async function sendShipmentUpdateEmail(orderId: string, status: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { customer: { include: { user: true } } },
  });
  if (!order) return;

  const to = order.customer?.user.email ?? order.guestEmail;
  if (!to) return;

  return sendEmail({
    to,
    subject: `Order #${order.orderNumber} — ${status.replace(/_/g, " ")}`,
    template: "shipment_update",
    html: `<p>Your order #${order.orderNumber} status: ${status.replace(/_/g, " ")}</p>`,
  });
}

/**
 * Wires the back-in-stock trigger that was explicitly flagged as
 * incomplete in Phase 3 — call this from
 * domain/inventory/adjustment.ts after a RESTOCK transaction takes a
 * variant's available quantity from 0 to >0. Not called automatically
 * yet; see AI_CONTEXT.md.
 */
export async function notifyBackInStockSubscribers(variantId: string) {
  const subscribers = await getUnnotifiedSubscribersForVariant(variantId);
  if (subscribers.length === 0) return { notified: 0 };

  const variant = await db.productVariant.findUnique({
    where: { id: variantId },
    include: { product: true },
  });
  if (!variant) return { notified: 0 };

  const sentIds: string[] = [];
  for (const sub of subscribers) {
    const result = await sendEmail({
      to: sub.email,
      subject: `Back in Stock: ${variant.product.name}`,
      template: "back_in_stock",
      html: `<p>${variant.product.name} (${variant.variantName}) is back in stock.</p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/products/${variant.product.slug}">View Product</a>`,
    });
    if (result.sent) sentIds.push(sub.id);
  }

  if (sentIds.length > 0) {
    await markSubscribersNotified(sentIds);
  }

  return { notified: sentIds.length };
}

/**
 * Called from Better Auth's sendResetPassword callback
 * (lib/auth/config.ts) — was missing until now, meaning
 * forgetPassword() would have succeeded silently on the server side
 * but never actually delivered anything to the user.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: "Reset your password",
    template: "password_reset",
    html: `<p>Click the link below to reset your password. This link expires shortly.</p><a href="${resetUrl}">Reset Password</a>`,
  });
}

/**
 * Called from Better Auth's emailVerification.sendVerificationEmail
 * callback (lib/auth/config.ts). Discovered missing while writing
 * this phase's docs — requireEmailVerification: true was set with no
 * way to ever send the email that satisfies it, which would have
 * blocked every registration outright, not just degraded a feature.
 */
export async function sendVerificationEmail(to: string, verificationUrl: string) {
  return sendEmail({
    to,
    subject: "Verify your email",
    template: "email_verification",
    html: `<p>Click the link below to verify your email address.</p><a href="${verificationUrl}">Verify Email</a>`,
  });
}
