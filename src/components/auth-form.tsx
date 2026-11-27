"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson, safeNext } from "@/lib/client";

export function SignInForm({ next }: { next?: string }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const destination = safeNext(next);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await postJson("/api/auth/signin", { login, password });
      window.location.href = destination;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in");
      setPending(false);
    }
  }

  async function demo() {
    setPending(true);
    setError(null);
    try {
      await postJson("/api/auth/demo");
      window.location.href = destination;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Demo sign-in failed");
      setPending(false);
    }
  }

  return (
    <div className="surface p-6">
      <button type="button" onClick={() => void demo()} disabled={pending} data-testid="demo-login" className="btn-primary h-11 w-full">
        Continue as demo
      </button>
      <p className="mt-2 text-center text-xs text-muted">Opens the shared demo desk with 1,000 TP and a few open positions.</p>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm text-secondary">
          Email or username
          <input required value={login} onChange={(event) => setLogin(event.target.value)} className="field mt-1" autoComplete="username" data-testid="signin-login" />
        </label>
        <label className="block text-sm text-secondary">
          Password
          <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-1" autoComplete="current-password" data-testid="signin-password" />
        </label>
        {error && <p className="text-sm text-no">{error}</p>}
        <button type="submit" disabled={pending} className="btn w-full border border-line bg-white text-ink hover:bg-pill" data-testid="signin-submit">
          {pending ? "Signing in" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-secondary">
        New here?{" "}
        <Link href="/signup" className="font-medium text-ink hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await postJson("/api/auth/signup", { name, username, email, password });
      window.location.href = "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the account");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface space-y-3 p-6">
      <label className="block text-sm text-secondary">
        Name
        <input required value={name} onChange={(event) => setName(event.target.value)} className="field mt-1" data-testid="signup-name" />
      </label>
      <label className="block text-sm text-secondary">
        Username
        <input required value={username} onChange={(event) => setUsername(event.target.value)} className="field mt-1" autoComplete="username" data-testid="signup-username" />
      </label>
      <label className="block text-sm text-secondary">
        Email
        <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field mt-1" autoComplete="email" data-testid="signup-email" />
      </label>
      <label className="block text-sm text-secondary">
        Password
        <input required type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="field mt-1" autoComplete="new-password" data-testid="signup-password" />
      </label>
      <p className="text-xs text-muted">New accounts start with 1,000 TP.</p>
      {error && <p className="text-sm text-no">{error}</p>}
      <button type="submit" disabled={pending} className="btn-primary h-11 w-full" data-testid="signup-submit">
        {pending ? "Creating" : "Create account"}
      </button>
      <p className="text-center text-sm text-secondary">
        Already have a desk?{" "}
        <Link href="/signin" className="font-medium text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
