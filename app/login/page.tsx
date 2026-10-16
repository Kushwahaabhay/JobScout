"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

const DEMO_HINT = process.env.NEXT_PUBLIC_DEMO_HINT;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(j?.error?.message ?? "Sign-in failed.");
        setBusy(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      // Only same-site paths under /app are allowed as redirect targets.
      window.location.assign(next && /^\/app(\/|$)/.test(next) ? next : "/app");
    } catch {
      setError("Network error. Try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="font-mono text-xs uppercase tracking-widest text-accent">JobScout</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Sign in to search. Your TinyFish key is entered separately, inside the app.</p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />} Sign in
        </Button>
      </form>

      {DEMO_HINT && <p className="mt-4 rounded-md border border-border p-3 text-xs text-muted">Demo access: {DEMO_HINT}</p>}
      <p className="mt-6 text-xs text-muted">
        Accounts are issued by the app owner; there is no sign-up and no user database. <Link className="underline hover:text-foreground" href="/">Back to home</Link>
      </p>
    </main>
  );
}
