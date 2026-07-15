"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowLeft,
  Lock,
  Mail,
  Loader2,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { postJson } from "@/lib/api";

export function AdminLoginForm({ next = "/admin" }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaTicket, setMfaTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = mfaTicket
        ? { mfaTicket, mfaCode }
        : { email, password };
      const res = await postJson("/api/admin/login", payload);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      if (data.mfaRequired && data.mfaTicket) {
        setMfaTicket(data.mfaTicket);
        setLoading(false);
        return;
      }
      router.push(next || "/admin");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-crimson/[0.10] blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} />
          Back to site
        </Link>

        <Logo showWordmark={false} />

        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[0.58rem] uppercase tracking-label text-crimson-light">
          <ShieldCheck size={13} />
          Admin console
        </div>

        <h1 className="display mt-4 text-2xl font-semibold text-white">
          {mfaTicket ? "Authenticator code" : "Sign in to manage clients"}
        </h1>
        <p className="mt-2 text-sm text-white/50">
          {mfaTicket
            ? "Enter the 6-digit code from your authenticator app."
            : "Restricted access. Admin credentials required."}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {!mfaTicket ? (
            <>
              <label className="block">
                <span className="mb-1.5 block font-mono text-[0.58rem] uppercase tracking-label text-white/55">
                  Admin email
                </span>
                <div className="relative">
                  <Mail
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-white/12 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20"
                    placeholder="Email address"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block font-mono text-[0.58rem] uppercase tracking-label text-white/55">
                  Password
                </span>
                <div className="relative">
                  <Lock
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
                  />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-white/12 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20"
                    placeholder="••••••••••"
                  />
                </div>
              </label>
            </>
          ) : (
            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.58rem] uppercase tracking-label text-white/55">
                MFA code
              </span>
              <div className="relative">
                <KeyRound
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={(e) =>
                    setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full rounded-lg border border-white/12 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm tracking-[0.3em] text-white placeholder:text-white/30 transition-colors focus:border-crimson focus:outline-none focus:ring-2 focus:ring-crimson/20"
                  placeholder="000000"
                />
              </div>
            </label>
          )}

          {error && (
            <p className="rounded-lg border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary group w-full py-3 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mfaTicket ? "Verifying…" : "Signing in…"}
              </>
            ) : (
              <>
                {mfaTicket ? "Verify & enter" : "Enter console"}
                <ArrowUpRight
                  size={16}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </>
            )}
          </button>

          {mfaTicket && (
            <button
              type="button"
              className="w-full text-sm text-white/45 hover:text-white"
              onClick={() => {
                setMfaTicket(null);
                setMfaCode("");
                setError(null);
              }}
            >
              Back to email & password
            </button>
          )}
        </form>
      </motion.div>
    </div>
  );
}
