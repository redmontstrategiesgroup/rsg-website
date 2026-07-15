"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  Check,
  Circle,
  Star,
  Plus,
  Settings2,
  CalendarPlus,
  RotateCcw,
  Send,
} from "lucide-react";
import {
  completedEffects,
  deriveAnalytics,
  formatMetric,
  noShowEffects,
  uid,
} from "../engine";
import type { AppointmentStatus, CalendarEvent, Campaign, Metric } from "../types";
import {
  ACTIVITY_ICONS,
  EmptyState,
  PanelHeading,
  SampleDataTag,
  StatusPill,
} from "./primitives";
import { BarChart, FunnelChart, LineChart } from "./charts";
import { Modal } from "./Modal";
import { CheckboxInput, SelectInput, SmallButton, TextInput } from "./fields";
import { TIME_OPTIONS, applyNow, type ViewProps } from "./shared";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

export function MetricCard({ metric }: { metric: Metric }) {
  const DeltaIcon = metric.deltaDir === "down" ? ArrowDownRight : ArrowUpRight;
  const good = metric.deltaGood ?? metric.deltaDir !== "down";
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
      <p className="text-[0.62rem] font-medium uppercase tracking-[0.14em] text-white/40">
        {metric.label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-medium tabular-nums text-white sm:text-2xl">
          {formatMetric(metric.value, metric.format)}
        </span>
        {metric.delta && (
          <span
            className={`inline-flex items-center gap-0.5 text-[0.68rem] tabular-nums ${
              good ? "text-emerald-400/80" : "text-red-400/80"
            }`}
          >
            <DeltaIcon size={11} aria-hidden />
            {metric.delta}
          </span>
        )}
      </div>
      {metric.hint && <p className="mt-1.5 text-[0.66rem] text-white/35">{metric.hint}</p>}
    </div>
  );
}

