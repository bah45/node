"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const next = searchParams.get("redirectedFrom") || "/dashboard";
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", safeNext);
    const redirectTo = process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? callbackUrl.toString();
    const separator = redirectTo.includes("?") ? "&" : "?";

    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${redirectTo}${separator}next=${encodeURIComponent(safeNext)}` },
    });

    if (oauthError) {
      setLoading(false);
      setError("Google sign-in is unavailable. Please try again or use your operator credentials.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Invalid email or password.");
      return;
    }
    window.location.assign(searchParams.get("redirectedFrom") || "/dashboard");
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Enter your email above first, then choose Forgot Password.");
      return;
    }
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email);
    if (resetError) setError("Unable to send a reset email right now.");
    else setResetSent(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-telemetry/15">
            <Zap className="h-6 w-6 text-telemetry" />
          </div>
          <h1 className="text-lg font-bold tracking-[0.25em] text-ink">E-NODE</h1>
          <p className="mt-1 text-xs text-ink-muted">Energy-Aware Predictive Maintenance</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-panel">
          <Button type="button" onClick={handleGoogleLogin} disabled={loading} variant="secondary" className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue with Google"}
          </Button>
          <div className="my-5 flex items-center gap-3 text-[11px] text-ink-muted">
            <span className="h-px flex-1 bg-border" />
            <span>or use operator credentials</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="focus-ring w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none" placeholder="operator@plant.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="focus-ring w-full rounded-lg border border-border bg-surface-raised px-3 py-2.5 text-sm text-ink outline-none" placeholder="••••••••" />
            </div>
            {(error || authError) && <p className="text-xs text-critical">{error || authError}</p>}
            {resetSent && <p className="text-xs text-healthy">Password reset email sent.</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
            </Button>
            <button type="button" onClick={handleForgotPassword} className="focus-ring w-full text-center text-xs text-ink-muted hover:text-ink">Forgot Password</button>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] text-ink-muted">Access is restricted to authorized operators of node EN-ESP32C3-001.</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <LoginPageContent />
    </Suspense>
  );
}
