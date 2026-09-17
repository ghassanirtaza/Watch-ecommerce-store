"use client";

import { useState } from "react";
import { forgetPassword } from "@/lib/auth/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await forgetPassword({ email, redirectTo: "/reset-password" });
    } finally {
      // Always show the same success state regardless of whether the
      // email exists — don't let this endpoint be used to enumerate
      // registered accounts.
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-xl">Reset Password</h1>

      {sent ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          If an account exists for that email, a reset link has been sent.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[var(--color-gold)] py-2.5 text-sm font-medium text-[var(--color-bg)] disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      )}
    </div>
  );
}
