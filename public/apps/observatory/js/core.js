/* NEXUS Observatory — core: deterministic RNG, stats, persistence, audit.
   No Math.random anywhere in simulation code paths. */
window.OBS = { VERSION: "2.0.0", ENGINE: "obs-engine-1" };

(function () {
  // ---- deterministic RNG (mulberry32) — instantiated per run, state serializable
  class Rng {
    constructor(seed) { this.s = (seed | 0) || 1; }
    next() {
      this.s |= 0; this.s = (this.s + 0x6D2B79F5) | 0;
      let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.next() * (b - a); }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    // symmetric noise multiplier, e.g. noise(0.05) ∈ [0.95, 1.05]
    noise(mag) { return 1 + (this.next() * 2 - 1) * mag; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  }
  OBS.Rng = Rng;

  // string → stable 32-bit hash (for scenario/seed derivation)
  OBS.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h | 0;
  };

  // ---- stats helpers ---------------------------------------------------
  OBS.stat = {
    mean: (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
    quantile: (arr, q) => {
      if (!arr.length) return 0;
      const a = arr.slice().sort((x, y) => x - y);
      const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
      return a[lo] + (a[hi] - a[lo]) * (pos - lo);
    },
    // per-index quantiles across an array of series
    bandOf: (seriesList, q) => {
      const n = Math.max(...seriesList.map((s) => s.length));
      const out = new Array(n);
      for (let i = 0; i < n; i++) out[i] = OBS.stat.quantile(seriesList.map((s) => s[i] ?? 0), q);
      return out;
    },
    mape: (pred, actual) => {
      let s = 0, n = 0;
      for (let i = 0; i < actual.length; i++) {
        if (actual[i] == null || pred[i] == null || actual[i] === 0) continue;
        s += Math.abs((pred[i] - actual[i]) / actual[i]); n++;
      }
      return n ? (s / n) * 100 : null;
    },
  };

  OBS.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  OBS.round = (v, d = 0) => { const m = 10 ** d; return Math.round(v * m) / m; };
  OBS.fmt = {
    num: (v, d = 0) => v == null ? "—" : Number(v).toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 }),
    money: (v, d = 0) => v == null ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: d }),
    pct: (v, d = 1) => v == null ? "—" : (v * 100).toFixed(d) + "%",
    signed: (v, d = 1) => v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d),
    min: (v) => v == null ? "—" : v.toFixed(1) + " min",
    day: (d) => "Day " + d,
  };
  OBS.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  OBS.clone = (o) => (typeof structuredClone === "function" ? structuredClone(o) : JSON.parse(JSON.stringify(o)));
  OBS.slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);

  // ---- persistence -----------------------------------------------------
  const LS = "obs_store_v1";
  OBS.store = {
    data: null,
    load() {
      try { this.data = JSON.parse(localStorage.getItem(LS)) || null; } catch { this.data = null; }
      if (!this.data || this.data.v !== 1) {
        this.data = {
          v: 1, scenarios: [], reports: [], audit: [], calibrations: [],
          imports: [], settings: { theme: "light", role: "analyst", seeds: 7, copilotModel: "claude-opus-4-8" },
          paramOverrides: {},
        };
      }
      return this.data;
    },
    save() {
      try { localStorage.setItem(LS, JSON.stringify(this.data)); }
      catch { /* trim biggest items and retry once */
        this.data.reports = this.data.reports.slice(-5);
        this.data.audit = this.data.audit.slice(-200);
        try { localStorage.setItem(LS, JSON.stringify(this.data)); } catch { /* give up quietly; session-only */ }
      }
    },
    reset() { localStorage.removeItem(LS); location.reload(); },
  };

  // ---- audit log (append-only) ----------------------------------------
  OBS.audit = function (action, detail) {
    const d = OBS.store.data;
    d.audit.push({ at: new Date().toISOString(), role: d.settings.role, action, detail: String(detail ?? "").slice(0, 300) });
    if (d.audit.length > 500) d.audit.splice(0, d.audit.length - 500);
    OBS.store.save();
  };

  // roles: viewer < analyst < admin (client-side gate — see LIMITATIONS in README)
  OBS.can = function (need) {
    const order = { viewer: 0, analyst: 1, admin: 2 };
    return order[OBS.store.data.settings.role] >= order[need];
  };
})();
