"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserClient } from "@/lib/supabase-browser";
import { Button, Field } from "@/ui/primitives";

/**
 * There is no signup. Shops are created by hand, and staff accounts with
 * them, so this form only ever has to let a known person back in.
 */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const { error: signInError } = await browserClient().auth.signInWithPassword(
      { email: email.trim(), password },
    );

    if (signInError) {
      // Deliberately not distinguishing "no such account" from "wrong
      // password": that difference tells an outsider which addresses are real.
      setError("That email and password do not match an account.");
      setBusy(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field
        label="Email"
        type="email"
        name="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="off"
        autoCorrect="off"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <Field
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={error}
      />

      <Button type="submit" size="lg" full disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
