"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  RefreshCw,
  Check,
  AlertTriangle,
  FlaskConical,
} from "lucide-react";
import { postJson } from "@/lib/api";
import { INTEGRATION_PLACEHOLDERS } from "@/lib/scheduling/integrations/types";

type SubTab =
  | "dashboard"
  | "calendar"
  | "bookings"
  | "qualification"
  | "availability"
  | "types"
  | "notifications"
  | "team"
  | "webhooks"
  | "jobs"
  | "testing";

const SUBS: { id: SubTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Calendar" },
  { id: "bookings", label: "Bookings" },
  { id: "qualification", label: "Qualification" },
  { id: "availability", label: "Availability" },
  { id: "types", label: "Types & Services" },
  { id: "notifications", label: "Notifications" },
  { id: "team", label: "Team" },
  { id: "webhooks", label: "Webhooks" },
  { id: "jobs", label: "Jobs" },
  { id: "testing", label: "Testing" },
];

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-white/10 bg-white/[0.02] p-4">
      <p className="font-mono text-[0.58rem] uppercase tracking-label text-white/40">
        {label}
      </p>
      <p className="mt-2 text-2xl text-white">{value}</p>
    </div>
  );
}

export function SchedulingAdminPanel() {
  const [sub, setSub] = useState<SubTab>("dashboard");
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [bookings, setBookings] = useState<Record<string, unknown>[]>([]);
  const [calendar, setCalendar] = useState<Record<string, unknown>[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Record<string, unknown> | null>(null);
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [ruleDraft, setRuleDraft] = useState<Record<string, unknown> | null>(null);
  const [templateDraft, setTemplateDraft] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      if (sub === "dashboard") {
        const r = await fetch("/api/admin/scheduling?section=dashboard");
        setDashboard(await r.json());
      } else if (sub === "bookings") {
        const r = await fetch("/api/admin/scheduling?section=bookings");
        const j = await r.json();
        setBookings(j.bookings || []);
      } else if (sub === "calendar") {
        const from = new Date().toISOString();
        const to = new Date(Date.now() + 45 * 86400000).toISOString();
        const r = await fetch(
          `/api/admin/scheduling?section=calendar&from=${from}&to=${to}`
        );
        const j = await r.json();
        setCalendar(j.bookings || []);
      } else {
        const r = await fetch("/api/admin/scheduling?section=config");
        const j = await r.json();
        setConfig(j);
        if (j.ruleSets?.[0]) setRuleDraft(j.ruleSets[0]);
        if (j.templates?.[0]) setTemplateDraft(j.templates[0]);
      }
    } catch {
      setMessage("Failed to load scheduling data. Ensure Supabase migration is applied.");
    } finally {
      setLoading(false);
    }
  }, [sub]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: string, payload: Record<string, unknown> = {}) {
    setMessage("");
    const res = await postJson("/api/admin/scheduling", { action, ...payload });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      setMessage(data.error || "Action failed");
      return data;
    }
    setMessage("Saved.");
    await load();
    return data;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="display text-xl text-white">Scheduling</h2>
          <p className="mt-1 text-sm text-white/45">
            Native consultation booking, qualification, and calendar controls.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/book" target="_blank" className="btn-ghost px-3 py-2 text-xs">
            Preview public flow
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/70"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-white/10 pb-px">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSub(s.id)}
            className={`shrink-0 px-3 py-2 text-xs ${
              sub === s.id ? "border-b border-crimson text-white" : "text-white/45"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="border border-white/15 bg-white/[0.03] px-4 py-2 text-sm text-white/70">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {sub === "dashboard" && dashboard && !("error" in dashboard) && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Today" value={String(dashboard.today ?? 0)} />
                <Stat label="This week" value={String(dashboard.week ?? 0)} />
                <Stat
                  label="Pending review"
                  value={String(dashboard.pendingReview ?? 0)}
                />
                <Stat
                  label="Qualified — not booked"
                  value={String(dashboard.qualifiedNotBooked ?? 0)}
                />
                <Stat
                  label="Intake → booking"
                  value={`${dashboard.conversionRate ?? 0}%`}
                />
                <Stat
                  label="Cancel rate"
                  value={`${dashboard.cancellationRate ?? 0}%`}
                />
                <Stat
                  label="Reschedule rate"
                  value={`${dashboard.rescheduleRate ?? 0}%`}
                />
                <Stat label="No-show rate" value={`${dashboard.noShowRate ?? 0}%`} />
                <Stat label="Avg score" value={String(dashboard.avgScore ?? 0)} />
                <Stat
                  label="Popular type"
                  value={String(dashboard.popularType ?? "—")}
                />
                <Stat
                  label="Top service"
                  value={String(dashboard.popularService ?? "—")}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="border border-white/10 p-4">
                  <p className="label mb-3">Upcoming</p>
                  <ul className="space-y-3 text-sm">
                    {((dashboard.upcoming as unknown[]) || []).map(
                      (b: unknown) => {
                        const row = b as {
                          id: string;
                          starts_at: string;
                          appointment_types?: { name?: string };
                          leads?: { name?: string; business_name?: string };
                        };
                        return (
                          <li
                            key={row.id}
                            className="flex justify-between gap-3 border-b border-white/5 pb-2"
                          >
                            <span>
                              {row.leads?.name || "—"}
                              <span className="block text-xs text-white/40">
                                {row.appointment_types?.name} ·{" "}
                                {row.leads?.business_name}
                              </span>
                            </span>
                            <span className="text-xs text-white/50">
                              {new Date(row.starts_at).toLocaleString()}
                            </span>
                          </li>
                        );
                      }
                    )}
                    {!((dashboard.upcoming as unknown[]) || []).length && (
                      <li className="text-white/40">No upcoming appointments.</li>
                    )}
                  </ul>
                </div>
                <div className="border border-white/10 p-4">
                  <p className="label mb-3">Failed emails</p>
                  <ul className="space-y-2 text-sm text-white/60">
                    {((dashboard.failedEmails as unknown[]) || []).map(
                      (e: unknown) => {
                        const row = e as {
                          id: string;
                          recipient: string;
                          error?: string;
                        };
                        return (
                          <li key={row.id}>
                            {row.recipient}: {row.error}
                          </li>
                        );
                      }
                    )}
                    {!((dashboard.failedEmails as unknown[]) || []).length && (
                      <li className="text-white/40">No failures.</li>
                    )}
                  </ul>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/50">
                    <div>
                      Outcomes:{" "}
                      {JSON.stringify(dashboard.byOutcome ?? {})}
                    </div>
                    <div>
                      Sources: {JSON.stringify(dashboard.bySource ?? {})}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {sub === "calendar" && (
            <div className="space-y-3">
              <p className="label">Agenda (next 45 days)</p>
              {calendar.map((b) => {
                const row = b as {
                  id: string;
                  starts_at: string;
                  ends_at: string;
                  status: string;
                  appointment_types?: { name?: string; color?: string };
                  leads?: { name?: string; business_name?: string };
                  manage_token?: string;
                };
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedBooking(row)}
                    className="flex w-full items-start justify-between gap-4 border border-white/10 bg-white/[0.02] px-4 py-3 text-left text-sm hover:border-white/25"
                  >
                    <div className="flex gap-3">
                      <span
                        className="mt-1 h-3 w-3 shrink-0"
                        style={{
                          background: row.appointment_types?.color || "#b3243a",
                        }}
                      />
                      <div>
                        <p className="text-white">
                          {row.appointment_types?.name} — {row.leads?.name}
                        </p>
                        <p className="text-xs text-white/40">
                          {row.leads?.business_name} · {row.status}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-white/50">
                      {new Date(row.starts_at).toLocaleString()}
                    </span>
                  </button>
                );
              })}
              {!calendar.length && (
                <p className="text-sm text-white/40">No appointments in range.</p>
              )}
            </div>
          )}

          {sub === "bookings" && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[0.65rem] uppercase tracking-wider text-white/40">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-3">When</th>
                    <th className="py-2 pr-3">Lead</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Score</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const row = b as {
                      id: string;
                      starts_at: string;
                      status: string;
                      lead_id?: string;
                      manage_token?: string;
                      appointment_types?: { name?: string };
                      leads?: {
                        name?: string;
                        business_name?: string;
                        email?: string;
                        qualification_score?: number;
                        qualification_outcome?: string;
                      };
                    };
                    return (
                      <tr key={row.id} className="border-b border-white/5">
                        <td className="py-3 pr-3 text-xs text-white/60">
                          {new Date(row.starts_at).toLocaleString()}
                        </td>
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            className="text-left text-white hover:underline"
                            onClick={() => setSelectedBooking(row)}
                          >
                            {row.leads?.name}
                          </button>
                          <div className="text-xs text-white/40">
                            {row.leads?.business_name}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-white/70">
                          {row.appointment_types?.name}
                        </td>
                        <td className="py-3 pr-3 text-white/60">
                          {row.leads?.qualification_score ?? "—"}
                          <span className="block text-[0.65rem] text-white/35">
                            {row.leads?.qualification_outcome}
                          </span>
                        </td>
                        <td className="py-3 pr-3">{row.status}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="text-xs text-crimson-light"
                              onClick={() =>
                                run("mark_status", {
                                  bookingId: row.id,
                                  leadId: row.lead_id,
                                  status: "completed",
                                })
                              }
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="text-xs text-white/50"
                              onClick={() =>
                                run("mark_status", {
                                  bookingId: row.id,
                                  leadId: row.lead_id,
                                  status: "no_show",
                                })
                              }
                            >
                              No-show
                            </button>
                            <button
                              type="button"
                              className="text-xs text-white/50"
                              onClick={() =>
                                run("admin_cancel", { bookingId: row.id })
                              }
                            >
                              Cancel
                            </button>
                            {row.manage_token && (
                              <Link
                                href={`/booking/manage/${row.manage_token}`}
                                className="text-xs text-white/50 underline"
                                target="_blank"
                              >
                                Manage link
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!bookings.length && (
                <p className="py-8 text-sm text-white/40">No bookings yet.</p>
              )}
            </div>
          )}

          {sub === "qualification" && config && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="label mb-3">Questions</p>
                <ul className="max-h-96 space-y-2 overflow-y-auto text-sm">
                  {((config.questions as unknown[]) || []).map((q) => {
                    const row = q as {
                      id: string;
                      label: string;
                      question_type: string;
                      required: boolean;
                      max_points: number;
                      sort_order: number;
                      key: string;
                    };
                    return (
                      <li
                        key={row.id}
                        className="border border-white/10 px-3 py-2"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="text-white">{row.label}</span>
                          <span className="text-[0.65rem] text-white/35">
                            {row.question_type} · {row.max_points}pts
                          </span>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="text-xs text-white/50"
                            onClick={() =>
                              run("upsert_question", {
                                question: {
                                  ...row,
                                  required: !row.required,
                                },
                              })
                            }
                          >
                            Toggle required ({row.required ? "on" : "off"})
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="label mb-3">Published rule set</p>
                {ruleDraft && (
                  <div className="space-y-3 text-sm">
                    <label className="block">
                      <span className="text-white/45">Min qualifying score</span>
                      <input
                        type="number"
                        className="mt-1 w-full border border-white/15 bg-transparent px-3 py-2"
                        value={Number(ruleDraft.min_qualifying_score ?? 55)}
                        onChange={(e) =>
                          setRuleDraft({
                            ...ruleDraft,
                            min_qualifying_score: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="text-white/45">
                        Allow calendar on manual review
                      </span>
                      <input
                        type="checkbox"
                        className="ml-3"
                        checked={Boolean(
                          ruleDraft.allow_calendar_on_manual_review
                        )}
                        onChange={(e) =>
                          setRuleDraft({
                            ...ruleDraft,
                            allow_calendar_on_manual_review: e.target.checked,
                          })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="text-white/45">Qualified message</span>
                      <textarea
                        className="mt-1 min-h-[80px] w-full border border-white/15 bg-transparent px-3 py-2"
                        value={
                          ((ruleDraft.outcome_messages as Record<string, string>) ||
                            {}).qualified || ""
                        }
                        onChange={(e) =>
                          setRuleDraft({
                            ...ruleDraft,
                            outcome_messages: {
                              ...((ruleDraft.outcome_messages as object) || {}),
                              qualified: e.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost px-3 py-2 text-xs"
                        onClick={() =>
                          run("save_rule_set", { ruleSet: ruleDraft })
                        }
                      >
                        Save draft
                      </button>
                      <button
                        type="button"
                        className="btn-primary px-3 py-2 text-xs"
                        onClick={() =>
                          run("publish_rule_set", { id: ruleDraft.id })
                        }
                      >
                        Publish
                      </button>
                    </div>
                    <p className="text-xs text-white/35">
                      Hard rules and point maps are editable via save_rule_set /
                      upsert_question APIs. Status: {String(ruleDraft.status)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {sub === "availability" && config && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn-primary px-4 py-2 text-xs"
                  onClick={() =>
                    run("pause_bookings", {
                      paused: !((config.settings as { bookings_paused?: boolean })
                        ?.bookings_paused),
                    })
                  }
                >
                  {(config.settings as { bookings_paused?: boolean })
                    ?.bookings_paused
                    ? "Resume bookings"
                    : "Pause all bookings"}
                </button>
                <span className="text-xs text-white/40">
                  Timezone:{" "}
                  {(config.settings as { admin_timezone?: string })
                    ?.admin_timezone || "America/New_York"}
                </span>
              </div>
              <p className="label">Weekly windows</p>
              <ul className="space-y-2 text-sm text-white/70">
                {((config.windows as unknown[]) || []).map((w) => {
                  const row = w as {
                    id: string;
                    day_of_week: number | null;
                    specific_date: string | null;
                    start_time: string;
                    end_time: string;
                  };
                  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
                  return (
                    <li key={row.id} className="border border-white/10 px-3 py-2">
                      {row.specific_date || days[row.day_of_week ?? 0]} ·{" "}
                      {String(row.start_time).slice(0, 5)}–
                      {String(row.end_time).slice(0, 5)}
                    </li>
                  );
                })}
              </ul>
              <div className="border border-white/10 p-4">
                <p className="label mb-3">Block time</p>
                <button
                  type="button"
                  className="btn-ghost px-3 py-2 text-xs"
                  onClick={() => {
                    const start = new Date();
                    start.setHours(12, 0, 0, 0);
                    const end = new Date(start);
                    end.setHours(13, 0, 0, 0);
                    const member = (config.teamMembers as { id: string }[])?.[0];
                    run("add_block", {
                      block: {
                        team_member_id: member?.id,
                        title: "Manual block",
                        block_type: "manual",
                        starts_at: start.toISOString(),
                        ends_at: end.toISOString(),
                      },
                    });
                  }}
                >
                  Block noon–1pm today
                </button>
              </div>
            </div>
          )}

          {sub === "types" && config && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="label mb-3">Services</p>
                <ul className="space-y-2 text-sm">
                  {((config.services as unknown[]) || []).map((s) => {
                    const row = s as {
                      id: string;
                      name: string;
                      active: boolean;
                      slug: string;
                    };
                    return (
                      <li
                        key={row.id}
                        className="flex items-center justify-between border border-white/10 px-3 py-2"
                      >
                        <span>
                          {row.name}
                          <span className="ml-2 text-xs text-white/35">
                            /{row.slug}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-xs text-crimson-light"
                          onClick={() =>
                            run("upsert_service", {
                              service: { ...row, active: !row.active },
                            })
                          }
                        >
                          {row.active ? "Disable" : "Enable"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="label mb-3">Appointment types</p>
                <ul className="space-y-2 text-sm">
                  {((config.appointmentTypes as unknown[]) || []).map((t) => {
                    const row = t as {
                      id: string;
                      name: string;
                      slug: string;
                      duration_minutes: number;
                      active: boolean;
                      is_public: boolean;
                    };
                    return (
                      <li key={row.id} className="border border-white/10 px-3 py-2">
                        <div className="flex justify-between">
                          <span className="text-white">{row.name}</span>
                          <span className="text-xs text-white/40">
                            {row.duration_minutes}m
                          </span>
                        </div>
                        <div className="mt-2 flex gap-3 text-xs">
                          <button
                            type="button"
                            className="text-white/50"
                            onClick={() =>
                              run("upsert_appointment_type", {
                                appointmentType: {
                                  ...row,
                                  active: !row.active,
                                },
                              })
                            }
                          >
                            {row.active ? "Deactivate" : "Activate"}
                          </button>
                          <Link
                            href={`/book/${row.slug}`}
                            className="text-crimson-light"
                            target="_blank"
                          >
                            Public URL
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {sub === "notifications" && config && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {((config.templates as unknown[]) || []).map((t) => {
                  const row = t as { id: string; key: string; name: string };
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setTemplateDraft(row as never)}
                      className={`border px-3 py-1.5 text-xs ${
                        (templateDraft as { id?: string })?.id === row.id
                          ? "border-crimson/60"
                          : "border-white/10"
                      }`}
                    >
                      {row.key}
                    </button>
                  );
                })}
              </div>
              {templateDraft && (
                <div className="space-y-3">
                  <label className="block text-sm">
                    <span className="text-white/45">Subject</span>
                    <input
                      className="mt-1 w-full border border-white/15 bg-transparent px-3 py-2"
                      value={String(templateDraft.subject ?? "")}
                      onChange={(e) =>
                        setTemplateDraft({
                          ...templateDraft,
                          subject: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-white/45">HTML body</span>
                    <textarea
                      className="mt-1 min-h-[140px] w-full border border-white/15 bg-transparent px-3 py-2 font-mono text-xs"
                      value={String(templateDraft.body_html ?? "")}
                      onChange={(e) =>
                        setTemplateDraft({
                          ...templateDraft,
                          body_html: e.target.value,
                        })
                      }
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary px-3 py-2 text-xs"
                      onClick={() =>
                        run("update_template", { template: templateDraft })
                      }
                    >
                      Save template
                    </button>
                    <button
                      type="button"
                      className="btn-ghost px-3 py-2 text-xs"
                      onClick={() =>
                        run("send_test_email", {
                          templateKey: templateDraft.key,
                        })
                      }
                    >
                      Send test email
                    </button>
                  </div>
                </div>
              )}
              <div className="border border-white/10 p-4 text-sm text-white/55">
                Internal notifications default to{" "}
                <strong className="text-white">
                  contact@redmontstrategiesgroup.com
                </strong>
                . Edit recipients in settings via update_settings.
                <button
                  type="button"
                  className="ml-3 text-crimson-light underline"
                  onClick={() =>
                    run("update_settings", {
                      settings: {
                        internal_notification_emails: [
                          "contact@redmontstrategiesgroup.com",
                        ],
                      },
                    })
                  }
                >
                  Reset recipients
                </button>
              </div>
            </div>
          )}

          {sub === "team" && config && (
            <ul className="space-y-2 text-sm">
              {((config.teamMembers as unknown[]) || []).map((m) => {
                const row = m as {
                  id: string;
                  name: string;
                  email: string;
                  role: string;
                  timezone: string;
                  active: boolean;
                };
                return (
                  <li
                    key={row.id}
                    className="flex justify-between border border-white/10 px-4 py-3"
                  >
                    <div>
                      <p className="text-white">{row.name}</p>
                      <p className="text-xs text-white/40">
                        {row.email} · {row.role} · {row.timezone}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-white/50"
                      onClick={() =>
                        run("upsert_team_member", {
                          member: { ...row, active: !row.active },
                        })
                      }
                    >
                      {row.active ? "Deactivate" : "Activate"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {sub === "webhooks" && config && (
            <div className="space-y-4">
              <p className="text-sm text-white/55">
                Signed webhook deliveries for automation tools. No fake
                integrations — endpoints you add here receive real events.
              </p>
              <ul className="space-y-2 text-sm">
                {((config.webhooks as unknown[]) || []).map((w) => {
                  const row = w as {
                    id: string;
                    url: string;
                    enabled: boolean;
                  };
                  return (
                    <li key={row.id} className="border border-white/10 px-3 py-2">
                      {row.url}{" "}
                      <span className="text-xs text-white/40">
                        {row.enabled ? "enabled" : "disabled"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="btn-ghost px-3 py-2 text-xs"
                onClick={() => {
                  const url = window.prompt("Webhook URL");
                  if (!url) return;
                  run("upsert_webhook", {
                    webhook: {
                      url,
                      events: ["*"],
                      enabled: true,
                    },
                  });
                }}
              >
                Add webhook endpoint
              </button>
              <div>
                <p className="label mb-2">Future integrations (not connected)</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {INTEGRATION_PLACEHOLDERS.map((i) => (
                    <li
                      key={i.provider}
                      className="border border-white/10 px-3 py-2 text-xs text-white/45"
                    >
                      {i.provider} · {i.category} · Not connected
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {sub === "jobs" && config && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="label mb-3">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />
                  Pending / failed jobs
                </p>
                <ul className="max-h-80 space-y-2 overflow-y-auto text-xs text-white/60">
                  {((config.jobs as unknown[]) || []).map((j) => {
                    const row = j as {
                      id: string;
                      job_type: string;
                      status: string;
                      due_at: string;
                      last_error?: string;
                    };
                    return (
                      <li key={row.id} className="border border-white/10 px-2 py-2">
                        {row.job_type} · {row.status} ·{" "}
                        {new Date(row.due_at).toLocaleString()}
                        {row.last_error && (
                          <span className="block text-crimson-light">
                            {row.last_error}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div>
                <p className="label mb-3">Failed deliveries</p>
                <ul className="max-h-80 space-y-2 overflow-y-auto text-xs text-white/60">
                  {((config.failedDeliveries as unknown[]) || []).map((d) => {
                    const row = d as {
                      id: string;
                      recipient: string;
                      error?: string;
                    };
                    return (
                      <li key={row.id} className="border border-white/10 px-2 py-2">
                        {row.recipient}: {row.error}
                      </li>
                    );
                  })}
                </ul>
                <p className="label mb-2 mt-6">Recent activity</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-white/40">
                  {((config.activity as unknown[]) || []).map((a) => {
                    const row = a as {
                      id: string;
                      action: string;
                      created_at: string;
                    };
                    return (
                      <li key={row.id}>
                        {row.action} · {new Date(row.created_at).toLocaleString()}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {sub === "testing" && config && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-white/60">
                <FlaskConical size={16} />
                Test submissions are labeled and excluded from production
                analytics when created with is_test.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {((config.questions as unknown[]) || []).slice(0, 8).map((q) => {
                  const row = q as {
                    key: string;
                    label: string;
                    options?: string[];
                    question_type: string;
                  };
                  return (
                    <label key={row.key} className="block text-xs">
                      <span className="text-white/50">{row.label}</span>
                      {row.options?.length ? (
                        <select
                          className="mt-1 w-full border border-white/15 bg-base px-2 py-2"
                          value={testAnswers[row.key] || ""}
                          onChange={(e) =>
                            setTestAnswers({
                              ...testAnswers,
                              [row.key]: e.target.value,
                            })
                          }
                        >
                          <option value="">—</option>
                          {row.options.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          className="mt-1 w-full border border-white/15 bg-transparent px-2 py-2"
                          value={testAnswers[row.key] || ""}
                          onChange={(e) =>
                            setTestAnswers({
                              ...testAnswers,
                              [row.key]: e.target.value,
                            })
                          }
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="btn-primary px-4 py-2 text-sm"
                onClick={async () => {
                  const data = await run("test_qualification", {
                    answers: testAnswers,
                  });
                  if (data?.result) setTestResult(data.result);
                }}
              >
                Run qualification test
              </button>
              {testResult && (
                <pre className="overflow-x-auto border border-white/10 bg-black/40 p-4 text-xs text-white/70">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              )}
              <div className="border border-white/10 p-4 text-sm text-white/55">
                <Check className="mr-2 inline h-4 w-4 text-crimson" />
                Preview emails via Notifications → Send test email. Preview the
                public funnel at <Link href="/book">/book</Link>.
              </div>
            </div>
          )}
        </>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto border border-white/15 bg-base p-6">
            <div className="flex items-center justify-between">
              <h3 className="display text-lg">Appointment detail</h3>
              <button
                type="button"
                className="text-white/50"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </button>
            </div>
            <pre className="mt-4 overflow-x-auto text-xs text-white/55">
              {JSON.stringify(selectedBooking, null, 2)}
            </pre>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-ghost px-3 py-2 text-xs"
                onClick={() => {
                  const notes = window.prompt("Internal notes");
                  if (notes == null) return;
                  run("update_internal_notes", {
                    bookingId: selectedBooking.id,
                    notes,
                  });
                }}
              >
                Edit notes
              </button>
              <button
                type="button"
                className="btn-ghost px-3 py-2 text-xs"
                onClick={() =>
                  run("admin_cancel", { bookingId: selectedBooking.id })
                }
              >
                Cancel booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
