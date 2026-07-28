"use client";

import { useState } from "react";
import type { Contract } from "@/lib/lifecycle/types";
import { CONTRACT_KIND_LABELS } from "@/lib/lifecycle/types";
import { Banner, Button, StatusPill } from "@/components/portal/ui";
import { inputClass } from "@/components/booking/ui";
import { postJson } from "@/lib/api";

type PublicSignature = {
  id: string;
  signer_type: string;
  role: string;
  signer_name: string;
  signer_title: string | null;
  signed_name: string | null;
  sort_order: number;
  required: boolean;
  signed_at: string | null;
};

export function AgreementClient({
  token,
  contract,
  signatures: initialSignatures,
  acknowledgments,
}: {
  token: string;
  contract: Contract;
  signatures: PublicSignature[];
  acknowledgments: { key: string; label: string }[];
}) {
  const [signatures, setSignatures] = useState(initialSignatures);
  const [status, setStatus] = useState(contract.status);
  const [signedName, setSignedName] = useState("");
  const [initials, setInitials] = useState("");
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openSlot = signatures.find(
    (s) => s.signer_type === "client" && s.required && !s.signed_at,
  );
  const executed =
    status === "countersigned" ||
    status === "active" ||
    (status === "signed" && !contract.requires_countersign);
  const terminal = ["voided", "declined", "expired"].includes(status);

  async function sign() {
    setError(null);
    if (signedName.trim().length < 2) {
      setError("Type your full legal name to sign.");
      return;
    }
    if (accepted.size < acknowledgments.length) {
      setError("Please confirm every acknowledgment before signing.");
      return;
    }
    if (!openSlot) return;
    setBusy(true);
    try {
      const res = await postJson(`/api/contract/${token}`, {
        action: "sign",
        signatureId: openSlot.id,
        signedName: signedName.trim(),
        initials: initials.trim() || undefined,
        acknowledgmentKeys: [...accepted],
      });
      const data = (await res.json()) as {
        status?: Contract["status"];
        signatures?: PublicSignature[];
        error?: string;
      };
      if (!res.ok || !data.status) throw new Error(data.error || "Signing failed.");
      setStatus(data.status);
      if (data.signatures) setSignatures(data.signatures);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signing failed — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-10">
      <div className="min-w-0">
        {executed && (
          <div className="mb-8 print:hidden">
            <Banner tone="success" title="This agreement is fully signed.">
              A confirmation email with this link is in your inbox. Use
              &ldquo;Download signed copy&rdquo; any time for your records.
            </Banner>
          </div>
        )}
        {status === "signed" && contract.requires_countersign && (
          <div className="mb-8 print:hidden">
            <Banner tone="info" title="Signed — awaiting countersignature.">
              Redmont countersigns within one business day. You&rsquo;ll receive
              your completed copy by email automatically.
            </Banner>
          </div>
        )}
        {terminal && (
          <div className="mb-8 print:hidden">
            <Banner tone="warning" title={`This agreement is ${status}.`}>
              If you believe this is an error, reply to the email that delivered it.
            </Banner>
          </div>
        )}

        <article className="space-y-8">
          {contract.content.map((section) => (
            <section key={section.key}>
              <h2 className="display border-b border-white/10 pb-2.5 text-base sm:text-lg">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-white/70">
                {section.body.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        {/* Signature record (audit-visible) */}
        <section className="mt-12 border-t border-white/10 pt-8">
          <h2 className="font-mono text-[0.6rem] uppercase tracking-label text-white/40">
            Signatures
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {signatures.map((s) => (
              <div key={s.id} className="border border-white/10 bg-white/[0.02] px-5 py-4">
                <p className="text-xs text-white/40">
                  {s.role === "countersigner" ? "Redmont Strategies Group" : "Client"}
                  {s.signer_title ? ` · ${s.signer_title}` : ""}
                </p>
                {s.signed_at ? (
                  <>
                    <p className="mt-2 font-display text-lg italic text-white">
                      {s.signed_name}
                    </p>
                    <p className="mt-1 text-[0.65rem] text-white/35">
                      Signed {new Date(s.signed_at).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-white/35">
                    {s.role === "countersigner" ? "Awaiting countersignature" : "Awaiting signature"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* -------------------------------------------------- signing rail */}
      <aside className="mt-10 space-y-4 lg:sticky lg:top-24 lg:mt-0 print:hidden">
        <div className="card px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              {CONTRACT_KIND_LABELS[contract.kind]}
            </p>
            <StatusPill status={status} />
          </div>
          {contract.expires_at && !executed && !terminal && (
            <p className="mt-3 text-xs text-white/45">
              Please sign by{" "}
              {new Date(contract.expires_at).toLocaleDateString("en-US", { dateStyle: "long" })}.
            </p>
          )}
          <Button variant="ghost" className="mt-4 w-full" onClick={() => window.print()}>
            {executed ? "Download signed copy" : "Download PDF"}
          </Button>
        </div>

        {openSlot && !terminal && (
          <div className="card px-5 py-5">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              Sign electronically
            </p>
            <div className="mt-4 space-y-3">
              {acknowledgments.map((a) => (
                <label key={a.key} className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    className="mt-1 accent-crimson"
                    checked={accepted.has(a.key)}
                    onChange={(e) => {
                      setAccepted((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(a.key);
                        else next.delete(a.key);
                        return next;
                      });
                    }}
                  />
                  <span className="text-xs leading-relaxed text-white/60">{a.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs text-white/50" htmlFor="signed-name">
                  Type your full legal name
                </label>
                <input
                  id="signed-name"
                  type="text"
                  className={inputClass(false)}
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  placeholder={openSlot.signer_name || "Full legal name"}
                  autoComplete="name"
                />
                {signedName.trim().length >= 2 && (
                  <p className="mt-2 border border-white/10 bg-white/[0.02] px-4 py-3 text-center font-display text-xl italic text-white">
                    {signedName.trim()}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-xs text-white/50" htmlFor="initials">
                  Initials (optional)
                </label>
                <input
                  id="initials"
                  type="text"
                  maxLength={5}
                  className={inputClass(false)}
                  value={initials}
                  onChange={(e) => setInitials(e.target.value.toUpperCase())}
                  placeholder="e.g. JP"
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="mt-3 text-xs text-crimson-light">{error}</p>
            )}
            <Button className="mt-4 w-full" onClick={sign} busy={busy}>
              Sign agreement
            </Button>
            <p className="mt-3 text-[0.62rem] leading-relaxed text-white/30">
              By clicking Sign agreement you consent to signing electronically.
              Your typed name, the time, and your network address become part of
              this agreement&rsquo;s tamper-evident audit record.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
