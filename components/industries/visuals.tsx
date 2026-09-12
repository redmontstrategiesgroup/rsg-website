/**
 * Industry-specific hero interface previews. Purely decorative, aria-hidden
 * mock product surfaces: each vertical gets its own: a dispatch board for
 * home services, a treatment-room schedule for health & wellness, and a
 * listing status board for real estate. CSS-only animation (pulse) so these stay server-
 * rendered and cheap.
 */

function Window({
  title,
  chip,
  children,
}: {
  title: string;
  chip: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none overflow-hidden rounded-xl border border-white/10 bg-base-900/80 shadow-card backdrop-blur"
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="h-2 w-2 rounded-full bg-white/15" />
          <span className="ml-3 font-mono text-[0.7rem] sm:text-[0.58rem] uppercase tracking-label text-white/40">
            {title}
          </span>
        </div>
        <span className="rounded-full border border-crimson/30 bg-crimson/10 px-2 py-0.5 font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-crimson-light">
          {chip}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">
      <p className="font-mono text-[0.6rem] uppercase leading-tight tracking-[0.12em] text-white/35 sm:text-[0.5rem] sm:tracking-label">
        {label}
      </p>
      <p className={`mt-1 font-display text-sm ${accent ? "text-crimson-light" : "text-white/85"}`}>
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Home services: dispatch board                                       */
/* ------------------------------------------------------------------ */

const TECH_ROWS = [
  { name: "M. Torres", jobs: [{ w: "28%", l: "8%", label: "AC repair" }, { w: "22%", l: "48%", label: "Tune-up" }] },
  { name: "D. Whitfield", jobs: [{ w: "34%", l: "14%", label: "Water heater" }, { w: "18%", l: "62%", label: "Estimate" }] },
  { name: "S. Okonkwo", jobs: [{ w: "24%", l: "30%", label: "Panel swap" }] },
];

export function DispatchBoardVisual() {
  return (
    <Window title="Service Command Center" chip="Live board">
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <MiniStat label="Calls answered" value="100%" accent />
          <MiniStat label="Booked today" value="9 jobs" />
          <MiniStat label="Unsent estimates" value="0" />
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">
            Dispatch: today
          </p>
          <div className="mt-2.5 space-y-2">
            {TECH_ROWS.map((t) => (
              <div key={t.name} className="flex items-center gap-2.5">
                <span className="w-20 shrink-0 truncate text-[0.72rem] sm:text-[0.62rem] text-white/55">{t.name}</span>
                <div className="relative h-5 flex-1 rounded bg-white/[0.04]">
                  {t.jobs.map((j) => (
                    <span
                      key={j.label}
                      style={{ width: j.w, left: j.l }}
                      className="absolute top-0 flex h-5 items-center overflow-hidden rounded border border-crimson/40 bg-crimson/20 px-1.5 text-[0.7rem] sm:text-[0.52rem] text-white/80"
                    >
                      <span className="truncate">{j.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-crimson/25 bg-crimson/[0.07] px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-crimson-light" />
          <p className="text-[0.72rem] sm:text-[0.62rem] leading-snug text-white/70">
            Missed call recovered: texted back in 12s, qualified, booked for Thu 9:00 AM
          </p>
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* Health & wellness: treatment room schedule                          */
/* ------------------------------------------------------------------ */

const TREATMENT_ROOMS = [
  { name: "Room 1", slots: [{ label: "Injectables", tone: "confirmed" }, { label: "New client", tone: "confirmed" }] },
  { name: "Room 2", slots: [{ label: "Hydrafacial", tone: "confirmed" }, { label: "Consult", tone: "risk" }] },
  { name: "Drip / Rec", slots: [{ label: "IV therapy", tone: "confirmed" }, { label: "Massage", tone: "open" }] },
];

export function TreatmentRoomScheduleVisual() {
  return (
    <Window title="Practice Front Desk" chip="Simulated">
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <MiniStat label="Confirmed today" value="14 / 15" accent />
          <MiniStat label="Follow-ups due" value="23" />
          <MiniStat label="Intake pending" value="2" />
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
          {TREATMENT_ROOMS.map((op) => (
            <div key={op.name} className="w-[62%] shrink-0 snap-start rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 sm:w-auto">
              <p className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">{op.name}</p>
              <div className="mt-2 space-y-1.5">
                {op.slots.map((s, i) => (
                  <div
                    key={i}
                    className={`rounded border px-1.5 py-1 text-[0.7rem] sm:text-[0.55rem] ${
                      s.tone === "confirmed"
                        ? "border-white/10 bg-white/[0.05] text-white/70"
                        : s.tone === "risk"
                          ? "border-crimson/40 bg-crimson/15 text-crimson-light"
                          : "border-dashed border-white/15 bg-transparent text-white/35"
                    }`}
                  >
                    {s.label}
                    {s.tone === "risk" && <span className="ml-1 opacity-80">· unconfirmed</span>}
                    {s.tone === "open" && <span className="ml-1">· open slot</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-crimson/25 bg-crimson/[0.07] px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-crimson-light" />
          <p className="text-[0.72rem] sm:text-[0.62rem] leading-snug text-white/70">
            2:30 consult confirmed by text, no-show risk cleared, intake forms already returned
          </p>
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* Real estate: listing status board                                   */
/* ------------------------------------------------------------------ */

/**
 * A status board rather than a chart: it keeps the three hero visuals
 * visually distinct (gantt bars, room grid, status columns) instead of
 * reading as a near-duplicate of another vertical.
 */
const LISTING_COLUMNS = [
  {
    name: "Active",
    files: [
      { address: "22 Cordwainer Dr", detail: "$749k · 6 showings", tone: "normal" as const },
      { address: "9 Standish Ave", detail: "$412k · listed Fri", tone: "normal" as const },
    ],
  },
  {
    name: "Under contract",
    files: [
      { address: "14 Sea Breeze Ln", detail: "Inspection Thu 5:00", tone: "risk" as const },
      { address: "41 Bayberry Rd", detail: "Appraisal ordered", tone: "normal" as const },
    ],
  },
  {
    name: "Closing this week",
    files: [
      { address: "8 Rockland Way", detail: "Mon 9:00 · clear", tone: "normal" as const },
      { address: "Next available", detail: "", tone: "open" as const },
    ],
  },
];

export function ListingPipelineVisual() {
  return (
    <Window title="Brokerage Operations Hub" chip="Live board">
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <MiniStat label="Speed to lead" value="38 sec" accent />
          <MiniStat label="Showings booked" value="27 this wk" />
          <MiniStat label="Under contract" value="9" />
        </div>

        <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain px-1 pb-1 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
          {LISTING_COLUMNS.map((col) => (
            <div key={col.name} className="w-[62%] shrink-0 snap-start rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5 sm:w-auto">
              <p className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">{col.name}</p>
              <div className="mt-2 space-y-1.5">
                {col.files.map((f) => (
                  <div
                    key={f.address}
                    className={`rounded border px-1.5 py-1 text-[0.7rem] sm:text-[0.55rem] ${
                      f.tone === "normal"
                        ? "border-white/10 bg-white/[0.05] text-white/70"
                        : f.tone === "risk"
                          ? "border-crimson/40 bg-crimson/15 text-crimson-light"
                          : "border-dashed border-white/15 bg-transparent text-white/35"
                    }`}
                  >
                    {f.address}
                    {f.detail && <span className="ml-1 opacity-80">· {f.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-crimson/25 bg-crimson/[0.07] px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-crimson-light" />
          <p className="text-[0.72rem] sm:text-[0.62rem] leading-snug text-white/70">
            Inspection contingency on 14 Sea Breeze Ln expires Thu 5:00 PM, both agents and the coordinator alerted
          </p>
        </div>
      </div>
    </Window>
  );
}
