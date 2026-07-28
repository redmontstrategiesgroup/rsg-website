"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Approval,
  Milestone,
  Project,
  ProjectTask,
  StoredFile,
} from "@/lib/lifecycle/types";
import { MILESTONE_STATUS_LABELS } from "@/lib/lifecycle/types";
import {
  Banner,
  Button,
  EmptyState,
  Modal,
  ProgressBar,
  SectionCard,
  StatCard,
  StatusPill,
  Timeline,
  TimelineItem,
} from "@/components/portal/ui";
import { inputClass } from "@/components/booking/ui";
import { postJson } from "@/lib/api";

const DONE = new Set(["approved", "completed"]);
const WARN = new Set(["delayed", "blocked", "changes_requested"]);

export function ProjectView({
  project,
  milestones,
  tasks,
  approvals,
  files,
  canApprove,
  projects,
}: {
  project: Project;
  milestones: Milestone[];
  tasks: ProjectTask[];
  approvals: Approval[];
  files: StoredFile[];
  canApprove: boolean;
  projects: { id: string; name: string; status: string }[];
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<{
    kind: "milestone" | "approval";
    id: string;
    title: string;
    mode: "approve" | "changes";
  } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientTasks = tasks.filter(
    (t) => t.assignee_party === "client" && !["done", "cancelled"].includes(t.status),
  );
  const nextMilestone = milestones.find((m) => !DONE.has(m.status));

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson("/api/portal/project", body);
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "That didn't go through.");
      setDecision(null);
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {projects.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <a
              key={p.id}
              href={`/portal/project?id=${p.id}`}
              className={`border px-3.5 py-2 text-xs transition ${
                p.id === project.id
                  ? "border-crimson/60 bg-crimson/[0.08] text-white"
                  : "border-white/10 text-white/50 hover:border-white/30"
              }`}
            >
              {p.name}
            </a>
          ))}
        </div>
      )}

      {/* Health strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Status"
          value={<StatusPill status={project.status} />}
          sub={`Current phase: ${project.current_phase}`}
        />
        <div className="card px-5 py-4">
          <p className="font-mono text-[0.55rem] uppercase tracking-label text-white/40">
            Overall progress
          </p>
          <p className="mt-2 font-display text-xl font-medium text-white">
            {project.progress}%
          </p>
          <div className="mt-2">
            <ProgressBar value={project.progress} ariaLabel="Project progress" />
          </div>
        </div>
        <StatCard
          label="Schedule"
          value={<StatusPill status={project.health} />}
          sub={
            project.target_launch_date
              ? `Target launch ${new Date(project.target_launch_date).toLocaleDateString("en-US", { dateStyle: "medium" })}`
              : "Launch date set after discovery"
          }
        />
        <StatCard
          label="Waiting on you"
          value={clientTasks.length + approvals.length}
          sub={
            clientTasks.length + approvals.length === 0
              ? "Nothing — we're on it"
              : "Items below need your input"
          }
          tone={clientTasks.length + approvals.length > 0 ? "warning" : "success"}
        />
      </div>

      {(clientTasks.length > 0 || approvals.length > 0) && (
        <SectionCard title="Needs your attention" eyebrow="Action items">
          <div className="space-y-3">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white/85">{a.title}</p>
                  {a.description && (
                    <p className="mt-0.5 text-xs text-white/45">{a.description}</p>
                  )}
                  {a.due_at && (
                    <p className="mt-0.5 text-[0.65rem] text-white/35">
                      Requested by{" "}
                      {new Date(a.due_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </p>
                  )}
                </div>
                {canApprove ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        setDecision({ kind: "approval", id: a.id, title: a.title, mode: "approve" })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setDecision({ kind: "approval", id: a.id, title: a.title, mode: "changes" })
                      }
                    >
                      Request changes
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-white/40">Awaiting an account admin</p>
                )}
              </div>
            ))}
            {clientTasks.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 border border-white/10 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white/85">{t.title}</p>
                  {t.description && (
                    <p className="mt-0.5 text-xs leading-relaxed text-white/45">
                      {t.description}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  busy={busy}
                  onClick={() => act({ action: "complete_task", taskId: t.id })}
                >
                  Mark done
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Roadmap */}
      <SectionCard title="Project roadmap" eyebrow="Milestones">
        {milestones.length === 0 ? (
          <EmptyState
            title="Roadmap coming together"
            description="Milestones appear here as soon as your project plan is finalized."
          />
        ) : (
          <Timeline>
            {milestones.map((m, i) => {
              const status = DONE.has(m.status)
                ? "complete"
                : WARN.has(m.status)
                  ? "warning"
                  : m.id === nextMilestone?.id || m.status === "in_progress"
                    ? "current"
                    : "upcoming";
              return (
                <TimelineItem
                  key={m.id}
                  status={status}
                  last={i === milestones.length - 1}
                  title={m.name}
                  meta={<StatusPill status={m.status} label={MILESTONE_STATUS_LABELS[m.status]} />}
                >
                  {m.description && <p>{m.description}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-white/35">
                    <span>
                      Owner: {m.owner_party === "rsg" ? "Redmont" : m.owner_party === "client" ? "Your team" : "Shared"}
                    </span>
                    {m.target_date && (
                      <span>
                        Target {new Date(m.target_date).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </span>
                    )}
                    {m.completed_on && (
                      <span>
                        Completed {new Date(m.completed_on).toLocaleDateString("en-US", { dateStyle: "medium" })}
                      </span>
                    )}
                  </div>
                  {m.status === "delayed" && (
                    <p className="mt-2 text-amber-300/80">
                      Running behind its target — the dates above are current and honest.
                    </p>
                  )}
                  {m.client_action && !DONE.has(m.status) && (
                    <p className="mt-2 text-white/60">
                      <span className="text-white/40">From your side: </span>
                      {m.client_action}
                    </p>
                  )}
                  {m.deliverables.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {m.deliverables.map((d, j) => (
                        <li key={j} className="flex gap-2 text-white/55">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-white/25" />
                          {d.title}
                          {d.detail ? ` — ${d.detail}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {m.approval_required && m.status === "under_review" && canApprove && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        onClick={() =>
                          setDecision({ kind: "milestone", id: m.id, title: m.name, mode: "approve" })
                        }
                      >
                        Approve milestone
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setDecision({ kind: "milestone", id: m.id, title: m.name, mode: "changes" })
                        }
                      >
                        Request changes
                      </Button>
                    </div>
                  )}
                </TimelineItem>
              );
            })}
          </Timeline>
        )}
      </SectionCard>

      {files.length > 0 && (
        <SectionCard
          title="Recent project files"
          eyebrow="Files"
          actions={
            <a href="/portal/workspace" className="link-underline text-xs text-white/50">
              All files
            </a>
          }
        >
          <ul className="divide-y divide-white/[0.06]">
            {files.slice(0, 6).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-sm text-white/75">{f.name}</span>
                <span className="shrink-0 text-[0.65rem] text-white/35">
                  {new Date(f.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <Modal
        open={decision !== null}
        onClose={() => setDecision(null)}
        title={
          decision?.mode === "approve"
            ? `Approve: ${decision.title}`
            : `Request changes: ${decision?.title ?? ""}`
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              busy={busy}
              onClick={() => {
                if (!decision) return;
                if (decision.mode === "changes" && note.trim().length === 0) {
                  setError("A short note helps us get it right — what should change?");
                  return;
                }
                void act(
                  decision.kind === "milestone"
                    ? {
                        action:
                          decision.mode === "approve"
                            ? "approve_milestone"
                            : "milestone_changes",
                        milestoneId: decision.id,
                        note: note.trim() || undefined,
                      }
                    : {
                        action: "decide_approval",
                        approvalId: decision.id,
                        decision: decision.mode === "approve" ? "approved" : "changes_requested",
                        note: note.trim() || undefined,
                      },
                );
              }}
            >
              {decision?.mode === "approve" ? "Confirm approval" : "Send request"}
            </Button>
          </>
        }
      >
        {decision?.mode === "approve" ? (
          <p className="text-sm leading-relaxed text-white/55">
            Approving signs off on this work and lets the next phase begin.
            You can add an optional note below.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-white/55">
            Tell us what needs adjusting — we&rsquo;ll revise and bring it back
            for another look.
          </p>
        )}
        <textarea
          rows={3}
          className={`mt-4 ${inputClass(false)}`}
          placeholder={decision?.mode === "approve" ? "Optional note" : "What should change?"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          aria-label="Note"
        />
        {error && (
          <p role="alert" className="mt-3 text-xs text-crimson-light">{error}</p>
        )}
      </Modal>

      {error && !decision && (
        <Banner tone="danger" title="Something didn't go through">
          {error}
        </Banner>
      )}
    </div>
  );
}
