"use client";

import { useState } from "react";
import { Banner, Button } from "@/components/portal/ui";
import { inputClass, Field } from "@/components/booking/ui";
import { postJson } from "@/lib/api";

export function InviteAccept({
  token,
  name,
  email,
  company,
}: {
  token: string;
  name: string;
  email: string;
  company: string;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function accept() {
    setError(null);
    if (password.length < 10) {
      setError("Choose a password of at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await postJson("/api/portal/invite", { token, password });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't activate your account.");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't activate your account.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card px-6 py-8 text-center">
        <p className="label justify-center">Account ready</p>
        <h1 className="display mt-3 text-xl">Welcome aboard, {name.split(" ")[0]}.</h1>
        <p className="mt-3 text-sm leading-relaxed text-white/55">
          Your portal account for {company || "your team"} is active. Sign in
          with {email} and the password you just set.
        </p>
        <a href="/login" className="btn-primary mt-6">
          Sign in to the portal
        </a>
      </div>
    );
  }

  return (
    <div className="card px-6 py-8">
      <p className="label">Join {company || "the client portal"}</p>
      <h1 className="display mt-3 text-xl">Set your password</h1>
      <p className="mt-2 text-sm text-white/50">
        You&rsquo;re activating portal access for <span className="text-white/80">{email}</span>.
      </p>
      <div className="mt-6 space-y-4">
        <Field label="Password" hint="At least 10 characters. A short phrase works well.">
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              className={inputClass(false)}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Field label="Confirm password">
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              className={inputClass(false)}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          )}
        </Field>
        {error && <Banner tone="danger">{error}</Banner>}
        <Button className="w-full" onClick={accept} busy={busy}>
          Activate my account
        </Button>
      </div>
    </div>
  );
}
