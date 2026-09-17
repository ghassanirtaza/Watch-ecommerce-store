"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAKISTAN_CITIES } from "@/lib/validation/checkout";

type PaymentMethod = "CARD" | "COD";

export function CheckoutForm({ cartId }: { cartId: string }) {
  const router = useRouter();

  const [guestEmail, setGuestEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState(PAKISTAN_CITIES[0]);
  const [postalCode, setPostalCode] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneLooksValid = /^(\+92|0)3\d{9}$/.test(phone);

  async function handleSendOtp() {
    setOtpError(null);
    setOtpLoading(true);
    try {
      const res = await fetch("/api/checkout/cod-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not send code");
      setOtpSent(true);
      // In non-production, the API includes the code directly for
      // testing (see cod-otp/send/route.ts) — surface it so the flow
      // is testable end-to-end without a real SMS provider wired yet.
      if (body.code) {
        setOtpError(`Dev mode — code: ${body.code}`);
      }
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError(null);
    setOtpLoading(true);
    try {
      const res = await fetch("/api/checkout/cod-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: otpCode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Incorrect code");
      setPhoneVerified(true);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (paymentMethod === "COD" && !phoneVerified) {
      setError("Please verify your phone number to pay with Cash on Delivery");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId,
          guestEmail: guestEmail || undefined,
          shippingAddress: { fullName, phone, addressLine1, addressLine2: addressLine2 || undefined, city, postalCode: postalCode || undefined },
          paymentMethod,
          couponCode: couponCode || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Checkout failed");

      if (body.requiresPayment && body.redirectUrl) {
        window.location.href = body.redirectUrl;
      } else {
        router.push(`/order-confirmation/${body.orderNumber}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Contact
        </legend>
        <input
          type="email"
          placeholder="Email"
          required
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Shipping Address
        </legend>
        <input
          placeholder="Full name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <input
          placeholder="Phone (03xxxxxxxxx)"
          required
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setPhoneVerified(false);
            setOtpSent(false);
          }}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <input
          placeholder="Address"
          required
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <input
          placeholder="Apartment, floor, etc. (optional)"
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <div className="flex gap-3">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          >
            {PAKISTAN_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            placeholder="Postal code (optional)"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Payment Method
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === "COD"}
            onChange={() => setPaymentMethod("COD")}
          />
          Cash on Delivery
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="paymentMethod"
            checked={paymentMethod === "CARD"}
            onChange={() => setPaymentMethod("CARD")}
          />
          Card
        </label>

        {paymentMethod === "COD" && (
          <div className="rounded border border-[var(--color-border)] p-3">
            {phoneVerified ? (
              <p className="text-sm text-[var(--color-success)]">Phone verified ✓</p>
            ) : (
              <div>
                <p className="mb-2 text-sm text-[var(--color-text-muted)]">
                  Cash on Delivery requires phone verification.
                </p>
                {!otpSent ? (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={!phoneLooksValid || otpLoading}
                    className="rounded border border-[var(--color-gold)] px-3 py-1.5 text-sm text-[var(--color-gold)] disabled:opacity-50"
                  >
                    {otpLoading ? "Sending..." : "Send verification code"}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <input
                      placeholder="6-digit code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-32 rounded border border-[var(--color-border)] bg-transparent p-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otpCode.length !== 6 || otpLoading}
                      className="rounded border border-[var(--color-gold)] px-3 py-1.5 text-sm text-[var(--color-gold)] disabled:opacity-50"
                    >
                      Verify
                    </button>
                  </div>
                )}
                {otpError && <p className="mt-2 text-xs text-[var(--color-text-muted)]">{otpError}</p>}
              </div>
            )}
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Coupon
        </legend>
        <input
          placeholder="Coupon code (optional)"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
      </fieldset>

      {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-[var(--color-gold)] py-3 text-sm font-medium text-[var(--color-bg)] disabled:opacity-60"
      >
        {submitting ? "Placing order..." : "Place Order"}
      </button>
    </form>
  );
}
