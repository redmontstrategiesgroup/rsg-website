"use client";

import { useState } from "react";
import { KeyRound, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { postJson } from "@/lib/api";
import { inputClass } from "@/components/admin/security/shared";

/**
 * Admin MFA enrollment against the existing /api/admin/mfa endpoint. TOTP
 * secret + otpauth URL come from the server; the code is verified server-side
 * before MFA is enabled.
 */
export function MfaSetup({
  enabled,
  required = false,
  onChanged,
}: {
  enabled: boolean;
  required?: boolean;
  onChanged: () => void;
}) {
  const [phase, setPhase] = useState<"idle" | "enrolling">("idle");
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    try {
      const res = await postJson("/api/admin/mfa", { action: "start" });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(b.error ?? "Could not start MFA setup.");
        return;
      }
      setSecret(b.secret);
      setOtpauth(b.otpauthUrl);
      setPhase("enrolling");
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const res = await postJson("/api/admin/mfa", { action: "enable", secret, code: code.trim() });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(b.error ?? "Invalid code.");
        return;
      }
      setNotice("MFA is now enabled for your account.");
      setPhase("idle");
      setCode("");
      setSecret("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (enabled) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200/90">
        <ShieldCheck size={16} />
        Multifactor authentication is enabled on your account.
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border p-5 ${
        required
          ? "border-crimson/40 bg-crimson/[0.06]"
          : "border-white/12 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-start gap-3">
        {required ? (
          <ShieldAlert size={18} className="mt-0.5 text-crimson-light" />
        ) : (
          <KeyRound size={18} className="mt-0.5 text-white/60" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {required
              ? "MFA is required for your role"
              : "Add multifactor authentication"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            Protect your account with a time-based one-time code from an
            authenticator app. Recommended for every privileged account.
          </p>

          {notice && <p className="mt-3 text-xs text-emerald-300">{notice}</p>}
          {error && <p className="mt-3 text-xs text-crimson-light">{error}</p>}

          {phase === "idle" ? (
            <button
              onClick={start}
              disabled={busy}
              className="btn-primary mt-4 !px-5 !py-2.5 text-sm disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : "Set up MFA"}
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-white/10 bg-black/30 p-3">
                <p className="font-mono text-[0.56rem] uppercase tracking-label text-white/40">
                  Secret (enter manually in your app)
                </p>
                <p className="mt-1 break-all font-mono text-xs text-white/80">{secret}</p>
                <p className="mt-2 break-all font-mono text-[0.6rem] text-white/35">
                  {otpauth}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  className={`${inputClass} max-w-[160px]`}
                />
                <button
                  onClick={enable}
                  disabled={busy || code.trim().length !== 6}
                  className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : "Verify & enable"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
