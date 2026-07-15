import type { AnalyticsPoint } from "../types";

/**
 * Lightweight inline-SVG charts for the demo analytics views.
 * No chart library — keeps the demos fast and the bundle small.
 */

export function BarChart({
  points,
  unit,
  accentLast = true,
}: {
  points: AnalyticsPoint[];
  unit: string;
  accentLast?: boolean;
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div>
      <div
        className="flex h-36 items-end gap-2 sm:gap-3"
        role="img"
        aria-label={`Bar chart, ${unit}: ${points
          .map((p) => `${p.label} ${p.value}`)
          .join(", ")}`}
      >
        {points.map((p, i) => {
          const isAccent = accentLast && i === points.length - 1;
          return (
            <div key={p.label} className="group flex flex-1 flex-col items-center gap-2">
              <span className="text-[0.6rem] tabular-nums text-white/40 opacity-0 transition-opacity group-hover:opacity-100">
                {p.value}
              </span>
              <div
                className={`w-full rounded-sm transition-colors ${
                  isAccent
                    ? "bg-crimson/80 group-hover:bg-crimson"
                    : "bg-white/[0.14] group-hover:bg-white/[0.24]"
                }`}
                style={{ height: `${Math.max((p.value / max) * 100, 4)}%` }}
              />
              <span className="text-[0.58rem] uppercase tracking-wider text-white/35">
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineChart({
  points,
  unit,
}: {
  points: AnalyticsPoint[];
  unit: string;
}) {
  const w = 320;
  const h = 110;
  const pad = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p.value - min) / range) * (h - pad * 2);
    return { x, y };
  });
  const path = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${coords[coords.length - 1].x.toFixed(1)},${h - pad} L${coords[0].x.toFixed(
    1,
  )},${h - pad} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Line chart, ${unit}: ${points
          .map((p) => `${p.label} ${p.value}`)
          .join(", ")}`}
      >
        <defs>
          <linearGradient id="demo-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(179,36,58,0.28)" />
            <stop offset="100%" stopColor="rgba(179,36,58,0)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={pad}
            x2={w - pad}
            y1={pad + f * (h - pad * 2)}
            y2={pad + f * (h - pad * 2)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        <path d={area} fill="url(#demo-line-fill)" />
        <path d={path} fill="none" stroke="#d94b5e" strokeWidth="2" strokeLinecap="round" />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 3.5 : 2}
            fill={i === coords.length - 1 ? "#d94b5e" : "#0c0c10"}
            stroke="#d94b5e"
            strokeWidth="1.5"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between">
        {points.map((p) => (
          <span key={p.label} className="text-[0.58rem] uppercase tracking-wider text-white/35">
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FunnelChart({ points }: { points: AnalyticsPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div
      className="space-y-2.5"
      role="img"
      aria-label={`Funnel: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`}
    >
      {points.map((p, i) => (
        <div key={p.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="text-xs text-white/60">{p.label}</span>
            <span className="text-xs tabular-nums text-white/80">{p.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${
                i === points.length - 1 ? "bg-crimson" : "bg-white/25"
              }`}
              style={{ width: `${Math.max((p.value / max) * 100, 3)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