export function ActivityFeed({
  state,
  limit,
}: {
  state: ViewProps["state"];
  limit?: number;
}) {
  const items = limit ? state.activity.slice(0, limit) : state.activity;
  if (items.length === 0)
    return <EmptyState text="No activity yet. Run a scenario or create a record to see the system work." />;
  return (
    <ul className="divide-y divide-white/[0.05]">
      {items.map((item) => {
        const Icon = ACTIVITY_ICONS[item.icon];
        return (
          <li key={item.id} className="flex items-start gap-3 px-4 py-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border ${
                item.icon === "alert"
                  ? "border-crimson/30 bg-crimson/10 text-crimson-light"
                  : "border-white/10 bg-white/[0.04] text-white/50"
              }`}
            >
              <Icon size={12} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs leading-relaxed text-white/70">{item.text}</p>
              <p className="mt-0.5 text-[0.62rem] text-white/30">{item.time}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Overview (customizable widgets)                                     */
/* ------------------------------------------------------------------ */

const WIDGET_LABELS: Record<string, string> = {
  metrics: "Key metrics",
  pipeline: "Pipeline summary",
  activity: "Live activity",
  schedule: "Upcoming schedule",
  tasks: "Open tasks",
};

export function OverviewView({ state, config: _config, dispatch, track }: ViewProps) {
  const [customize, setCustomize] = useState(false);
  const visible = state.settings.widgets.filter((w) => w.visible).map((w) => w.id);
  const openTasks = state.tasks.filter((t) => !t.done).slice(0, 4);
  const upcoming = state.calendar
    .filter((e) => e.status !== "completed" && e.status !== "canceled" && e.status !== "no-show")
    .slice(0, 4);
  const derived = deriveAnalytics(state);

  const moveWidget = (id: string, dir: -1 | 1) => {
    const ws = [...state.settings.widgets];
    const i = ws.findIndex((w) => w.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ws.length) return;
    [ws[i], ws[j]] = [ws[j], ws[i]];
    dispatch({ type: "settings-widgets", widgets: ws });
    track("customized dashboard widgets");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          {state.settings.personalization.problem
            ? `Focused on: ${state.settings.personalization.problem}`
            : `Today at ${state.settings.businessName}`}
        </p>
        <SmallButton onClick={() => setCustomize(true)} ariaLabel="Customize dashboard widgets">
          <Settings2 size={11} aria-hidden /> Customize
        </SmallButton>
      </div>

      {state.settings.widgets
        .filter((w) => w.visible)
        .map((w) => {
          switch (w.id) {
            case "metrics":
              return (
                <div key={w.id} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {state.metrics.slice(0, 8).map((m) => (
                    <MetricCard key={m.id} metric={m} />
                  ))}
                </div>
              );
            case "pipeline":
              return (
                <div key={w.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
                  <PanelHeading
                    title={`Pipeline · $${derived.pipelineValue.toLocaleString()} open`}
                    right={<SampleDataTag />}
                  />
                  <div className="flex gap-2 overflow-x-auto p-4 no-scrollbar">
                    {state.stages.map((s) => {
                      const count = state.leads.filter((l) => l.stageId === s.id).length;
                      return (
                        <div key={s.id} className="min-w-[7rem] flex-1 rounded border border-white/[0.07] bg-white/[0.015] px-3 py-2">
                          <p className="truncate text-[0.58rem] uppercase tracking-wider text-white/35">{s.label}</p>
                          <p className="mt-1 text-lg font-medium tabular-nums text-white/85">{count}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            case "activity":
              return (
                <div key={w.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
                  <PanelHeading title="Live activity" />
                  <div className="max-h-[19rem] overflow-y-auto no-scrollbar">
                    <ActivityFeed state={state} limit={8} />
                  </div>
                </div>
              );
            case "schedule":
              return (
                <div key={w.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
                  <PanelHeading title="Upcoming schedule" />
                  {upcoming.length === 0 ? (
                    <EmptyState text="Nothing scheduled. Book one from the calendar tab." />
                  ) : (
                    <ul className="divide-y divide-white/[0.05]">
                      {upcoming.map((e) => (
                        <li key={e.id} className="flex items-center gap-4 px-4 py-3">
                          <div className="w-14 shrink-0 text-center">
                            <p className="text-[0.6rem] uppercase tracking-wider text-white/35">{e.day}</p>
                            <p className="text-sm font-medium text-white/80">{e.date}</p>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-white/75">{e.title}</p>
                            <p className="text-[0.64rem] text-white/35">
                              {e.time}
                              {e.withWhom ? ` · ${e.withWhom}` : ""}
                            </p>
                          </div>
                          {e.status && <AppointmentStatusPill status={e.status} />}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            case "tasks":
              return (
                <div key={w.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
                  <PanelHeading title={`Open tasks · ${derived.openTasks}`} />
                  {openTasks.length === 0 ? (
                    <EmptyState text="No open tasks. The system is keeping up." />
                  ) : (
                    <ul className="divide-y divide-white/[0.05]">
                      {openTasks.map((t) => (
                        <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                          <Circle size={12} className="shrink-0 text-white/25" aria-hidden />
                          <p className="min-w-0 flex-1 truncate text-xs text-white/70">{t.title}</p>
                          <span className="hidden text-[0.62rem] text-white/35 sm:block">{t.assignee}</span>
                          <span className={`text-[0.62rem] ${t.priority === "high" ? "text-crimson-light" : "text-white/35"}`}>
                            {t.due}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            default:
              return null;
          }
        })}

      {visible.length === 0 && (
        <EmptyState text="All widgets are hidden. Use Customize to bring them back." />
      )}

      {customize && (
        <Modal
          title="Customize dashboard"
          subtitle="Choose and order the widgets for this demo session."
          onClose={() => setCustomize(false)}
        >
          <ul className="space-y-2">
            {state.settings.widgets.map((w, i) => (
              <li key={w.id} className="flex items-center gap-3 rounded border border-white/[0.08] px-3 py-2">
                <span className="flex-1 text-xs text-white/75">{WIDGET_LABELS[w.id] ?? w.id}</span>
                <SmallButton
                  onClick={() => moveWidget(w.id, -1)}
                  disabled={i === 0}
                  ariaLabel={`Move ${WIDGET_LABELS[w.id]} up`}
                >
                  <ArrowUp size={11} aria-hidden />
                </SmallButton>
                <SmallButton
                  onClick={() => moveWidget(w.id, 1)}
                  disabled={i === state.settings.widgets.length - 1}
                  ariaLabel={`Move ${WIDGET_LABELS[w.id]} down`}
                >
                  <ArrowDown size={11} aria-hidden />
                </SmallButton>
                <CheckboxInput
                  label={w.visible ? "Shown" : "Hidden"}
                  checked={w.visible}
                  onChange={(v) => {
                    dispatch({
                      type: "settings-widgets",
                      widgets: state.settings.widgets.map((x) =>
                        x.id === w.id ? { ...x, visible: v } : x,
                      ),
                    });
                    track("customized dashboard widgets");
                  }}
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.64rem] text-white/35">
            Layout is saved for your demo session only.
          </p>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export function TasksView({ state, dispatch, track }: ViewProps) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(state.settings.staff[0]?.name ?? "");
  const open = state.tasks.filter((t) => !t.done);
  const done = state.tasks.filter((t) => t.done);

  const addTask = () => {
    if (!title.trim()) return;
    applyNow(dispatch, [
      {
        kind: "task",
        task: { id: uid("t"), title: title.trim(), assignee: assignee || "Team", due: "Today" },
      },
      {
        kind: "activity",
        item: { id: uid("act"), icon: "task", text: `Task created: ${title.trim()}`, time: "Just now" },
      },
    ]);
    track("created tasks");
    setTitle("");
    setAdding(false);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <PanelHeading
          title={`Needs attention · ${open.length}`}
          right={
            <SmallButton onClick={() => setAdding(true)}>
              <Plus size={11} aria-hidden /> New task
            </SmallButton>
          }
        />
        {open.length === 0 ? (
          <EmptyState text="All caught up." />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {open.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    applyNow(dispatch, [
                      { kind: "completeTask", taskId: t.id },
                      {
                        kind: "activity",
                        item: { id: uid("act"), icon: "task", text: "Task marked complete by staff.", time: "Just now" },
                      },
                    ]);
                    track("completed tasks");
                  }}
                  className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-white/20 text-transparent transition-colors hover:border-crimson hover:text-crimson-light focus:outline-none focus-visible:ring-1 focus-visible:ring-crimson"
                  aria-label={`Mark "${t.title}" complete`}
                >
                  <Check size={11} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80">{t.title}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.62rem] text-white/35">
                    <span>{t.assignee}</span>
                    <span aria-hidden>·</span>
                    <span className={t.priority === "high" ? "text-crimson-light" : ""}>{t.due}</span>
                    {t.auto && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-white/40">created by automation</span>
                      </>
                    )}
                  </p>
                </div>
                {t.priority === "high" && <StatusPill tone="crimson">High</StatusPill>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
        <PanelHeading title={`Completed · ${done.length}`} right={<SampleDataTag />} />
        {done.length === 0 ? (
          <EmptyState text="Completed tasks will appear here." />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {done.map((t) => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
                  <Check size={11} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 opacity-55">
                  <p className="text-xs text-white/70 line-through decoration-white/30">{t.title}</p>
                  <p className="mt-0.5 text-[0.62rem] text-white/35">{t.assignee}</p>
                </div>
                <SmallButton
                  onClick={() => applyNow(dispatch, [{ kind: "reopenTask", taskId: t.id }])}
                  ariaLabel={`Reopen "${t.title}"`}
                >
                  <RotateCcw size={10} aria-hidden /> Reopen
                </SmallButton>
              </li>
            ))}
          </ul>
        )}
      </div>

      {adding && (
        <Modal title="New task" onClose={() => setAdding(false)}>
          <div className="space-y-3">
            <TextInput label="Task" value={title} onChange={setTitle} required placeholder="Call back the 2pm inquiry…" />
            <SelectInput
              label="Assignee"
              value={assignee}
              onChange={setAssignee}
              options={state.settings.staff.map((s) => ({ value: s.name, label: `${s.name} — ${s.role}` }))}
            />
            <div className="flex justify-end gap-2 pt-1">
              <SmallButton onClick={() => setAdding(false)}>Cancel</SmallButton>
              <SmallButton tone="primary" onClick={addTask} disabled={!title.trim()}>
                <Plus size={11} aria-hidden /> Create task
              </SmallButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Calendar / scheduling                                               */
/* ------------------------------------------------------------------ */

function AppointmentStatusPill({ status }: { status: AppointmentStatus }) {
  const map: Record<AppointmentStatus, { tone: "green" | "amber" | "red" | "gray" | "crimson"; label: string }> = {
    confirmed: { tone: "green", label: "confirmed" },
    pending: { tone: "amber", label: "pending" },
    risk: { tone: "red", label: "no-show risk" },
    completed: { tone: "gray", label: "completed" },
    "no-show": { tone: "red", label: "no-show" },
    canceled: { tone: "gray", label: "canceled" },
  };
  const m = map[status];
  return <StatusPill tone={m.tone}>{m.label}</StatusPill>;
}

export function CalendarView({ state, config, dispatch, track }: ViewProps) {
  const [booking, setBooking] = useState(false);
  const [type, setType] = useState(config.appointmentTypes[0]?.id ?? "");
  const [contact, setContact] = useState("");
  const [staff, setStaff] = useState(state.settings.staff[0]?.name ?? "");
  const [day, setDay] = useState(0);
  const [time, setTime] = useState(TIME_OPTIONS[2]);

  const setStatus = (event: CalendarEvent, status: AppointmentStatus) => {
    const effects = [{ kind: "appointmentStatus" as const, eventId: event.id, status }];
    if (status === "no-show") {
      applyNow(dispatch, [...effects, ...noShowEffects(event, state, config)]);
      track("triggered no-show recovery");
    } else if (status === "completed") {
      applyNow(dispatch, [...effects, ...completedEffects(event, state, config)]);
      track("completed appointments");
    } else {
      applyNow(dispatch, [
        ...effects,
        {
          kind: "activity",
          item: { id: uid("act"), icon: "calendar", text: `${event.title} marked ${status}.`, time: "Just now" },
        },
      ]);
    }
  };

  const book = () => {
    if (!contact.trim()) return;
    const t = config.appointmentTypes.find((a) => a.id === type);
    const d = config.scheduleDays[day];
    applyNow(dispatch, [
      {
        kind: "calendar",
        event: {
          id: uid("cal"),
          day: d.day,
          date: d.date,
          time,
          title: `${t?.label ?? config.terminology.appointment} — ${contact.trim()}`,
          withWhom: staff,
          status: "confirmed",
        },
      },
      {
        kind: "activity",
        item: {
          id: uid("act"),
          icon: "calendar",
          text: `${config.terminology.appointment} booked: ${contact.trim()} (${d.day} ${time}, ${t?.duration ?? 30} min). Reminder sequence scheduled — simulated.`,
          time: "Just now",
        },
      },
      {
        kind: "notify",
        notification: {
          id: uid("n"),
          title: `${config.terminology.appointment} booked`,
          body: `${contact.trim()} — ${d.day} ${time} with ${staff}. Simulated confirmation sent.`,
          tone: "success",
        },
      },
    ]);
    track("booked appointments");
    setBooking(false);
    setContact("");
  };

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of state.calendar) {
    const key = `${e.day} ${e.date}`;
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
      <PanelHeading
        title="This week"
        right={
          <div className="flex items-center gap-3">
            <SampleDataTag className="hidden sm:inline-flex" />
            <SmallButton tone="primary" onClick={() => setBooking(true)}>
              <CalendarPlus size={11} aria-hidden /> New {config.terminology.appointment.toLowerCase()}
            </SmallButton>
          </div>
        }
      />
      {state.calendar.length === 0 ? (
        <EmptyState text="Nothing scheduled yet." />
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {[...byDay.entries()].map(([dayKey, events]) => (
            <div key={dayKey} className="flex gap-4 px-4 py-3">
              <div className="w-16 shrink-0 pt-0.5">
                <p className="text-[0.6rem] uppercase tracking-wider text-white/35">{dayKey.split(" ")[0]}</p>
                <p className="text-lg font-medium text-white/80">{dayKey.split(" ").slice(1).join(" ")}</p>
              </div>
              <ul className="min-w-0 flex-1 space-y-2">
                {events.map((e) => (
                  <li
                    key={e.id}
                    className={`rounded-md border-l-2 bg-white/[0.03] px-3 py-2 ${
                      e.status === "risk" || e.status === "no-show"
                        ? "border-red-400/70"
                        : e.status === "pending"
                          ? "border-amber-400/60"
                          : e.status === "completed" || e.status === "canceled"
                            ? "border-white/20 opacity-60"
                            : "border-crimson/70"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-white/80">{e.title}</p>
                        <p className="text-[0.62rem] text-white/40">
                          {e.time}
                          {e.withWhom ? ` · ${e.withWhom}` : ""}
                        </p>
                      </div>
                      {e.status && <AppointmentStatusPill status={e.status} />}
                    </div>
                    {e.status !== "completed" && e.status !== "canceled" && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.status !== "confirmed" && (
                          <SmallButton onClick={() => setStatus(e, "confirmed")}>Confirm</SmallButton>
                        )}
                        <SmallButton onClick={() => setStatus(e, "completed")}>Complete</SmallButton>
                        <SmallButton onClick={() => setStatus(e, "no-show")}>No-show</SmallButton>
                        <SmallButton tone="danger" onClick={() => setStatus(e, "canceled")}>
                          Cancel
                        </SmallButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {booking && (
        <Modal
          title={`New ${config.terminology.appointment.toLowerCase()}`}
          subtitle="Demo calendar only — no real appointment is created."
          onClose={() => setBooking(false)}
        >
          <div className="space-y-3">
            <SelectInput
              label="Type"
              value={type}
              onChange={setType}
              options={config.appointmentTypes.map((a) => ({ value: a.id, label: `${a.label} · ${a.duration} min` }))}
            />
            <TextInput label={`${config.terminology.record} name`} value={contact} onChange={setContact} required placeholder="Jordan Ellis" />
            <div className="grid grid-cols-2 gap-3">
              <SelectInput
                label="Day"
                value={String(day)}
                onChange={(v) => setDay(Number(v))}
                options={config.scheduleDays.map((d, i) => ({ value: String(i), label: `${d.day} ${d.date}` }))}
              />
              <SelectInput
                label="Time"
                value={time}
                onChange={setTime}
                options={TIME_OPTIONS.map((t) => ({ value: t, label: t }))}
              />
            </div>
            <SelectInput
              label="Staff"
              value={staff}
              onChange={setStaff}
              options={state.settings.staff.map((s) => ({ value: s.name, label: `${s.name} — ${s.role}` }))}
            />
            <div className="flex justify-end gap-2 pt-1">
              <SmallButton onClick={() => setBooking(false)}>Cancel</SmallButton>
              <SmallButton tone="primary" onClick={book} disabled={!contact.trim()}>
                <CalendarPlus size={11} aria-hidden /> Book
              </SmallButton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

export function ReviewsView({ state }: ViewProps) {
  const completed = state.reviews.filter((r) => r.status === "completed");
  const avg =
    completed.length > 0
      ? completed.reduce((s, r) => s + (r.rating ?? 0), 0) / completed.length
      : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-5">
        <p className="text-[0.62rem] font-medium uppercase tracking-[0.14em] text-white/40">
          Review performance
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-3xl font-medium tabular-nums text-white">{avg.toFixed(1)}</span>
          <div className="flex" aria-label={`${avg.toFixed(1)} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                size={14}
                aria-hidden
                className={n <= Math.round(avg) ? "fill-amber-400 text-amber-400" : "text-white/20"}
              />
            ))}
          </div>
        </div>
        <dl className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-4">
          {(
            [
              ["Requested", state.reviews.filter((r) => r.status === "requested").length],
              ["Completed", completed.length],
              ["Flagged for staff", state.reviews.filter((r) => r.status === "flagged").length],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="flex justify-between text-xs">
              <dt className="text-white/45">{label}</dt>
              <dd className="tabular-nums text-white/75">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[0.64rem] leading-relaxed text-white/35">
          Concerns are routed to staff for a personal follow-up. Review requests are never withheld
          or filtered to manipulate public ratings.
        </p>
      </div>
      <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-2">
        <PanelHeading title="Recent requests" right={<SampleDataTag />} />
        {state.reviews.length === 0 ? (
          <EmptyState text="Complete an appointment on the calendar to trigger a review request." />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {state.reviews.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white/80">{r.name}</p>
                  <p className="text-[0.64rem] text-white/40">
                    {r.service} · {r.time}
                  </p>
                  {r.note && <p className="mt-1 text-[0.66rem] italic text-white/45">&ldquo;{r.note}&rdquo;</p>}
                </div>
                {r.rating !== undefined && (
                  <span className="flex items-center gap-1 text-xs tabular-nums text-white/70">
                    <Star size={11} className="fill-amber-400 text-amber-400" aria-hidden />
                    {r.rating}
                  </span>
                )}
                <StatusPill
                  tone={
                    r.status === "completed"
                      ? "green"
                      : r.status === "flagged"
                        ? "red"
                        : r.status === "requested"
                          ? "amber"
                          : "gray"
                  }
                >
                  {r.status}
                </StatusPill>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Campaigns                                                           */
/* ------------------------------------------------------------------ */

function CampaignCard({
  campaign,
  onSend,
}: {
  campaign: Campaign;
  onSend: () => void;
}) {
  const rate = campaign.stats.sent
    ? Math.round((campaign.stats.replied / campaign.stats.sent) * 100)
    : 0;
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02]">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
        <div>
          <p className="text-xs font-medium text-white/85">{campaign.name}</p>
          <p className="mt-0.5 text-[0.64rem] text-white/40">{campaign.audience}</p>
        </div>
        <StatusPill tone={campaign.status === "active" ? "green" : campaign.status === "draft" ? "gray" : "amber"}>
          {campaign.status}
        </StatusPill>
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {campaign.filters.map((f) => (
            <span key={f} className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[0.6rem] text-white/50">
              {f}
            </span>
          ))}
        </div>
        <div className="rounded-md border border-crimson/20 bg-crimson/[0.07] px-3 py-2.5">
          <p className="text-[0.68rem] leading-relaxed text-white/75">{campaign.message}</p>
        </div>
        <div className="grid grid-cols-4 gap-2 border-t border-white/[0.06] pt-3 text-center">
          {(
            [
              ["Sent", campaign.stats.sent],
              ["Replied", campaign.stats.replied],
              ["Booked", campaign.stats.booked],
              ["Reply rate", `${rate}%`],
            ] as const
          ).map(([label, v]) => (
            <div key={label}>
              <p className="text-sm font-medium tabular-nums text-white/85">{v}</p>
              <p className="text-[0.58rem] uppercase tracking-wider text-white/35">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-white/[0.06] pt-3">
          <SmallButton tone="primary" onClick={onSend}>
            <Send size={10} aria-hidden /> Send test batch (simulated)
          </SmallButton>
        </div>
      </div>
    </div>
  );
}

export function CampaignsView({ state: _state, config, dispatch, track }: ViewProps) {
  const sendBatch = (c: Campaign) => {
    applyNow(dispatch, [
      {
        kind: "activity",
        item: {
          id: uid("act"),
          icon: "campaign",
          text: `Simulated batch of "${c.name}" sent to 12 matching contacts.`,
          time: "Just now",
        },
      },
      {
        kind: "workflowRun",
        run: {
          id: uid("run"),
          automationId: c.id,
          name: c.name,
          detail: "Simulated campaign batch — 12 contacts matched the filters; replies route to the inbox.",
          time: "Just now",
          simulated: true,
        },
      },
      {
        kind: "notify",
        notification: {
          id: uid("n"),
          title: `Campaign batch simulated: ${c.name}`,
          body: "No real messages were sent. Replies would appear in Conversations.",
          tone: "success",
        },
      },
    ]);
    track("ran campaigns");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-white/40">
          Segmented outreach to opportunities already sitting in your database.
        </p>
        <SampleDataTag className="hidden sm:inline-flex" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {config.campaigns.map((c) => (
          <CampaignCard key={c.id} campaign={c} onSend={() => sendBatch(c)} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Analytics (derived from live demo records)                          */
/* ------------------------------------------------------------------ */

export function AnalyticsView({ state, config, track }: ViewProps) {
  const [source, setSource] = useState("");
  const [assignee, setAssignee] = useState("");
  const derived = useMemo(
    () => deriveAnalytics(state, { source: source || undefined, assignee: assignee || undefined }),
    [state, source, assignee],
  );
  const a = config.analytics;
  const maxSource = Math.max(...derived.sources.map((s) => s.leads), 1);
  const allSources = [...new Set(state.leads.map((l) => l.source))];
  const allAssignees = [...new Set(state.leads.map((l) => l.assignee).filter(Boolean))] as string[];

  const liveKpis: Metric[] = [
    { id: "lk-1", label: "Open pipeline value", value: derived.pipelineValue, format: "currency" },
    { id: "lk-2", label: `${config.terminology.records} in system`, value: state.leads.length },
    { id: "lk-3", label: "Open tasks", value: derived.openTasks },
    { id: "lk-4", label: "Workflow executions (session)", value: derived.workflowExecutions },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-3">
          <div className="w-44">
            <SelectInput
              label="Lead source"
              value={source}
              onChange={(v) => {
                setSource(v);
                track("filtered analytics");
              }}
              options={allSources.map((s) => ({ value: s, label: s }))}
              placeholder="All sources"
            />
          </div>
          <div className="w-44">
            <SelectInput
              label="Staff member"
              value={assignee}
              onChange={(v) => {
                setAssignee(v);
                track("filtered analytics");
              }}
              options={allAssignees.map((s) => ({ value: s, label: s }))}
              placeholder="All staff"
            />
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[0.6rem] font-medium uppercase tracking-[0.16em] text-white/30">
          <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden />
          Interactive demo data — computed from your session
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {liveKpis.map((m) => (
          <MetricCard key={m.id} metric={m} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4 lg:col-span-2">
          <p className="mb-4 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">
            Live pipeline distribution{source ? ` · ${source}` : ""}
          </p>
          <FunnelChart points={derived.funnel} />
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] lg:col-span-3">
          <PanelHeading title="Source performance (live)" />
          {derived.sources.length === 0 ? (
            <EmptyState text="No records match these filters." />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {derived.sources.map((s) => (
                <div key={s.name} className="flex items-center gap-4 px-4 py-3">
                  <span className="w-28 shrink-0 truncate text-xs text-white/65 sm:w-36">{s.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-white/30" style={{ width: `${(s.leads / maxSource) * 100}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs tabular-nums text-white/55">{s.leads} in</span>
                  <span className="w-20 shrink-0 text-right text-xs tabular-nums text-crimson-light/90">
                    {s.booked} advanced
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">
            {a.volume.title}
          </p>
          <p className="mb-4 text-[0.6rem] text-white/30">Illustrative 8-week baseline · demo data</p>
          <BarChart points={a.volume.points} unit={a.volume.unit} />
        </div>
        <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-4">
          <p className="mb-1 text-[0.68rem] font-medium uppercase tracking-[0.18em] text-white/45">
            {a.responseTime.title}
          </p>
          <p className="mb-4 text-[0.6rem] text-white/30">Illustrative 8-week baseline · demo data</p>
          <LineChart points={a.responseTime.points} unit={a.responseTime.unit} />
        </div>
      </div>
    </div>
  );
}
