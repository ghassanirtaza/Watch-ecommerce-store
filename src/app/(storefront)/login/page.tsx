"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signUp } from "@/lib/auth/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong");
        return;
      }

      const redirectTo = searchParams.get("redirect") ?? "/account/orders";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex gap-4 text-sm">
        <button
          onClick={() => setMode("login")}
          className={mode === "login" ? "text-[var(--color-gold)]" : "text-[var(--color-text-muted)]"}
        >
          Log In
        </button>
        <button
          onClick={() => setMode("register")}
          className={mode === "register" ? "text-[var(--color-gold)]" : "text-[var(--color-text-muted)]"}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" && (
          <input
            placeholder="Full name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
          />
        )}
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-[var(--color-border)] bg-transparent p-2.5 text-sm"
        />
        <input
          type="password"
          placeholder="Password"
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
          {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
        </button>
        {mode === "login" && (
          <a href="/forgot-password" className="block text-center text-xs text-[var(--color-text-muted)] underline">
            Forgot password?
          </a>
        )}
      </form>
    </div>
  );
}
