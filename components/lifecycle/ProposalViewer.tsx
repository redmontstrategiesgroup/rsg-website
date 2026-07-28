"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Proposal,
  ProposalComment,
  ProposalOption,
} from "@/lib/lifecycle/types";
import { formatCents } from "@/lib/lifecycle/types";
import { Banner, Button, Modal, StatusPill } from "@/components/portal/ui";
import { inputClass } from "@/components/booking/ui";
import { postJson } from "@/lib/api";

type Totals = {
  baseCents: number;
  selectedOneTimeCents: number;
  totalCents: number;
  recurringMonthlyCents: number;
  depositCents: number;
};

export function ProposalViewer({
  token,
  proposal,
  options: initialOptions,
  comments: initialComments,
  totals: initialTotals,
}: {
  token: string;
  proposal: Proposal;
  options: ProposalOption[];
  comments: ProposalComment[];
  totals: Totals;
}) {
  const api = `/api/proposal/${token}`;
  const [status, setStatus] = useState(proposal.status);
  const [options, setOptions] = useState(initialOptions);
  const [comments, setComments] = useState(initialComments);
  const [totals, setTotals] = useState(initialTotals);
  const [dialog, setDialog] = useState<"approve" | "revision" | "comment" | null>(null);
  const [dialogSection, setDialogSection] = useState<string | undefined>(undefined);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const seenSections = useRef(new Set<string>());

  const interactive =
    status === "sent" || status === "viewed" || status === "revision_requested";
  const approvable = status === "sent" || status === "viewed";

  // Viewing-time heartbeat (only while the tab is visible).
  useEffect(() => {
    if (!interactive && status !== "approved") return;
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void postJson(api, { action: "heartbeat", seconds: 15 }).catch(() => {});
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [api, interactive, status]);

  // Section-view tracking.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = entry.target.getAttribute("data-section-key");
          if (entry.isIntersecting && key && !seenSections.current.has(key)) {
            seenSections.current.add(key);
            void postJson(api, { action: "section_view", sectionKey: key }).catch(
              () => {},
            );
          }
        }
      },
      { threshold: 0.4 },
    );
    document
      .querySelectorAll("[data-section-key]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [api]);

  const visibleSections = useMemo(
    () => proposal.sections.filter((s) => !s.hidden),
    [proposal.sections],
  );

  async function toggleOption(option: ProposalOption) {
    if (!interactive) return;
    const next = !option.selected;
    setOptions((prev) =>
      prev.map((o) => (o.id === option.id ? { ...o, selected: next } : o)),
    );
    const res = await postJson(api, {
      action: "option",
      optionId: option.id,
      selected: next,
    });
    if (res.ok) {
      const data = (await res.json()) as {
        totalCents: number;
        recurringMonthlyCents: number;
      };
      setTotals((prev) => ({
        ...prev,
        totalCents: data.totalCents,
        recurringMonthlyCents: data.recurringMonthlyCents,
        selectedOneTimeCents: data.totalCents - prev.baseCents,
      }));
    } else {
      setOptions((prev) =>
        prev.map((o) => (o.id === option.id ? { ...o, selected: !next } : o)),
      );
    }
  }

  async function submitDialog() {
    setDialogError(null);
    if (name.trim().length < 2) {
      setDialogError("Please enter your full name.");
      return;
    }
    if ((dialog === "revision" || dialog === "comment") && note.trim().length === 0) {
      setDialogError("Please add a short note.");
      return;
    }
    setBusy(true);
    try {
      if (dialog === "approve") {
        const res = await postJson(api, { action: "approve", name: name.trim() });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Approval failed.");
        setStatus("approved");
      } else if (dialog === "revision") {
        const res = await postJson(api, {
          action: "revision",
          name: name.trim(),
          note: note.trim(),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Request failed.");
        setStatus("revision_requested");
      } else if (dialog === "comment") {
        const res = await postJson(api, {
          action: "comment",
          name: name.trim(),
          sectionKey: dialogSection,
          body: note.trim(),
        });
        const data = (await res.json()) as { comment?: ProposalComment; error?: string };
        if (!res.ok || !data.comment) throw new Error(data.error || "Comment failed.");
        setComments((prev) => [...prev, data.comment!]);
      }
      setDialog(null);
      setNote("");
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const expiresOn = proposal.expires_at
    ? new Date(proposal.expires_at).toLocaleDateString("en-US", { dateStyle: "long" })
    : null;

  return (
    <div className="lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-10">
      {/* ------------------------------------------------ main column */}
      <div className="min-w-0">
        {status === "approved" && (
          <div className="mb-8 print:hidden">
            <Banner tone="success" title="Proposal approved.">
              Thank you{proposal.approved_by_name ? `, ${proposal.approved_by_name}` : ""}.
              Your agreement is being prepared — it will arrive by email for
              electronic signature.
            </Banner>
          </div>
        )}
        {status === "expired" && (
          <div className="mb-8 print:hidden">
            <Banner tone="warning" title="This proposal has expired.">
              Pricing and timelines may need to be re-confirmed. Reply to your
              proposal email and we&rsquo;ll refresh it promptly.
            </Banner>
          </div>
        )}
        {status === "revision_requested" && (
          <div className="mb-8 print:hidden">
            <Banner tone="info" title="Revision requested.">
              We&rsquo;re on it — you&rsquo;ll receive an updated version shortly.
            </Banner>
          </div>
        )}

        <article className="space-y-10">
          {visibleSections.map((section) => {
            const sectionComments = comments.filter(
              (c) => c.section_key === section.key,
            );
            return (
              <section key={section.key} data-section-key={section.key}>
                <h2 className="display border-b border-white/10 pb-3 text-lg sm:text-xl">
                  {section.title}
                </h2>
                {section.body && (
                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-white/70">
                    {section.body.split(/\n{2,}/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                )}
                {section.items && section.items.length > 0 && (
                  <ul className="mt-4 space-y-2.5">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed">
                        <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
                        <span>
                          <span className="text-white/85">{item.title}</span>
                          {item.detail && (
                            <span className="text-white/50"> — {item.detail}</span>
                          )}
                          {item.meta && (
                            <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-label text-white/35">
                              {item.meta}
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Section comments */}
                <div className="mt-4 print:hidden">
                  {sectionComments.length > 0 && (
                    <div className="space-y-2 border-l border-white/10 pl-4">
                      {sectionComments.map((c) => (
                        <div key={c.id}>
                          <p className="text-xs text-white/40">
                            {c.author_type === "admin" ? "Redmont" : c.author_name}
                          </p>
                          <p className="text-sm text-white/70">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-xs text-white/35 transition hover:text-white/70"
                    onClick={() => {
                      setDialog("comment");
                      setDialogSection(section.key);
                    }}
                  >
                    Ask a question about this section
                  </button>
                </div>
              </section>
            );
          })}
        </article>
      </div>

      {/* ------------------------------------------------ summary rail */}
      <aside className="mt-10 space-y-4 lg:sticky lg:top-24 lg:mt-0 print:hidden">
        <div className="card px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              Investment
            </p>
            <StatusPill status={status} />
          </div>
          <p className="mt-3 font-display text-2xl font-medium text-white">
            {formatCents(totals.totalCents)}
          </p>
          {totals.recurringMonthlyCents > 0 && (
            <p className="mt-1 text-xs text-white/45">
              + {formatCents(totals.recurringMonthlyCents)}/mo in selected ongoing services
            </p>
          )}
          <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-xs">
            <div className="flex justify-between text-white/55">
              <span>Deposit to begin</span>
              <span className="text-white/85">{formatCents(totals.depositCents)}</span>
            </div>
            {proposal.payment_schedule.map((entry, i) => (
              <div key={i} className="flex justify-between text-white/45">
                <span>{entry.label}</span>
                <span>
                  {formatCents(entry.amount_cents)} · {entry.due}
                </span>
              </div>
            ))}
          </div>
          {expiresOn && status !== "approved" && (
            <p className="mt-4 text-[0.65rem] text-white/35">Valid through {expiresOn}</p>
          )}
        </div>

        {options.length > 0 && (
          <div className="card px-5 py-5">
            <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
              Optional additions
            </p>
            <div className="mt-3 space-y-2.5">
              {options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-3 border px-3.5 py-3 transition ${
                    option.selected
                      ? "border-crimson/60 bg-crimson/[0.07]"
                      : "border-white/10 hover:border-white/25"
                  } ${interactive ? "" : "cursor-default opacity-70"}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-crimson"
                    checked={option.selected}
                    disabled={!interactive}
                    onChange={() => void toggleOption(option)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-white/85">{option.title}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs leading-relaxed text-white/45">
                        {option.description}
                      </span>
                    )}
                    <span className="mt-1 block font-mono text-[0.62rem] text-white/55">
                      {formatCents(option.price_cents)}
                      {option.billing !== "one_time" && `/${option.billing.replace("ly", "")}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="card space-y-2.5 px-5 py-5">
          {approvable && (
            <Button
              className="w-full"
              onClick={() => {
                setDialog("approve");
                setDialogSection(undefined);
              }}
            >
              Approve this proposal
            </Button>
          )}
          {interactive && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => {
                setDialog("revision");
                setDialogSection(undefined);
              }}
            >
              Request changes
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => window.print()}
          >
            Download PDF
          </Button>
        </div>
      </aside>

      {/* ------------------------------------------------ dialogs */}
      <Modal
        open={dialog !== null}
        onClose={() => setDialog(null)}
        title={
          dialog === "approve"
            ? "Approve this proposal"
            : dialog === "revision"
              ? "Request changes"
              : "Ask a question"
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitDialog} busy={busy}>
              {dialog === "approve" ? "Approve" : "Send"}
            </Button>
          </>
        }
      >
        {dialog === "approve" && (
          <p className="mb-4 text-sm leading-relaxed text-white/55">
            Approving moves us to the agreement and deposit. Total investment:{" "}
            <span className="text-white">{formatCents(totals.totalCents)}</span>
            {totals.recurringMonthlyCents > 0 && (
              <> plus {formatCents(totals.recurringMonthlyCents)}/mo in selected services</>
            )}
            . Type your full name to confirm.
          </p>
        )}
        <input
          type="text"
          className={inputClass(Boolean(dialogError && name.trim().length < 2))}
          placeholder="Your full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Your full name"
        />
        {(dialog === "revision" || dialog === "comment") && (
          <textarea
            rows={4}
            className={`mt-3 ${inputClass(false)}`}
            placeholder={
              dialog === "revision"
                ? "What should we adjust?"
                : "Your question — we'll reply here and by email."
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="Note"
          />
        )}
        {dialogError && (
          <p role="alert" className="mt-3 text-xs text-crimson-light">
            {dialogError}
          </p>
        )}
      </Modal>
    </div>
  );
}
