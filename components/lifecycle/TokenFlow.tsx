"use client";

import { useRef, useState } from "react";
import type { AssessmentSummary, FormSection } from "@/lib/lifecycle/types";
import { SERVICE_CATEGORY_LABELS, CATEGORY_APPOINTMENT_SLUGS } from "@/lib/lifecycle/types";
import type { ServiceCategory } from "@/lib/lifecycle/types";
import { FormFlow } from "@/components/lifecycle/FormFlow";
import { Banner, Button, Modal, ProgressBar } from "@/components/portal/ui";
import { inputClass } from "@/components/booking/ui";
import { patchJson, postJson } from "@/lib/api";

/**
 * Shared client experience for token-link forms (assessment + preparation
 * questionnaire): section-by-section autosave, teammate invites, optional
 * document uploads, and a submitted state.
 */

type TokenFlowProps = {
  kind: "assessment" | "questionnaire";
  token: string;
  sections: FormSection[];
  initialAnswers: Record<string, unknown>;
  initialStatus: string;
  initialSummary?: AssessmentSummary | null;
  allowUploads?: boolean;
};

export function TokenFlow({
  kind,
  token,
  sections,
  initialAnswers,
  initialStatus,
  initialSummary,
  allowUploads = true,
}: TokenFlowProps) {
  const api = `/api/${kind}/${token}`;
  const submittedInitially =
    initialStatus === "submitted" || initialStatus === "reviewed" || initialStatus === "waived";
  const [submitted, setSubmitted] = useState(submittedInitially);
  const [summary, setSummary] = useState<AssessmentSummary | null>(initialSummary ?? null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteState, setInviteState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  if (initialStatus === "expired") {
    return (
      <Banner tone="warning" title="This link has expired.">
        No problem — reach out and we&rsquo;ll send you a fresh one, or book a
        consultation directly from the Book page in the site navigation.
      </Banner>
    );
  }

  if (submitted) {
    if (kind === "assessment" && summary) {
      return <AssessmentSummaryView summary={summary} />;
    }
    return (
      <div className="animate-fade-up border border-white/10 bg-white/[0.02] px-6 py-10 text-center sm:px-10">
        <p className="label justify-center">All set</p>
        <h2 className="display mt-4 text-2xl">Thank you — we&rsquo;re prepared.</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/55">
          Your answers are with our team. We&rsquo;ll come to your consultation
          with your situation already understood, so the time goes to
          recommendations — not background.
        </p>
      </div>
    );
  }

  async function uploadFile(file: File) {
    setUploadNote(null);
    const res = await postJson(api, {
      action: "upload",
      name: file.name,
      sizeBytes: file.size,
      mimeType: file.type || "application/octet-stream",
    });
    const data = (await res.json()) as { uploadUrl?: string; error?: string };
    if (!res.ok || !data.uploadUrl) {
      setUploadNote(data.error || "That file couldn't be accepted.");
      return;
    }
    const put = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });
    setUploadNote(
      put.ok
        ? `Uploaded ${file.name} — thank you.`
        : "Upload failed — please try again or bring the document to your consultation.",
    );
  }

  return (
    <>
      <FormFlow
        sections={sections}
        initialAnswers={initialAnswers}
        submitLabel={kind === "assessment" ? "Get my summary" : "Submit answers"}
        onSaveSection={async (entries, sectionKey) => {
          const res = await patchJson(api, {
            entries:
              kind === "assessment"
                ? entries
                : entries.map(({ questionKey, answer }) => ({ questionKey, answer })),
            ...(kind === "assessment" ? { currentSection: sectionKey } : {}),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(data.error || "Couldn't save — check your connection and retry.");
          }
        }}
        onSubmit={async () => {
          const res = await postJson(api, { action: "submit" });
          const data = (await res.json()) as {
            assessment?: { summary?: AssessmentSummary | null };
            error?: string;
          };
          if (!res.ok) throw new Error(data.error || "Couldn't submit — please try again.");
          setSummary(data.assessment?.summary ?? null);
          setSubmitted(true);
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        footer={
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-5 text-xs text-white/40">
            <span>Progress saves automatically.</span>
            <button
              type="button"
              className="link-underline hover:text-white/70"
              onClick={() => setInviteOpen(true)}
            >
              Invite a teammate to contribute
            </button>
            {allowUploads && (
              <>
                <button
                  type="button"
                  className="link-underline hover:text-white/70"
                  onClick={() => fileInput.current?.click()}
                >
                  Attach a document (optional)
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(file);
                    e.target.value = "";
                  }}
                />
              </>
            )}
            {uploadNote && <span className="w-full text-center text-white/55">{uploadNote}</span>}
          </div>
        }
      />

      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteState("idle");
        }}
        title="Invite a teammate"
        footer={
          inviteState === "sent" ? (
            <Button onClick={() => setInviteOpen(false)}>Done</Button>
          ) : (
            <Button
              busy={inviteState === "busy"}
              onClick={async () => {
                setInviteState("busy");
                const res = await postJson(api, { action: "invite", email: inviteEmail });
                setInviteState(res.ok ? "sent" : "error");
              }}
            >
              Send invite
            </Button>
          )
        }
      >
        {inviteState === "sent" ? (
          <p className="text-sm text-white/70">
            Invitation sent. They&rsquo;ll get a link to this exact page and can
            fill in the parts they know best.
          </p>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-white/55">
              They&rsquo;ll receive a link to contribute to these answers —
              useful for questions about tools, finances, or operations someone
              else owns.
            </p>
            <input
              type="email"
              className={`mt-4 ${inputClass(inviteState === "error")}`}
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              aria-label="Teammate email"
            />
            {inviteState === "error" && (
              <p role="alert" className="mt-2 text-xs text-crimson-light">
                That invite couldn&rsquo;t be sent — check the address and try again.
              </p>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Assessment summary (the premium payoff screen)
// ---------------------------------------------------------------------------

function AssessmentSummaryView({ summary }: { summary: AssessmentSummary }) {
  const category = summary.recommended_category as ServiceCategory;
  const bookSlug = CATEGORY_APPOINTMENT_SLUGS[category] ?? "business-systems-consultation";
  return (
    <div className="animate-fade-up space-y-6">
      <div className="border border-white/10 bg-white/[0.02] px-6 py-8 sm:px-8">
        <p className="label">Your preliminary assessment</p>
        <p className="mt-4 text-sm leading-relaxed text-white/75">{summary.overview}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryList title="Highest-priority problems" items={summary.priority_problems} />
        <SummaryList title="Revenue opportunities" items={summary.revenue_opportunities} />
        <SummaryList title="Operational risks" items={summary.operational_risks} />
        <div className="border border-white/10 bg-white/[0.02] px-5 py-5">
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
            Where you stand by area
          </p>
          <div className="mt-4 space-y-3">
            {summary.section_scores
              .filter((s) => s.max > 0)
              .map((s) => (
                <div key={s.section_key}>
                  <div className="mb-1 flex items-baseline justify-between gap-3">
                    <span className="text-xs text-white/60">{s.label}</span>
                    <span className="font-mono text-[0.6rem] text-white/40">
                      {Math.round((s.score / s.max) * 100)}% opportunity
                    </span>
                  </div>
                  <ProgressBar value={(s.score / s.max) * 100} ariaLabel={s.label} />
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="border border-crimson/30 bg-crimson/[0.06] px-6 py-8 text-center sm:px-8">
        <p className="label justify-center">Recommended next step</p>
        <h3 className="display mt-3 text-xl sm:text-2xl">
          {SERVICE_CATEGORY_LABELS[category] ?? "Business Systems"} Consultation
        </h3>
        <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm text-white/60">
          {summary.next_steps.map((step) => (
            <li key={step} className="flex gap-2.5">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
              {step}
            </li>
          ))}
        </ul>
        <a href={`/book/${bookSlug}`} className="btn-primary mt-7">
          Book your consultation
        </a>
        <p className="mt-4 text-[0.68rem] text-white/35">
          The full implementation plan — systems, sequencing, and investment —
          is built with you during the consultation.
        </p>
      </div>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] px-5 py-5">
      <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-white/45">
          Nothing significant surfaced here — a good sign.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-white/70">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-crimson-light" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
