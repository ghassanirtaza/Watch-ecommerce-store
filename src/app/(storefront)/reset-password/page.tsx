"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("This reset link is invalid or has expired.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await resetPassword({ newPassword: password, token });
      if (result.error) {
        setError(result.error.message ?? "Could not reset password");
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
        <p className="text-sm text-[var(--color-error)]">This reset link is invalid or has expired.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
        <p className="text-sm text-[var(--color-success)]">Password updated — redirecting to login...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <h1 className="mb-6 text-xl">Set New Password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="New password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[var(--color-gold)] py-2.5 text-sm font-medium text-[var(--color-bg)] disabled:opacity-60"
        >
          {loading ? "Saving..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
