"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Message, Ticket, TicketCategory } from "@/lib/lifecycle/types";
import { TICKET_CATEGORY_LABELS } from "@/lib/lifecycle/types";
import {
  Banner,
  Button,
  EmptyState,
  Modal,
  StatusPill,
} from "@/components/portal/ui";
import { inputClass, Field } from "@/components/booking/ui";
import { postJson } from "@/lib/api";

const CATEGORY_OPTIONS = Object.entries(TICKET_CATEGORY_LABELS) as [
  TicketCategory,
  string,
][];

export function SupportView({
  tickets,
  threads,
  userName,
}: {
  tickets: Ticket[];
  threads: Record<string, Message[]>;
  userName: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<TicketCategory>("bug");
  const [priority, setPriority] = useState("normal");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState<Record<string, string>>({});

  const open = tickets.filter((t) => !["resolved", "closed"].includes(t.status));
  const closed = tickets.filter((t) => ["resolved", "closed"].includes(t.status));

  async function createTicket() {
    setError(null);
    if (subject.trim().length < 3) {
      setError("Give the ticket a short subject.");
      return;
    }
    if (description.trim().length < 10) {
      setError("A sentence or two of detail helps us resolve this fast.");
      return;
    }
    setBusy(true);
    try {
      const res = await postJson("/api/portal/support", {
        action: "create",
        category,
        priority,
        subject: subject.trim(),
        description: description.trim(),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't open the ticket.");
      setCreating(false);
      setSubject("");
      setDescription("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open the ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await postJson("/api/portal/support", body);
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function TicketCard({ t }: { t: Ticket }) {
    const thread = threads[t.id] ?? [];
    const isOpen = expanded === t.id;
    return (
      <div className="card">
        <button
          type="button"
          className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left"
          onClick={() => setExpanded(isOpen ? null : t.id)}
          aria-expanded={isOpen}
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/90">
              <span className="mr-2 font-mono text-[0.6rem] text-white/30">#{t.number}</span>
              {t.subject}
            </p>
            <p className="mt-1 text-xs text-white/40">
              {TICKET_CATEGORY_LABELS[t.category]} · opened{" "}
              {new Date(t.created_at).toLocaleDateString("en-US", { dateStyle: "medium" })} ·
              updated{" "}
              {new Date(t.last_activity_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(t.priority === "urgent" || t.priority === "critical") && (
              <StatusPill status="escalated" label={t.priority} />
            )}
            <StatusPill status={t.status} />
          </div>
        </button>

        {isOpen && (
          <div className="border-t border-white/10 px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/65">
              {t.description}
            </p>
            {t.target_response_minutes != null && !t.first_response_at && (
              <p className="mt-2 text-xs text-white/40">
                Target first response:{" "}
                {t.target_response_minutes >= 60
                  ? `${Math.round(t.target_response_minutes / 60)}h`
                  : `${t.target_response_minutes}m`}
              </p>
            )}
            {t.resolution_notes && (
              <p className="mt-3 border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-xs leading-relaxed text-emerald-200/80">
                Resolution: {t.resolution_notes}
              </p>
            )}
            <div className="mt-4 space-y-3">
              {thread.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] border px-3.5 py-2.5 ${
                    m.author_type === "client"
                      ? "ml-auto border-crimson/25 bg-crimson/[0.06]"
                      : "border-white/10 bg-white/[0.02]"
                  }`}
                >
                  <p className="text-[0.65rem] text-white/35">
                    {m.author_type === "client" ? m.author_name || userName : "Redmont Support"}
                    {" · "}
                    {new Date(m.created_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{m.body}</p>
                </div>
              ))}
            </div>

            {t.status === "resolved" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button busy={busy} onClick={() => void act({ action: "confirm_close", ticketId: t.id })}>
                  Everything works — close it
                </Button>
                <Button
                  variant="ghost"
                  busy={busy}
                  onClick={() => void act({ action: "reopen", ticketId: t.id })}
                >
                  Still not right — reopen
                </Button>
              </div>
            )}

            {t.status !== "closed" && (
              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  className={`${inputClass(false)} !py-2.5 text-sm`}
                  placeholder="Add a reply…"
                  value={reply[t.id] ?? ""}
                  onChange={(e) => setReply((prev) => ({ ...prev, [t.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      const text = (reply[t.id] ?? "").trim();
                      if (text) {
                        void act({ action: "reply", ticketId: t.id, body: text }).then(() =>
                          setReply((prev) => ({ ...prev, [t.id]: "" })),
                        );
                      }
                    }
                  }}
                  aria-label="Reply"
                />
                <Button
                  busy={busy}
                  onClick={() => {
                    const text = (reply[t.id] ?? "").trim();
                    if (text) {
                      void act({ action: "reply", ticketId: t.id, body: text }).then(() =>
                        setReply((prev) => ({ ...prev, [t.id]: "" })),
                      );
                    }
                  }}
                >
                  Send
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>Open a ticket</Button>
      </div>

      {error && !creating && <Banner tone="danger">{error}</Banner>}

      {tickets.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No support tickets"
            description="If anything ever misbehaves — an automation, the website, a report — open a ticket and it's tracked from first report to confirmed fix."
            action={<Button onClick={() => setCreating(true)}>Open your first ticket</Button>}
          />
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div className="space-y-3">
              {open.map((t) => (
                <TicketCard key={t.id} t={t} />
              ))}
            </div>
          )}
          {closed.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer select-none text-xs text-white/40 transition hover:text-white/70">
                Resolved & closed ({closed.length})
              </summary>
              <div className="mt-3 space-y-3">
                {closed.map((t) => (
                  <TicketCard key={t.id} t={t} />
                ))}
              </div>
            </details>
          )}
        </>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Open a support ticket"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={createTicket} busy={busy}>
              Submit ticket
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              {(props) => (
                <select
                  {...props}
                  className={inputClass(false)}
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                >
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="How urgent is this?">
              {(props) => (
                <select
                  {...props}
                  className={inputClass(false)}
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="low">Low — no rush</option>
                  <option value="normal">Normal</option>
                  <option value="high">High — impacting our work</option>
                  <option value="urgent">Urgent — major disruption</option>
                  <option value="critical">Critical — business is down</option>
                </select>
              )}
            </Field>
          </div>
          <Field label="Subject">
            {(props) => (
              <input
                {...props}
                type="text"
                className={inputClass(false)}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's happening, in one line"
              />
            )}
          </Field>
          <Field
            label="Details"
            hint="What were you doing, what did you expect, and what happened instead? Screenshots can be added afterward from Requests & Files."
          >
            {(props) => (
              <textarea
                {...props}
                rows={5}
                className={inputClass(false)}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          {error && (
            <p role="alert" className="text-xs text-crimson-light">{error}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
