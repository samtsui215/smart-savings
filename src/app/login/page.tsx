"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { emailLogin, googleSignIn, friendlyAuthError } from "@/lib/firebase/signIn";
import AuthShell, { GoogleGlyph } from "@/components/AuthShell";

// useSearchParams() forces a client bail-out, which Next requires to be
// wrapped in a Suspense boundary or the production build fails to prerender
// this page. The wrapper satisfies that; the inner component holds the form.
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  // Only honor a same-site path. Reject absolute URLs ("https://evil.com")
  // and protocol-relative ones ("//evil.com") to prevent open-redirect
  // phishing after login.
  const rawNext = params.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  function goNext() {
    router.push(next);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email"); setError(null);
    try {
      await emailLogin(email, password);
      goNext();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(null);
    }
  }

  async function onGoogle() {
    setBusy("google"); setError(null);
    try {
      await googleSignIn();
      goNext();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage your buckets."
      footer={<>No account? <Link className="text-accent-700 font-medium hover:underline" href="/register">Create one</Link></>}
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={onGoogle}
          disabled={busy !== null}
          className="btn-secondary w-full gap-2"
        >
          <GoogleGlyph />
          {busy === "google" ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3 text-xs text-ink-400">
          <span className="h-px flex-1 bg-ink-200" /> or <span className="h-px flex-1 bg-ink-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button className="btn-accent w-full" disabled={busy !== null}>
            {busy === "email" ? "Signing in…" : "Sign in →"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
