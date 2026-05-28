"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { emailRegister, googleSignIn, friendlyAuthError } from "@/lib/firebase/signIn";
import AuthShell, { GoogleGlyph } from "@/components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);

  function goDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email"); setError(null);
    try {
      await emailRegister(email, password);
      goDashboard();
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
      goDashboard();
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free, no payment info required."
      footer={<>Already have one? <Link className="text-accent-700 font-medium hover:underline" href="/login">Sign in</Link></>}
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
            <input className="input" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <button className="btn-accent w-full" disabled={busy !== null}>
            {busy === "email" ? "Creating…" : "Create account →"}
          </button>
        </form>
      </div>
    </AuthShell>
  );
}
