/**
 * Industry-specific hero interface previews. Purely decorative, aria-hidden
 * mock product surfaces — each vertical gets its own: a dispatch board for
 * home services, an operatory schedule for dental, and a multi-location
 * sales grid for retail. CSS-only animation (pulse) so these stay server-
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
      <p className="font-mono text-[0.7rem] uppercase tracking-label text-white/35 sm:text-[0.5rem]">
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
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Calls answered" value="100%" accent />
          <MiniStat label="Booked today" value="9 jobs" />
          <MiniStat label="Unsent estimates" value="0" />
        </div>

        <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">
            Dispatch — today
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
            Missed call recovered — texted back in 12s, qualified, booked for Thu 9:00 AM
          </p>
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* Dental: operatory schedule                                          */
/* ------------------------------------------------------------------ */

const OPERATORIES = [
  { name: "Op 1", slots: [{ label: "Crown prep", tone: "confirmed" }, { label: "New patient", tone: "confirmed" }] },
  { name: "Op 2", slots: [{ label: "Composite", tone: "confirmed" }, { label: "Consult", tone: "risk" }] },
  { name: "Hygiene", slots: [{ label: "Recall", tone: "confirmed" }, { label: "Recall", tone: "open" }] },
];

export function OperatoryScheduleVisual() {
  return (
    <Window title="Practice Front Desk" chip="Simulated">
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="Confirmed today" value="14 / 15" accent />
          <MiniStat label="Recalls due" value="23" />
          <MiniStat label="Intake pending" value="2" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {OPERATORIES.map((op) => (
            <div key={op.name} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
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
            2:30 consult confirmed by text — no-show risk cleared, intake forms already returned
          </p>
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ */
/* Retail: multi-location grid                                         */
/* ------------------------------------------------------------------ */

const LOCATIONS = [
  { name: "Main St", sales: "$4,210", spark: "0,18 10,14 20,15 30,10 40,12 50,7 60,9 70,4" },
  { name: "Harbor Row", sales: "$3,485", spark: "0,16 10,17 20,12 30,13 40,9 50,11 60,6 70,7" },
  { name: "Online", sales: "$5,940", spark: "0,19 10,15 20,16 30,11 40,13 50,8 60,10 70,3" },
];

export function LocationGridVisual() {
  return (
    <Window title="Retail Operations Hub" chip="All locations">
      <div className="grid gap-3">
        <div className="grid grid-cols-3 gap-2">
          {LOCATIONS.map((l) => (
            <div key={l.name} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
              <p className="font-mono text-[0.7rem] sm:text-[0.52rem] uppercase tracking-label text-white/35">{l.name}</p>
              <p className="mt-1 font-display text-sm text-white/85">{l.sales}</p>
              <svg viewBox="0 0 70 22" className="mt-1.5 h-5 w-full" preserveAspectRatio="none">
                <polyline
                  points={l.spark}
                  fill="none"
                  stroke="rgba(217,75,94,0.75)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MiniStat label="Carts recovered" value="6 today" accent />
          <MiniStat label="Loyalty joins" value="+11 this wk" />
        </div>

        <div className="flex items-center gap-2.5 rounded-lg border border-crimson/25 bg-crimson/[0.07] px-3 py-2.5">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-crimson-light" />
          <p className="text-[0.72rem] sm:text-[0.62rem] leading-snug text-white/70">
            Low stock: Waxed Canvas Jacket (M) at Harbor Row — reorder drafted, Main St has 4 units
          </p>
        </div>
      </div>
    </Window>
  );
}
