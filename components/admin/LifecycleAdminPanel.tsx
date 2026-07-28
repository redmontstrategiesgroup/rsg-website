"use client";

/**
 * Admin → Client OS. One panel for the entire client lifecycle: pipeline,
 * proposals, contracts, billing, clients (unified record), projects,
 * requests, tickets, training, reports, growth, automations, activity.
 * Self-loading (fetches /api/admin/lifecycle) like the other admin panels;
 * all mutations go through postJson → CSRF handled by lib/api.
 */

import { useCallback, useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import {
  Banner,
  Button,
  EmptyState,
  Modal,
  SectionCard,
  StatCard,
  StatusPill,
} from "@/components/portal/ui";
import { inputClass, Field } from "@/components/booking/ui";
import { formatCents } from "@/lib/lifecycle/types";
import {
  OPPORTUNITY_STAGE_LABELS,
  MILESTONE_STATUS_LABELS,
  type SalesOpportunity,
} from "@/lib/lifecycle/types";
import { formatInvoiceNumber } from "@/lib/lifecycle/billing-shared";

type Section =
  | "overview"
  | "pipeline"
  | "proposals"
  | "contracts"
  | "billing"
  | "clients"
  | "projects"
  | "requests"
  | "tickets"
  | "training"
  | "reports"
  | "growth"
  | "automations"
  | "activity";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "pipeline", label: "Pipeline" },
  { id: "proposals", label: "Proposals" },
  { id: "contracts", label: "Contracts" },
  { id: "billing", label: "Billing" },
  { id: "clients", label: "Clients" },
  { id: "projects", label: "Projects" },
  { id: "requests", label: "Requests" },
  { id: "tickets", label: "Tickets" },
  { id: "training", label: "Training" },
  { id: "reports", label: "Reports" },
  { id: "growth", label: "Renewals & Growth" },
  { id: "automations", label: "Automations" },
  { id: "activity", label: "Activity" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- admin panel renders many heterogeneous rows
type AnyRecord = Record<string, any>;

/** Detail views fetched by id alongside the main sections. */
type FetchSection =
  | Section
  | "client_detail"
  | "project_detail"
  | "request_thread"
  | "ticket_thread";

function useSection(section: FetchSection, params: Record<string, string> = {}) {
  const [data, setData] = useState<AnyRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ section, ...JSON.parse(key) }).toString();
      const res = await fetch(`/api/admin/lifecycle?${qs}`, { cache: "no-store" });
      const json = (await res.json()) as AnyRecord;
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [section, key]);

  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, loading, reload: load };
}

async function run(action: string, payload: AnyRecord): Promise<AnyRecord> {
  const res = await postJson("/api/admin/lifecycle", { action, ...payload });
  const json = (await res.json().catch(() => ({}))) as AnyRecord;
  if (!res.ok) throw new Error(json.error || `${action} failed`);
  return json;
}

function fmtDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" as const } : {}),
  });
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={empty} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 font-mono text-[0.55rem] uppercase tracking-label text-white/35">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06] align-top">
          {rows.map((cells, i) => (
            <tr key={i} className="hover:bg-white/[0.015]">
              {cells.map((cell, j) => (
                <td key={j} className="px-4 py-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Small inline action button with busy + error toast handling. */
function Act({
  label,
  onClick,
  onDone,
  confirm,
}: {
  label: string;
  onClick: () => Promise<unknown>;
  onDone: () => void;
  confirm?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="whitespace-nowrap text-xs text-crimson-light underline decoration-crimson/40 underline-offset-4 transition hover:text-white disabled:opacity-40"
      onClick={async () => {
        if (confirm && !window.confirm(confirm)) return;
        setBusy(true);
        try {
          await onClick();
          onDone();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Action failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Root panel
// ---------------------------------------------------------------------------

export function LifecycleAdminPanel() {
  const [section, setSection] = useState<Section>(() => {
    if (typeof window !== "undefined") {
      const s = new URLSearchParams(window.location.search).get("section");
      if (s && SECTIONS.some((x) => x.id === s)) return s as Section;
    }
    return "overview";
  });
  const [clientId, setClientId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10" role="tablist">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={section === s.id}
            onClick={() => {
              setSection(s.id);
              setClientId(null);
            }}
            className={`relative whitespace-nowrap px-3.5 py-2.5 text-sm transition ${
              section === s.id ? "text-white" : "text-white/45 hover:text-white/75"
            }`}
          >
            {s.label}
            {section === s.id && (
              <span className="absolute inset-x-3 -bottom-px h-px bg-crimson" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      {clientId ? (
        <ClientRecord clientId={clientId} onBack={() => setClientId(null)} />
      ) : (
        <>
          {section === "overview" && <Overview onOpenClient={setClientId} />}
          {section === "pipeline" && <Pipeline />}
          {section === "proposals" && <Proposals />}
          {section === "contracts" && <Contracts />}
          {section === "billing" && <Billing />}
          {section === "clients" && <Clients onOpen={setClientId} />}
          {section === "projects" && <Projects />}
          {section === "requests" && <Requests />}
          {section === "tickets" && <Tickets />}
          {section === "training" && <Training />}
          {section === "reports" && <Reports />}
          {section === "growth" && <Growth />}
          {section === "automations" && <Automations />}
          {section === "activity" && <Activity />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function Loading({ error }: { error: string | null }) {
  return error ? (
    <Banner tone="danger" title="Couldn't load this section">
      {error}
    </Banner>
  ) : (
    <p className="py-10 text-center text-sm text-white/40">Loading…</p>
  );
}

function Overview({ onOpenClient }: { onOpenClient: (id: string) => void }) {
  const { data, error, loading } = useSection("overview");
  if (loading || error || !data) return <Loading error={error} />;
  const c = data.counts as AnyRecord;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active opportunities" value={c.activeOpportunities} />
        <StatCard label="Active projects" value={c.activeProjects} />
        <StatCard
          label="Open tickets"
          value={c.openTickets}
          tone={c.openTickets > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Open invoices"
          value={c.openInvoices}
          tone={c.openInvoices > 0 ? "warning" : "success"}
        />
      </div>
      <SectionCard title="Most recent opportunities" padded={false}>
        <Table
          headers={["Business", "Stage", "Next action", "Party", "Due", "Value"]}
          empty="No opportunities yet — they appear when prospects qualify."
          rows={(data.opportunities as SalesOpportunity[]).map((o) => [
            <button
              key="n"
              className="text-left text-white/85 underline-offset-4 hover:underline"
              onClick={() => o.client_id && onOpenClient(o.client_id)}
            >
              {o.name}
            </button>,
            <StatusPill key="s" status={o.stage} label={OPPORTUNITY_STAGE_LABELS[o.stage]} />,
            <span key="a" className="text-white/60">{o.next_action ?? "—"}</span>,
            o.next_action_party,
            fmtDate(o.next_action_due),
            o.value_cents != null ? formatCents(o.value_cents) : "—",
          ])}
        />
      </SectionCard>
    </div>
  );
}

function Pipeline() {
  const { data, error, loading, reload } = useSection("pipeline");
  const [notesFor, setNotesFor] = useState<SalesOpportunity | null>(null);
  const [notes, setNotes] = useState("");
  if (loading || error || !data) return <Loading error={error} />;
  const leads = (data.leads ?? {}) as Record<string, AnyRecord>;
  const stages = Object.keys(OPPORTUNITY_STAGE_LABELS);

  return (
    <div className="space-y-6">
      <SectionCard title="Opportunities" padded={false} eyebrow="The journey spine">
        <Table
          headers={["Business", "Contact", "Stage", "Next action", "Actions"]}
          empty="No opportunities yet."
          rows={(data.opportunities as SalesOpportunity[]).map((o) => {
            const lead = o.lead_id ? leads[o.lead_id] : null;
            return [
              <span key="n" className="text-white/85">{o.name}</span>,
              <span key="c" className="text-xs text-white/50">
                {lead ? `${lead.name} · ${lead.email}` : "—"}
              </span>,
              <select
                key="stage"
                className={`${inputClass(false)} !w-auto !px-2 !py-1.5 text-xs`}
                value={o.stage}
                onChange={async (e) => {
                  try {
                    await run("update_opportunity", { id: o.id, stage: e.target.value });
                    reload();
                  } catch (err) {
                    window.alert(err instanceof Error ? err.message : "Failed");
                  }
                }}
              >
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {OPPORTUNITY_STAGE_LABELS[s as keyof typeof OPPORTUNITY_STAGE_LABELS]}
                  </option>
                ))}
              </select>,
              <span key="na" className="text-xs text-white/55">
                {o.next_action ?? "—"}
                {o.next_action_due ? ` · due ${fmtDate(o.next_action_due)}` : ""}
              </span>,
              <Act
                key="notes"
                label="Consultation notes"
                onClick={async () => {
                  setNotesFor(o);
                  setNotes(o.consultation_notes ?? "");
                }}
                onDone={() => {}}
              />,
            ];
          })}
        />
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Assessments" padded={false}>
          <Table
            headers={["Email", "Status", "Score", "Recommended", "Submitted", ""]}
            empty="No assessments yet."
            rows={(data.assessments as AnyRecord[]).map((a) => [
              <span key="e" className="text-xs text-white/70">{a.email}</span>,
              <StatusPill key="s" status={a.status} />,
              a.score ?? "—",
              <span key="r" className="text-xs">{a.recommended_service_category ?? "—"}</span>,
              fmtDate(a.submitted_at),
              a.status === "submitted" ? (
                <Act
                  key="rev"
                  label="Mark reviewed"
                  onClick={() => run("mark_assessment_reviewed", { id: a.id })}
                  onDone={reload}
                />
              ) : (
                ""
              ),
            ])}
          />
        </SectionCard>
        <SectionCard title="Preparation questionnaires" padded={false}>
          <Table
            headers={["Template", "Status", "Due", "Reminders", ""]}
            empty="Questionnaires are created automatically when consultations are booked."
            rows={(data.questionnaires as AnyRecord[]).map((q) => [
              q.template_key,
              <StatusPill key="s" status={q.status} />,
              fmtDate(q.due_at),
              q.reminder_count,
              ["pending", "in_progress"].includes(q.status) ? (
                <Act
                  key="w"
                  label="Waive"
                  confirm="Waive this questionnaire? The consultation proceeds without it."
                  onClick={() => run("waive_questionnaire", { id: q.id })}
                  onDone={reload}
                />
              ) : (
                ""
              ),
            ])}
          />
        </SectionCard>
      </div>

      <Modal
        open={notesFor !== null}
        onClose={() => setNotesFor(null)}
        title={`Consultation notes — ${notesFor?.name ?? ""}`}
        wide
        footer={
          <Button
            onClick={async () => {
              if (!notesFor) return;
              try {
                await run("update_opportunity", {
                  id: notesFor.id,
                  consultationNotes: notes,
                });
                setNotesFor(null);
                reload();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Save notes
          </Button>
        }
      >
        <textarea
          rows={10}
          className={inputClass(false)}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was discussed, decisions, internal review…"
        />
      </Modal>
    </div>
  );
}

function Proposals() {
  const { data, error, loading, reload } = useSection("proposals");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    opportunityId: "",
    templateKey: "business_systems",
    businessName: "",
    total: "",
    deposit: "",
    challenges: "",
    outcomes: "",
  });
  if (loading || error || !data) return <Loading error={error} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>New proposal</Button>
      </div>
      <SectionCard padded={false}>
        <Table
          headers={["Title", "Status", "Total", "Viewed", "Expires", "Actions"]}
          empty="No proposals yet — create one from a qualified opportunity."
          rows={(data.proposals as AnyRecord[]).map((p) => [
            <div key="t">
              <span className="text-white/85">{p.title}</span>
              <span className="ml-2 font-mono text-[0.55rem] text-white/30">v{p.version}</span>
            </div>,
            <StatusPill key="s" status={p.status} />,
            formatCents(p.total_cents),
            p.first_viewed_at
              ? `${fmtDate(p.first_viewed_at)} · ${Math.round((p.total_view_seconds ?? 0) / 60)}m viewed`
              : "—",
            fmtDate(p.expires_at),
            <div key="a" className="flex flex-wrap gap-3">
              {p.status === "draft" && (
                <Act
                  label="Send"
                  confirm="Send this proposal to the client by email?"
                  onClick={() => run("send_proposal", { id: p.id })}
                  onDone={reload}
                />
              )}
              {["sent", "viewed", "revision_requested"].includes(p.status) && (
                <Act
                  label="Withdraw"
                  confirm="Withdraw this proposal?"
                  onClick={() => run("withdraw_proposal", { id: p.id })}
                  onDone={reload}
                />
              )}
              {p.status === "approved" && (
                <Act
                  label="Create agreement"
                  onClick={() => run("create_contract", { proposalId: p.id, kind: "project" })}
                  onDone={reload}
                />
              )}
              <a
                className="text-xs text-white/45 underline underline-offset-4 hover:text-white"
                href={`/proposals/${p.token}`}
                target="_blank"
                rel="noreferrer"
              >
                Preview
              </a>
            </div>,
          ])}
        />
      </SectionCard>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New proposal"
        wide
        footer={
          <Button
            onClick={async () => {
              try {
                await run("create_proposal", {
                  opportunityId: form.opportunityId || undefined,
                  templateKey: form.templateKey,
                  businessName: form.businessName,
                  totalCents: Math.round(Number(form.total || 0) * 100),
                  depositCents: Math.round(Number(form.deposit || 0) * 100),
                  challenges: form.challenges.split("\n").filter(Boolean),
                  outcomes: form.outcomes.split("\n").filter(Boolean),
                });
                setCreating(false);
                reload();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Create draft
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Opportunity ID" hint="From the Pipeline tab — links everything together." optional>
              {(props) => (
                <input {...props} className={inputClass(false)} value={form.opportunityId}
                  onChange={(e) => setForm({ ...form, opportunityId: e.target.value })} />
              )}
            </Field>
            <Field label="Template">
              {(props) => (
                <select {...props} className={inputClass(false)} value={form.templateKey}
                  onChange={(e) => setForm({ ...form, templateKey: e.target.value })}>
                  <option value="growth_systems">Growth Systems</option>
                  <option value="operations_systems">Operations Systems</option>
                  <option value="business_systems">Business Systems</option>
                  <option value="private_ai">Private AI</option>
                  <option value="website_platform">Website & Platform</option>
                </select>
              )}
            </Field>
          </div>
          <Field label="Business name">
            {(props) => (
              <input {...props} className={inputClass(false)} value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total investment ($)">
              {(props) => (
                <input {...props} type="number" className={inputClass(false)} value={form.total}
                  onChange={(e) => setForm({ ...form, total: e.target.value })} />
              )}
            </Field>
            <Field label="Deposit ($)">
              {(props) => (
                <input {...props} type="number" className={inputClass(false)} value={form.deposit}
                  onChange={(e) => setForm({ ...form, deposit: e.target.value })} />
              )}
            </Field>
          </div>
          <Field label="Client challenges (one per line)" optional>
            {(props) => (
              <textarea {...props} rows={3} className={inputClass(false)} value={form.challenges}
                onChange={(e) => setForm({ ...form, challenges: e.target.value })} />
            )}
          </Field>
          <Field label="Desired outcomes (one per line)" optional>
            {(props) => (
              <textarea {...props} rows={3} className={inputClass(false)} value={form.outcomes}
                onChange={(e) => setForm({ ...form, outcomes: e.target.value })} />
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Contracts() {
  const { data, error, loading, reload } = useSection("contracts");
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <SectionCard padded={false} title="Agreements">
      <Table
        headers={["Title", "Kind", "Status", "Sent", "Completed", "Actions"]}
        empty='No agreements yet — approve a proposal, then "Create agreement".'
        rows={(data.contracts as AnyRecord[]).map((c) => [
          <span key="t" className="text-white/85">{c.title}</span>,
          c.kind,
          <StatusPill key="s" status={c.status} />,
          fmtDate(c.sent_at),
          fmtDate(c.completed_at),
          <div key="a" className="flex flex-wrap gap-3">
            {c.status === "draft" && (
              <Act
                label="Send for signature"
                confirm="Email this agreement to the signer?"
                onClick={() => run("send_contract", { id: c.id })}
                onDone={reload}
              />
            )}
            {c.status === "signed" && c.requires_countersign && (
              <Act
                label="Countersign"
                confirm="Countersign this agreement as Redmont? This executes it and triggers the deposit request."
                onClick={() => run("countersign_contract", { id: c.id })}
                onDone={reload}
              />
            )}
            {!["countersigned", "active", "voided", "declined"].includes(c.status) && (
              <Act
                label="Void"
                confirm="Void this agreement?"
                onClick={() => run("void_contract", { id: c.id })}
                onDone={reload}
              />
            )}
            <a
              className="text-xs text-white/45 underline underline-offset-4 hover:text-white"
              href={`/agreement/${c.token}`}
              target="_blank"
              rel="noreferrer"
            >
              View
            </a>
          </div>,
        ])}
      />
    </SectionCard>
  );
}

function Billing() {
  const { data, error, loading, reload } = useSection("billing");
  const [payFor, setPayFor] = useState<AnyRecord | null>(null);
  const [amount, setAmount] = useState("");
  const [ref, setRef] = useState("");
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <div className="space-y-6">
      <SectionCard title="Invoices" padded={false}>
        <Table
          headers={["Invoice", "Description", "Total", "Paid", "Status", "Actions"]}
          empty="Invoices appear when contracts execute (deposits) or when you create them."
          rows={(data.invoices as AnyRecord[]).map((i) => [
            <span key="n" className="font-mono text-xs">{formatInvoiceNumber(i.number)}</span>,
            <span key="d" className="text-white/70">{i.description}</span>,
            formatCents(i.total_cents),
            formatCents(i.amount_paid_cents),
            <StatusPill key="s" status={i.status} />,
            <div key="a" className="flex flex-wrap gap-3">
              {["open", "processing"].includes(i.status) && (
                <>
                  <Act
                    label="Record payment"
                    onClick={async () => {
                      setPayFor(i);
                      setAmount(String((i.total_cents - i.amount_paid_cents) / 100));
                    }}
                    onDone={() => {}}
                  />
                  <Act
                    label="Void"
                    confirm="Void this invoice?"
                    onClick={() => run("void_invoice", { id: i.id })}
                    onDone={reload}
                  />
                </>
              )}
              <a
                className="text-xs text-white/45 underline underline-offset-4 hover:text-white"
                href={`/pay/${i.token}`}
                target="_blank"
                rel="noreferrer"
              >
                Pay link
              </a>
            </div>,
          ])}
        />
      </SectionCard>

      <SectionCard title="Support SLA targets" eyebrow="Nothing is promised to clients until enabled">
        <div className="space-y-3">
          {(data.slaPolicies as AnyRecord[]).map((p) => (
            <div key={p.priority} className="flex flex-wrap items-center gap-4 text-sm">
              <span className="w-20 font-mono text-xs uppercase text-white/60">{p.priority}</span>
              <label className="flex items-center gap-2 text-xs text-white/55">
                Respond within
                <input
                  type="number"
                  className={`${inputClass(false)} !w-24 !px-2 !py-1.5 text-xs`}
                  defaultValue={p.target_response_minutes}
                  onBlur={(e) =>
                    void run("update_sla", {
                      priority: p.priority,
                      targetResponseMinutes: Number(e.target.value),
                    }).catch(() => {})
                  }
                />
                min
              </label>
              <label className="flex items-center gap-2 text-xs text-white/55">
                <input
                  type="checkbox"
                  className="accent-crimson"
                  defaultChecked={p.enabled}
                  onChange={(e) =>
                    void run("update_sla", { priority: p.priority, enabled: e.target.checked })
                      .then(reload)
                      .catch(() => {})
                  }
                />
                Promise this target to clients
              </label>
            </div>
          ))}
        </div>
      </SectionCard>

      <Modal
        open={payFor !== null}
        onClose={() => setPayFor(null)}
        title={`Record payment — ${payFor ? formatInvoiceNumber(payFor.number) : ""}`}
        footer={
          <Button
            onClick={async () => {
              if (!payFor) return;
              try {
                await run("record_payment", {
                  id: payFor.id,
                  amountCents: Math.round(Number(amount || 0) * 100),
                  provider: "manual",
                  providerRef: ref || undefined,
                });
                setPayFor(null);
                reload();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Record
          </Button>
        }
      >
        <p className="mb-4 text-xs leading-relaxed text-white/50">
          For bank transfers, checks, or other offline payments. Record the
          amount and a reference — never card numbers. If this completes a
          deposit, portal activation and project creation run automatically.
        </p>
        <Field label="Amount received ($)">
          {(props) => (
            <input {...props} type="number" className={inputClass(false)} value={amount}
              onChange={(e) => setAmount(e.target.value)} />
          )}
        </Field>
        <div className="mt-3">
          <Field label="Reference" optional hint="e.g. wire confirmation number">
            {(props) => (
              <input {...props} className={inputClass(false)} value={ref}
                onChange={(e) => setRef(e.target.value)} />
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Clients({ onOpen }: { onOpen: (id: string) => void }) {
  const { data, error, loading } = useSection("clients");
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <SectionCard title="Clients" padded={false}>
      <Table
        headers={["Company", "Contact", "Email", ""]}
        empty="No clients yet."
        rows={(data.clients as AnyRecord[]).map((c) => [
          <span key="c" className="text-white/85">{c.company}</span>,
          c.name,
          <span key="e" className="text-xs text-white/50">{c.email}</span>,
          <button
            key="o"
            className="text-xs text-crimson-light underline underline-offset-4 hover:text-white"
            onClick={() => onOpen(c.id)}
          >
            Open unified record
          </button>,
        ])}
      />
    </SectionCard>
  );
}

function ClientRecord({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const { data, error, loading } = useSection("client_detail", { id: clientId });
  if (loading || error || !data) return <Loading error={error} />;
  const blocks: { title: string; rows: AnyRecord[]; render: (r: AnyRecord) => string }[] = [
    {
      title: "Opportunities",
      rows: data.opportunities,
      render: (o) => `${o.name} — ${o.stage}`,
    },
    { title: "Proposals", rows: data.proposals, render: (p) => `${p.title} — ${p.status}` },
    { title: "Contracts", rows: data.contracts, render: (c) => `${c.title} — ${c.status}` },
    {
      title: "Invoices",
      rows: data.invoices,
      render: (i) => `${formatInvoiceNumber(i.number)} ${i.description} — ${i.status}`,
    },
    { title: "Projects", rows: data.projects, render: (p) => `${p.name} — ${p.status} (${p.progress}%)` },
    { title: "Requests", rows: data.requests, render: (r) => `#${r.number} ${r.title} — ${r.status}` },
    { title: "Tickets", rows: data.tickets, render: (t) => `#${t.number} ${t.subject} — ${t.status}` },
    { title: "Reports", rows: data.reports, render: (r) => `${r.period_month} — ${r.status}` },
    { title: "Renewals", rows: data.renewals, render: (r) => `${r.name} — ${r.renews_on} (${r.status})` },
    {
      title: "Expansion roadmap",
      rows: data.expansion,
      render: (e) => `${e.title} — ${e.status}`,
    },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
            Unified client record
          </p>
          <h3 className="font-display text-lg text-white">
            {data.client.company} <span className="text-white/40">· {data.client.name}</span>
          </h3>
        </div>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map((b) => (
          <SectionCard key={b.title} title={`${b.title} (${b.rows.length})`}>
            {b.rows.length === 0 ? (
              <p className="text-xs text-white/35">None.</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-white/65">
                {b.rows.slice(0, 8).map((r, i) => (
                  <li key={i}>{b.render(r)}</li>
                ))}
                {b.rows.length > 8 && (
                  <li className="text-white/35">…and {b.rows.length - 8} more</li>
                )}
              </ul>
            )}
          </SectionCard>
        ))}
      </div>
      <SectionCard title="Complete history" padded={false}>
        <ul className="max-h-96 divide-y divide-white/[0.06] overflow-y-auto">
          {(data.activity as AnyRecord[]).map((a) => (
            <li key={a.id} className="flex justify-between gap-4 px-5 py-2.5 text-xs">
              <span className="text-white/70">
                <span className="text-white/35">{a.actor_name || a.actor_type}: </span>
                {a.action}
              </span>
              <span className="shrink-0 text-white/30">{fmtDate(a.created_at, true)}</span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

function Projects() {
  const { data, error, loading } = useSection("projects");
  const [openId, setOpenId] = useState<string | null>(null);
  if (loading || error || !data) return <Loading error={error} />;
  if (openId) return <ProjectDetail id={openId} onBack={() => setOpenId(null)} />;
  return (
    <SectionCard title="Projects" padded={false}>
      <Table
        headers={["Code", "Name", "Status", "Health", "Progress", "Phase", ""]}
        empty="Projects are created automatically when deposits are paid."
        rows={(data.projects as AnyRecord[]).map((p) => [
          <span key="c" className="font-mono text-xs">{p.code}</span>,
          <span key="n" className="text-white/85">{p.name}</span>,
          <StatusPill key="s" status={p.status} />,
          <StatusPill key="h" status={p.health} />,
          `${p.progress}%`,
          p.current_phase,
          <button
            key="o"
            className="text-xs text-crimson-light underline underline-offset-4 hover:text-white"
            onClick={() => setOpenId(p.id)}
          >
            Manage
          </button>,
        ])}
      />
    </SectionCard>
  );
}

function ProjectDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, error, loading, reload } = useSection("project_detail", { id });
  if (loading || error || !data) return <Loading error={error} />;
  const statuses = Object.keys(MILESTONE_STATUS_LABELS);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-white">
          {data.project.name}{" "}
          <span className="font-mono text-xs text-white/40">{data.project.code}</span>
        </h3>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
      <SectionCard title="Milestones" padded={false}>
        <Table
          headers={["Milestone", "Owner", "Status", "Target", "Approval"]}
          empty="No milestones."
          rows={(data.milestones as AnyRecord[]).map((m) => [
            <div key="m">
              <span className="text-white/85">{m.name}</span>
              {m.client_action && (
                <p className="mt-0.5 text-[0.65rem] text-white/40">Client: {m.client_action}</p>
              )}
            </div>,
            m.owner_party,
            <select
              key="st"
              className={`${inputClass(false)} !w-auto !px-2 !py-1.5 text-xs`}
              value={m.status}
              onChange={async (e) => {
                try {
                  await run("update_milestone", {
                    id: m.id,
                    status: e.target.value,
                    previousStatus: m.status,
                  });
                  reload();
                } catch (err) {
                  window.alert(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {MILESTONE_STATUS_LABELS[s as keyof typeof MILESTONE_STATUS_LABELS]}
                </option>
              ))}
            </select>,
            fmtDate(m.target_date),
            m.approval_required
              ? m.approved_at
                ? `Approved by ${m.approved_by ?? "client"}`
                : "Client approval required"
              : "—",
          ])}
        />
      </SectionCard>
      <SectionCard title="Tasks" padded={false}>
        <Table
          headers={["Task", "Assignee", "Kind", "Status", "Due", ""]}
          empty="No tasks."
          rows={(data.tasks as AnyRecord[]).map((t) => [
            <span key="t" className="text-white/80">{t.title}</span>,
            t.assignee_party,
            t.kind,
            <StatusPill key="s" status={t.status} />,
            fmtDate(t.due_at),
            t.status !== "done" ? (
              <Act
                key="d"
                label="Mark done"
                onClick={() => run("update_task", { id: t.id, status: "done" })}
                onDone={reload}
              />
            ) : (
              ""
            ),
          ])}
        />
      </SectionCard>
    </div>
  );
}

function Requests() {
  const { data, error, loading, reload } = useSection("requests");
  const [threadFor, setThreadFor] = useState<AnyRecord | null>(null);
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <div className="space-y-4">
      <SectionCard title="Client requests" padded={false}>
        <Table
          headers={["#", "Title", "Category", "Priority", "Status", "Actions"]}
          empty="No client requests."
          rows={(data.requests as AnyRecord[]).map((r) => [
            <span key="n" className="font-mono text-xs">#{r.number}</span>,
            <div key="t">
              <span className="text-white/85">{r.title}</span>
              {r.change_order_required && (
                <span className="ml-2"><StatusPill status="needs_change_order" label="Scope" /></span>
              )}
            </div>,
            r.category,
            r.priority,
            <StatusPill key="s" status={r.status} />,
            <div key="a" className="flex flex-wrap gap-3">
              <Act label="Thread" onClick={async () => setThreadFor(r)} onDone={() => {}} />
              {!["resolved", "closed"].includes(r.status) && (
                <Act
                  label="Resolve"
                  onClick={async () => {
                    const resolution = window.prompt("Resolution summary (visible to the client):");
                    if (resolution) await run("resolve_request", { id: r.id, resolution });
                  }}
                  onDone={reload}
                />
              )}
            </div>,
          ])}
        />
      </SectionCard>
      {threadFor && (
        <ThreadModal
          title={`Request #${threadFor.number}: ${threadFor.title}`}
          section="request_thread"
          id={threadFor.id}
          clientId={threadFor.client_id}
          scope={{ requestId: threadFor.id }}
          onClose={() => setThreadFor(null)}
        />
      )}
    </div>
  );
}

function Tickets() {
  const { data, error, loading, reload } = useSection("tickets");
  const [threadFor, setThreadFor] = useState<AnyRecord | null>(null);
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <div className="space-y-4">
      <SectionCard title="Support tickets" padded={false}>
        <Table
          headers={["#", "Subject", "Priority", "Status", "Last activity", "Actions"]}
          empty="No tickets."
          rows={(data.tickets as AnyRecord[]).map((t) => [
            <span key="n" className="font-mono text-xs">#{t.number}</span>,
            <span key="s" className="text-white/85">{t.subject}</span>,
            t.priority,
            <StatusPill key="st" status={t.status} />,
            fmtDate(t.last_activity_at, true),
            <div key="a" className="flex flex-wrap gap-3">
              <Act label="Thread" onClick={async () => setThreadFor(t)} onDone={() => {}} />
              {!["resolved", "closed"].includes(t.status) && (
                <>
                  <Act
                    label={t.status === "waiting_on_client" ? "Set in progress" : "Waiting on client"}
                    onClick={() =>
                      run("update_ticket", {
                        id: t.id,
                        status: t.status === "waiting_on_client" ? "in_progress" : "waiting_on_client",
                      })
                    }
                    onDone={reload}
                  />
                  <Act
                    label="Resolve"
                    onClick={async () => {
                      const notes = window.prompt("Resolution notes (emailed to the client):");
                      if (notes) await run("resolve_ticket", { id: t.id, resolutionNotes: notes });
                    }}
                    onDone={reload}
                  />
                </>
              )}
            </div>,
          ])}
        />
      </SectionCard>
      {threadFor && (
        <ThreadModal
          title={`Ticket #${threadFor.number}: ${threadFor.subject}`}
          section="ticket_thread"
          id={threadFor.id}
          clientId={threadFor.client_id}
          scope={{ ticketId: threadFor.id }}
          onClose={() => setThreadFor(null)}
        />
      )}
    </div>
  );
}

function ThreadModal({
  title,
  section,
  id,
  clientId,
  scope,
  onClose,
}: {
  title: string;
  section: "request_thread" | "ticket_thread";
  id: string;
  clientId: string;
  scope: AnyRecord;
  onClose: () => void;
}) {
  const { data, error, loading, reload } = useSection(section, { id });
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={title} wide>
      {loading || error || !data ? (
        <Loading error={error} />
      ) : (
        <div className="space-y-3">
          {(data.messages as AnyRecord[]).map((m) => (
            <div
              key={m.id}
              className={`border px-3.5 py-2.5 ${
                m.internal
                  ? "border-amber-400/25 bg-amber-400/[0.04]"
                  : m.author_type === "admin"
                    ? "border-crimson/25 bg-crimson/[0.05]"
                    : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <p className="text-[0.65rem] text-white/35">
                {m.author_name || m.author_type}
                {m.internal && " · internal note"} · {fmtDate(m.created_at, true)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{m.body}</p>
            </div>
          ))}
          {(data.messages as AnyRecord[]).length === 0 && (
            <p className="text-center text-xs text-white/35">No messages yet.</p>
          )}
          <div className="border-t border-white/10 pt-3">
            <textarea
              rows={3}
              className={inputClass(false)}
              placeholder={internal ? "Internal note (never visible to the client)…" : "Reply to the client…"}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-white/50">
                <input
                  type="checkbox"
                  className="accent-crimson"
                  checked={internal}
                  onChange={(e) => setInternal(e.target.checked)}
                />
                Internal note
              </label>
              <Button
                busy={busy}
                onClick={async () => {
                  if (!body.trim()) return;
                  setBusy(true);
                  try {
                    await run("message", { clientId, ...scope, body: body.trim(), internal });
                    setBody("");
                    reload();
                  } catch (e) {
                    window.alert(e instanceof Error ? e.message : "Failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Training() {
  const { data, error, loading, reload } = useSection("training");
  if (loading || error || !data) return <Loading error={error} />;
  const items = data.items as AnyRecord[];
  return (
    <div className="space-y-4">
      {items.length === 0 && (
        <Banner tone="info" title="Load the starter library">
          Seed ten ready-to-use guides (CRM, leads, website updates, analytics,
          security practices…) that you can edit and assign per client.
        </Banner>
      )}
      <div className="flex justify-end gap-3">
        {items.length === 0 && (
          <Button
            onClick={() =>
              void run("seed_training", {}).then(reload).catch((e) =>
                window.alert(e instanceof Error ? e.message : "Failed"),
              )
            }
          >
            Seed starter library
          </Button>
        )}
      </div>
      <SectionCard title="Training items" padded={false}>
        <Table
          headers={["Title", "Kind", "System", "Difficulty", "Published", "Actions"]}
          empty="No training content yet."
          rows={items.map((t) => [
            <span key="t" className="text-white/85">{t.title}</span>,
            t.kind,
            t.system_tag || "—",
            t.difficulty,
            t.published ? "Yes" : "No",
            <div key="a" className="flex gap-3">
              <Act
                label={t.published ? "Unpublish" : "Publish"}
                onClick={() => run("update_training", { id: t.id, published: !t.published })}
                onDone={reload}
              />
              <Act
                label="Assign to client"
                onClick={async () => {
                  const clientId = window.prompt("Client ID (from the Clients tab):");
                  if (clientId) {
                    const required = window.confirm("Mark as REQUIRED training?");
                    await run("assign_training", { trainingItemId: t.id, clientId, required });
                    window.alert("Assigned — the client was notified.");
                  }
                }}
                onDone={() => {}}
              />
            </div>,
          ])}
        />
      </SectionCard>
    </div>
  );
}

function Reports() {
  const { data, error, loading, reload } = useSection("reports");
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [summary, setSummary] = useState("");
  const [wins, setWins] = useState("");
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={async () => {
            const clientId = window.prompt("Client ID (from the Clients tab):");
            if (!clientId) return;
            try {
              await run("create_report", { clientId });
              reload();
            } catch (e) {
              window.alert(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          New draft report
        </Button>
      </div>
      <SectionCard title="Monthly reports" padded={false}>
        <Table
          headers={["Period", "Title", "Status", "Published", "Actions"]}
          empty="No reports yet. Add metrics from a client's record, then create a draft."
          rows={(data.reports as AnyRecord[]).map((r) => [
            r.period_month,
            <span key="t" className="text-white/85">{r.title}</span>,
            <StatusPill key="s" status={r.status} />,
            fmtDate(r.published_at),
            <div key="a" className="flex gap-3">
              {r.status === "draft" && (
                <>
                  <Act
                    label="Edit narrative"
                    onClick={async () => {
                      setEditing(r);
                      setSummary(r.executive_summary ?? "");
                      setWins(((r.key_wins ?? []) as string[]).join("\n"));
                    }}
                    onDone={() => {}}
                  />
                  <Act
                    label="Publish"
                    confirm="Publish this report? The client is notified by email."
                    onClick={() => run("publish_report", { id: r.id })}
                    onDone={reload}
                  />
                </>
              )}
            </div>,
          ])}
        />
      </SectionCard>
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit report — ${editing?.period_month ?? ""}`}
        wide
        footer={
          <Button
            onClick={async () => {
              if (!editing) return;
              try {
                await run("update_report", {
                  id: editing.id,
                  executiveSummary: summary,
                  keyWins: wins.split("\n").filter(Boolean),
                });
                setEditing(null);
                reload();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Save
          </Button>
        }
      >
        <Field label="Executive summary" hint="Required before publishing. Plain language, honest.">
          {(props) => (
            <textarea {...props} rows={6} className={inputClass(false)} value={summary}
              onChange={(e) => setSummary(e.target.value)} />
          )}
        </Field>
        <div className="mt-3">
          <Field label="Key wins (one per line)" optional>
            {(props) => (
              <textarea {...props} rows={4} className={inputClass(false)} value={wins}
                onChange={(e) => setWins(e.target.value)} />
            )}
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Growth() {
  const { data, error, loading, reload } = useSection("growth");
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-3">
        <Button
          variant="ghost"
          onClick={async () => {
            const clientId = window.prompt("Client ID to analyze for expansion signals:");
            if (!clientId) return;
            try {
              const result = await run("suggest_expansion", { clientId });
              const suggestions = (result.suggestions ?? []) as AnyRecord[];
              if (suggestions.length === 0) {
                window.alert("No data-backed suggestions yet — that's honest, not broken.");
                return;
              }
              for (const s of suggestions) {
                if (window.confirm(`Add to roadmap?\n\n${s.title}\n${s.problem}`)) {
                  await run("create_expansion", { clientId, ...s, status: "recommended" });
                }
              }
              reload();
            } catch (e) {
              window.alert(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Suggest from client data
        </Button>
        <Button
          onClick={async () => {
            const clientId = window.prompt("Client ID:");
            const name = clientId && window.prompt("Renewal name (e.g. Care Plan — Annual):");
            const renewsOn = name && window.prompt("Renews on (YYYY-MM-DD):");
            if (clientId && name && renewsOn) {
              try {
                await run("create_renewal", { clientId, name, renewsOn });
                reload();
              } catch (e) {
                window.alert(e instanceof Error ? e.message : "Failed");
              }
            }
          }}
        >
          Add renewal
        </Button>
      </div>
      <SectionCard title="Renewals" padded={false}>
        <Table
          headers={["Name", "Kind", "Renews", "Status", "Value"]}
          empty="No renewals tracked yet."
          rows={(data.renewals as AnyRecord[]).map((r) => [
            <span key="n" className="text-white/85">{r.name}</span>,
            r.kind,
            fmtDate(r.renews_on),
            <StatusPill key="s" status={r.status} />,
            r.value_cents != null ? formatCents(r.value_cents) : "—",
          ])}
        />
      </SectionCard>
    </div>
  );
}

function Automations() {
  const { data, error, loading, reload } = useSection("automations");
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <div className="space-y-6">
      <SectionCard title="Automations" eyebrow="Trigger → conditions → action, with dedupe" padded={false}>
        <Table
          headers={["Automation", "Trigger", "Channel", "Delay", "Enabled"]}
          empty="No automations."
          rows={(data.settings as AnyRecord[]).map((s) => [
            <div key="l">
              <span className="text-white/85">{s.label ?? s.id}</span>
              <p className="mt-0.5 text-[0.65rem] text-white/40">{s.description ?? ""}</p>
            </div>,
            <span key="t" className="text-xs text-white/55">{s.trigger ?? "—"}</span>,
            <select
              key="c"
              className={`${inputClass(false)} !w-auto !px-2 !py-1.5 text-xs`}
              defaultValue={s.channel}
              onChange={(e) =>
                void run("update_automation", { id: s.id, channel: e.target.value }).catch(() => {})
              }
            >
              <option value="email">Email</option>
              <option value="in_app">In-app</option>
              <option value="both">Both</option>
              <option value="none">None</option>
            </select>,
            <input
              key="d"
              type="number"
              className={`${inputClass(false)} !w-20 !px-2 !py-1.5 text-xs`}
              defaultValue={s.delay_minutes}
              onBlur={(e) =>
                void run("update_automation", { id: s.id, delayMinutes: Number(e.target.value) }).catch(
                  () => {},
                )
              }
            />,
            <input
              key="e"
              type="checkbox"
              className="accent-crimson"
              defaultChecked={s.enabled}
              onChange={(e) =>
                void run("update_automation", { id: s.id, enabled: e.target.checked }).catch(() => {})
              }
            />,
          ])}
        />
      </SectionCard>
      <SectionCard title="Recent runs" padded={false}>
        <Table
          headers={["Automation", "Entity", "Status", "Scheduled", "Executed", ""]}
          empty="No automation runs yet."
          rows={(data.runs as AnyRecord[]).map((r) => [
            r.automation_key,
            <span key="e" className="font-mono text-[0.6rem] text-white/40">
              {r.entity_type}:{String(r.entity_id).slice(0, 8)}
            </span>,
            <StatusPill key="s" status={r.status === "completed" ? "completed" : r.status} />,
            fmtDate(r.scheduled_for, true),
            fmtDate(r.executed_at, true),
            r.status === "failed" ? (
              <Act
                key="r"
                label="Retry"
                onClick={() => run("retry_automation_run", { id: r.id })}
                onDone={reload}
              />
            ) : (
              ""
            ),
          ])}
        />
      </SectionCard>
    </div>
  );
}

function Activity() {
  const { data, error, loading } = useSection("activity");
  if (loading || error || !data) return <Loading error={error} />;
  return (
    <SectionCard title="Lifecycle activity" padded={false}>
      <ul className="divide-y divide-white/[0.06]">
        {(data.activity as AnyRecord[]).map((a) => (
          <li key={a.id} className="flex justify-between gap-4 px-5 py-2.5 text-xs">
            <span className="text-white/70">
              <span className="text-white/35">{a.actor_name || a.actor_type}: </span>
              {a.action}
            </span>
            <span className="shrink-0 text-white/30">{fmtDate(a.created_at, true)}</span>
          </li>
        ))}
        {(data.activity as AnyRecord[]).length === 0 && (
          <li className="px-5 py-8 text-center text-white/35">No activity yet.</li>
        )}
      </ul>
    </SectionCard>
  );
}
