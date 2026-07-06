"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowLeft,
  Lock,
  Mail,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { postJson } from "@/lib/api";

const DEMO_ACCOUNTS = [
  { label: "Med Spa", email: "demo@glowaesthetics.com" },
  { label: "Multi-location Dental", email: "client@apexdental.com" },
];
const DEMO_PASSWORD = "redmont2026";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await postJson("/api/auth/login", { email, password });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Try again.");
        setLoading(false);
        return;
      }
      router.push("/portal");
      router.refresh();
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  function fill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Left — brand / story */}
      <div className="relative hidden overflow-hidden border-r border-white/10 lg:block">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-grid opacity-40" />
          <div className="absolute left-1/3 top-1/4 h-[420px] w-[520px] rounded-full bg-crimson/[0.12] blur-[130px]" />
        </div>
        <div className="relative flex h-full flex-col justify-between p-12">
          <a href="/" aria-label="Redmont Strategies Group home">
            <Logo />
          </a>
          <div>
            <p className="label">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-glow-pulse rounded-full bg-crimson" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-crimson" />
              </span>
              Client Portal
            </p>
            <h1 className="display text-gradient mt-6 max-w-md text-4xl leading-[1.05]">
              Your AI systems, live and accountable.
            </h1>
            <p className="mt-5 max-w-md leading-relaxed text-white/55">
              Track every booked consult, monitor your automations in real time,
              review deliverables, and see the revenue your AI is influencing —
              all in one place.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "Real-time system status & throughput",
                "Revenue and pipeline attribution",
                "Deliverables, roadmap & billing",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-crimson/15 text-crimson-light">
                    <ShieldCheck size={12} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/25">
            RSG · Secured session · AI Automation & Marketing
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute inset-0 bg-grid opacity-30" />
          <div className="absolute left-1/2 top-0 h-72 w-96 -translate-x-1/2 rounded-full bg-crimson/10 blur-[110px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full max-w-sm"
        >
          <a
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/45 transition-colors hover:text-white lg:hidden"
          >
            <ArrowLeft size={15} />
            Back to site
          </a>

          <div className="lg:hidden">
            <Logo showWordmark={false} />
          </div>

          <h2 className="display mt-6 text-2xl font-semibold text-white lg:mt-0">
            Sign in to your portal
          </h2>
          <p className="mt-2 text-sm text-white/50">
            Enter your credentials to access your dashboard.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block font-mono text-[0.58rem] uppercase tracking-label text-white/55">
                Email
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
                  placeholder="you@company.com"
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

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-crimson/30 bg-crimson-soft px-3.5 py-2.5 text-sm text-crimson-light"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary group w-full py-3 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowUpRight
                    size={16}
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </>
              )}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="font-mono text-[0.56rem] uppercase tracking-label text-crimson-light">
              // Demo accounts — click to fill
            </p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fill(a.email)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/25 hover:bg-white/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-white/75">{a.email}</span>
                    <span className="font-mono text-[0.52rem] uppercase tracking-label text-white/35">
                      {a.label}
                    </span>
                  </span>
                  <ArrowUpRight size={14} className="shrink-0 text-white/40" />
                </button>
              ))}
            </div>
            <p className="mt-3 font-mono text-[0.56rem] uppercase tracking-label text-white/40">
              Password · {DEMO_PASSWORD}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
