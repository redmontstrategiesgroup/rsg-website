/* NEXUS Observatory — world model: typed entity graph + the Harborview synthetic demo world.
   Every entity: {id, type, name, attrs, nb (location), source, confidence, updatedAt}
   Every relationship: {from, rel, to, attrs?} — persistent and queryable.
   ALL POPULATION DATA IS SYNTHETIC. No entity represents a real person. */
(function () {
  const W = (OBS.world = {});

  // ---- entity graph ----------------------------------------------------
  W.Graph = class {
    constructor() { this.nodes = new Map(); this.edges = []; }
    add(ent) { this.nodes.set(ent.id, ent); return ent; }
    get(id) { return this.nodes.get(id); }
    link(from, rel, to, attrs = {}) { this.edges.push({ from, rel, to, attrs }); }
    out(id, rel) { return this.edges.filter((e) => e.from === id && (!rel || e.rel === rel)); }
    inn(id, rel) { return this.edges.filter((e) => e.to === id && (!rel || e.rel === rel)); }
    byType(type) { return [...this.nodes.values()].filter((n) => n.type === type); }
    neighbors(id) { return [...this.out(id), ...this.inn(id)]; }
  };

  const SRC_SYN = { kind: "synthetic", ref: "harborview-demo-generator", date: "2026-07-23" };
  const SRC_DEF = { kind: "default", ref: "engine defaults", date: "2026-07-23" };

  function ent(id, type, name, attrs = {}, nb = null, source = SRC_SYN, confidence = 0.6) {
    return { id, type, name, attrs, nb, source, confidence, updatedAt: "2026-07-23" };
  }

  // ---- model parameters (all adjustable; all carry provenance) --------
  // tag: which sensitivity family; source updated by calibration
  W.PARAMS = [
    { key: "beta_grocery", label: "Travel decay β — grocery", value: 0.10, unit: "1/min", tag: "demand", source: SRC_DEF },
    { key: "beta_dining", label: "Travel decay β — dining", value: 0.07, unit: "1/min", tag: "demand", source: SRC_DEF },
    { key: "beta_retail", label: "Travel decay β — retail", value: 0.06, unit: "1/min", tag: "demand", source: SRC_DEF },
    { key: "beta_services", label: "Travel decay β — services", value: 0.08, unit: "1/min", tag: "demand", source: SRC_DEF },
    { key: "beta_fitness", label: "Travel decay β — fitness", value: 0.09, unit: "1/min", tag: "demand", source: SRC_DEF },
    { key: "beta_healthcare", label: "Travel decay β — healthcare", value: 0.04, unit: "1/min", tag: "demand", source: SRC_DEF },
    { key: "elast_grocery", label: "Price elasticity — grocery", value: 1.8, unit: "", tag: "demand", source: SRC_DEF },
    { key: "elast_dining", label: "Price elasticity — dining", value: 1.2, unit: "", tag: "demand", source: SRC_DEF },
    { key: "elast_retail", label: "Price elasticity — retail", value: 1.4, unit: "", tag: "demand", source: SRC_DEF },
    { key: "elast_services", label: "Price elasticity — services", value: 1.0, unit: "", tag: "demand", source: SRC_DEF },
    { key: "elast_fitness", label: "Price elasticity — fitness", value: 1.3, unit: "", tag: "demand", source: SRC_DEF },
    { key: "mpc_low", label: "Marginal propensity to consume — low income", value: 0.95, unit: "", tag: "economy", source: SRC_DEF },
    { key: "mpc_mid", label: "Marginal propensity to consume — mid income", value: 0.85, unit: "", tag: "economy", source: SRC_DEF },
    { key: "mpc_high", label: "Marginal propensity to consume — high income", value: 0.70, unit: "", tag: "economy", source: SRC_DEF },
    { key: "bpr_alpha", label: "BPR congestion α", value: 0.15, unit: "", tag: "traffic", source: SRC_DEF },
    { key: "bpr_beta", label: "BPR congestion exponent", value: 4, unit: "", tag: "traffic", source: SRC_DEF },
    { key: "peak_spread_hr", label: "Peak spreading window", value: 2.5, unit: "hours", tag: "traffic", source: SRC_DEF },
    { key: "car_occupancy", label: "Vehicle occupancy", value: 1.05, unit: "persons/veh", tag: "traffic", source: SRC_DEF },
    { key: "unemp_benefit", label: "Daily unemployment benefit", value: 64, unit: "$/day", tag: "economy", source: SRC_DEF },
    { key: "demand_noise", label: "Daily demand noise (σ)", value: 0.05, unit: "±", tag: "uncertainty", source: SRC_DEF },
    { key: "lateness_threshold", label: "Lateness threshold (added commute)", value: 10, unit: "min", tag: "workforce", source: SRC_DEF },
    { key: "clinic_service_min", label: "Clinic mean service time", value: 12, unit: "min", tag: "facility", source: SRC_DEF },
    { key: "clinic_balk_min", label: "Clinic balk threshold (expected wait)", value: 45, unit: "min", tag: "facility", source: SRC_DEF },
    { key: "spoilage_share", label: "Grocery spoilage share in outage", value: 0.4, unit: "of daily rev/day", tag: "resilience", source: SRC_DEF },
    { key: "reopen_bump", label: "Post-outage pent-up demand bump", value: 0.2, unit: "+share, 3 days", tag: "resilience", source: SRC_DEF },
  ];
  W.param = (state, key) => {
    const o = OBS.store.data.paramOverrides[key];
    if (o != null) return o;
    const p = W.PARAMS.find((x) => x.key === key);
    return p ? p.value : 0;
  };

  // spending profile per income band: $/household/day and category shares
  W.SPEND = {
    low: { total: 62, shares: { grocery: 0.32, dining: 0.10, retail: 0.18, services: 0.12, fitness: 0.02, healthcare: 0.05 } },
    mid: { total: 96, shares: { grocery: 0.28, dining: 0.14, retail: 0.20, services: 0.14, fitness: 0.03, healthcare: 0.05 } },
    high: { total: 150, shares: { grocery: 0.22, dining: 0.18, retail: 0.24, services: 0.16, fitness: 0.05, healthcare: 0.04 } },
    // remainder of each budget = external/online leakage — an explicit, reviewable assumption
  };
  W.TICKET = { grocery: 28, dining: 19, retail: 42, services: 55, fitness: 3.2, healthcare: 140 };
  W.COGS = { grocery: 0.68, dining: 0.38, retail: 0.55, services: 0.25, fitness: 0.12, healthcare: 0.45, hospital: 0.5, manufacturing: 0.7, logistics: 0.6, public: 0 };

  // ---- Harborview demo world ------------------------------------------
  W.build = function () {
    const g = new W.Graph();

    // neighborhoods (map coords in abstract 100×70 plan units)
    const NBS = [
      ["hp", "Harbor Point", 16, 50, "mixed residential, older housing stock"],
      ["or", "Old Row", 34, 56, "dense pre-war residential"],
      ["mt", "Midtown", 46, 34, "commercial core, civic anchor"],
      ["eg", "Eastgate", 72, 44, "residential + neighborhood retail"],
      ["nf", "Northfield", 52, 12, "higher-income residential"],
      ["wi", "Westside Industrial", 20, 24, "manufacturing & logistics"],
    ];
    for (const [id, name, x, y, desc] of NBS) g.add(ent(id, "neighborhood", name, { x, y, desc }));
    g.add(ent("ext", "region", "Regional gateway", { x: 88, y: 8, desc: "external labor & retail market" }));

    // road network (edges are entities too)
    const ROADS = [
      ["r1", "Harbor Bridge", "hp", "mt", 1800, 8],
      ["r2", "Shoreline Rd", "hp", "or", 900, 12],
      ["r3", "Old Row Ave", "or", "mt", 700, 7],
      ["r4", "Canal St", "mt", "eg", 1200, 6],
      ["r5", "Northfield Pkwy", "mt", "nf", 1400, 7],
      ["r6", "Route 9", "nf", "ext", 2000, 10],
      ["r7", "Freight Rd", "eg", "wi", 1000, 9],
      ["r8", "Terminal Ave", "mt", "wi", 1100, 8],
      ["r9", "Beacon St", "or", "eg", 600, 9],
      ["r10", "Dockside Loop", "hp", "wi", 500, 14],
      ["r11", "East Spur", "eg", "ext", 1200, 12],
    ];
    for (const [id, name, a, b, cap, min] of ROADS) {
      g.add(ent(id, "road", name, { a, b, capacityHr: cap, baseMin: min }));
      g.link(id, "connects", a); g.link(id, "connects", b);
    }

    // power infrastructure
    g.add(ent("sub_north", "substation", "North Substation", { serves: ["nf", "mt"] }));
    g.add(ent("sub_south", "substation", "South Substation", { serves: ["hp", "or", "eg", "wi"] }));
    for (const s of ["sub_north", "sub_south"]) for (const nb of g.get(s).attrs.serves) g.link(nb, "powered_by", s);

    // organizations  [id, name, sector, nb, jobs, wage$/day, price, quality, capacity/day, fixed$/day, backup]
    const ORGS = [
      ["meridian", "Meridian Assembly Co.", "manufacturing", "wi", 1400, 176, 1, 0.6, 0, 9000, true],
      ["port", "Harborview Logistics", "logistics", "wi", 520, 168, 1, 0.6, 0, 4200, false],
      ["hospital", "St. Anne's Medical Center", "hospital", "mt", 640, 208, 1, 0.8, 900, 15000, true],
      ["cityops", "City of Harborview", "public", "mt", 380, 192, 1, 0.6, 0, 0, true],
      ["gm1", "Fresh Fields Market", "grocery", "mt", 38, 122, 1.0, 0.72, 2600, 2600, false],
      ["gm2", "Eastgate Grocers", "grocery", "eg", 26, 118, 0.95, 0.62, 1900, 1700, false],
      ["gm3", "Harbor Pantry", "grocery", "hp", 18, 116, 1.02, 0.58, 1200, 1200, false],
      ["rt1", "Midtown Galleria", "retail", "mt", 70, 126, 1.05, 0.74, 2100, 3900, false],
      ["rt2", "Eastgate Plaza", "retail", "eg", 36, 120, 0.95, 0.6, 1200, 1900, false],
      ["fd1", "Canal Street Diner Group", "dining", "mt", 30, 118, 1.0, 0.68, 1400, 800, false],
      ["fd2", "Harbor Point Cafés", "dining", "hp", 32, 114, 0.95, 0.62, 1150, 750, false],
      ["fd3", "Northfield Bistro Row", "dining", "nf", 36, 132, 1.25, 0.78, 950, 1100, false],
      ["sv1", "Midtown Services Group", "services", "mt", 60, 130, 1.0, 0.66, 700, 1300, false],
      ["sv2", "Old Row Trades", "services", "or", 28, 122, 0.9, 0.58, 380, 500, false],
      ["gym1", "Harborview Athletic Club", "fitness", "mt", 20, 120, 1.0, 0.6, 3400, 900, false],
      ["clinic", "Harbor Walk-in Clinic", "healthcare", "eg", 22, 150, 1, 0.66, 320, 2100, false],
    ];
    for (const [id, name, sector, nb, jobs, wage, price, quality, cap, fixed, backup] of ORGS) {
      g.add(ent(id, "organization", name, { sector, jobs, wage, priceLevel: price, quality, capacityDaily: cap, fixedDaily: fixed, backupPower: backup }, nb));
      g.link(id, "located_in", nb);
      g.link(id, "powered_by", nb === "nf" || nb === "mt" ? "sub_north" : "sub_south");
    }
    // supply relationships (institutional-memory + freight sensitivity)
    g.link("gm1", "purchases_from", "port"); g.link("gm2", "purchases_from", "port"); g.link("gm3", "purchases_from", "port");
    g.link("rt1", "purchases_from", "ext"); g.link("meridian", "ships_via", "port");

    // population cohorts: neighborhood × income band (synthetic, aggregate)
    // [nb, band, households, workersPerHh, carShare]
    const COHORT_DEF = [
      ["hp", "low", 420, 1.1, 0.55], ["hp", "mid", 380, 1.3, 0.75], ["hp", "high", 90, 1.2, 0.9],
      ["or", "low", 520, 1.0, 0.45], ["or", "mid", 300, 1.3, 0.7], ["or", "high", 40, 1.2, 0.85],
      ["mt", "low", 180, 1.1, 0.4], ["mt", "mid", 340, 1.3, 0.6], ["mt", "high", 160, 1.2, 0.8],
      ["eg", "low", 560, 1.1, 0.5], ["eg", "mid", 420, 1.3, 0.72], ["eg", "high", 70, 1.2, 0.88],
      ["nf", "low", 60, 1.0, 0.6], ["nf", "mid", 280, 1.3, 0.85], ["nf", "high", 330, 1.2, 0.95],
      ["wi", "low", 150, 1.2, 0.6], ["wi", "mid", 90, 1.3, 0.75], ["wi", "high", 10, 1.2, 0.9],
    ];
    const cohorts = [];
    for (const [nb, band, hh, wph, car] of COHORT_DEF) {
      const id = `c_${nb}_${band}`;
      const workers = Math.round(hh * wph);
      const c = ent(id, "cohort", `${g.get(nb).name} — ${band} income (synthetic cohort)`, {
        band, households: hh, persons: Math.round(hh * 2.4), workers, carShare: car,
        employment: {}, unemployed: 0, income: 0, incomeBase: 0, spendScale: 1,
      }, nb);
      g.add(c); cohorts.push(c); g.link(id, "lives_in", nb);
    }

    // deterministic job allocation: each org's jobs distributed across cohorts
    // by distance affinity + band affinity (largest-remainder rounding)
    const distAff = { hp: { hp: 3, or: 2, mt: 1.5, eg: 0.7, nf: 0.5, wi: 1.6 }, or: { hp: 2, or: 3, mt: 2, eg: 1.2, nf: 0.6, wi: 1.4 }, mt: { hp: 1.5, or: 2, mt: 3, eg: 1.5, nf: 1.6, wi: 1.2 }, eg: { hp: 0.7, or: 1.2, mt: 1.5, eg: 3, nf: 0.8, wi: 1.8 }, nf: { hp: 0.5, or: 0.6, mt: 1.8, eg: 0.8, nf: 3, wi: 0.5 }, wi: { hp: 1.6, or: 1.4, mt: 1.2, eg: 1.8, nf: 0.4, wi: 3 } };
    const bandAff = {
      manufacturing: { low: 1.6, mid: 1.2, high: 0.2 }, logistics: { low: 1.5, mid: 1.2, high: 0.2 },
      healthcare: { low: 0.7, mid: 1.4, high: 1.2 }, hospital: { low: 0.7, mid: 1.4, high: 1.2 }, public: { low: 0.8, mid: 1.4, high: 1.0 },
      grocery: { low: 1.6, mid: 1.0, high: 0.2 }, retail: { low: 1.4, mid: 1.1, high: 0.3 },
      dining: { low: 1.5, mid: 1.0, high: 0.3 }, services: { low: 1.0, mid: 1.3, high: 0.6 }, fitness: { low: 0.8, mid: 1.3, high: 0.7 },
    };
    const capacityLeft = Object.fromEntries(cohorts.map((c) => [c.id, c.attrs.workers]));
    for (const [oid] of ORGS) {
      const o = g.get(oid);
      const weights = cohorts.map((c) => {
        const w = (distAff[o.nb]?.[c.nb] ?? 1) * (bandAff[o.attrs.sector]?.[c.attrs.band] ?? 1) * Math.min(1, capacityLeft[c.id] / 50);
        return { c, w: Math.max(0.01, w) };
      });
      const tot = weights.reduce((s, x) => s + x.w, 0);
      let assigned = 0;
      const shares = weights.map(({ c, w }) => ({ c, exact: (o.attrs.jobs * w) / tot }));
      for (const s of shares) { s.n = Math.floor(s.exact); assigned += s.n; }
      shares.sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
      for (let i = 0; assigned < o.attrs.jobs && i < shares.length; i++, assigned++) shares[i].n++;
      for (const s of shares) {
        const n = Math.min(s.n, capacityLeft[s.c.id]);
        if (n > 0) { s.c.attrs.employment[oid] = (s.c.attrs.employment[oid] || 0) + n; capacityLeft[s.c.id] -= n; g.link(s.c.id, "works_at", oid, { workers: n }); }
      }
    }
    // remaining workers: external commuters (65%) / unemployed (35%)
    for (const c of cohorts) {
      const left = capacityLeft[c.id];
      const extN = Math.round(left * 0.78);
      if (extN > 0) { c.attrs.employment.ext = extN; g.link(c.id, "works_at", "ext", { workers: extN }); }
      c.attrs.unemployed = left - extN;
    }
    g.add(ent("ext_jobs", "organization", "Regional employers (external)", { sector: "external", jobs: 0, wage: 180, priceLevel: 1, quality: 0.5, capacityDaily: 0, fixedDaily: 0, backupPower: true }, "ext"));

    // facility model attached to clinic
    g.get("clinic").attrs.facility = { servers: 3, layoutEff: 1.0, triage: false, hours: 10 };

    // sample synthetic agents for inspection (4 per cohort) — clearly labeled
    const rng = new OBS.Rng(20260723);
    const OCC = { low: ["line operator", "warehouse associate", "retail associate", "food service"], mid: ["technician", "nurse", "office administrator", "driver"], high: ["engineer", "physician", "manager", "analyst"] };
    let n = 0;
    for (const c of cohorts) {
      for (let i = 0; i < 4; i++) {
        const id = `agent_${c.nb}_${c.attrs.band}_${i}`;
        const emps = Object.keys(c.attrs.employment);
        const employer = emps.length ? emps[i % emps.length] : null;
        g.add(ent(id, "agent", `Synthetic resident ${String(++n).padStart(3, "0")}`, {
          synthetic: true, cohort: c.id, ageRange: rng.pick(["25–34", "35–44", "45–54", "55–64"]),
          occupation: rng.pick(OCC[c.attrs.band]), employer, incomeBand: c.attrs.band,
          carAccess: rng.next() < c.attrs.carShare, riskTolerance: OBS.round(rng.range(0.2, 0.8), 2),
          stress: 0.2, memories: [],
        }, c.nb, SRC_SYN, 0.5));
        g.link(id, "member_of", c.id);
        if (employer) g.link(id, "works_at", employer);
      }
    }

    // world-level metadata
    const world = {
      id: "harborview", version: "1.0.0", name: "Harborview District (synthetic demo)",
      synthetic: true, population: cohorts.reduce((s, c) => s + c.attrs.persons, 0),
      households: cohorts.reduce((s, c) => s + c.attrs.households, 0),
      builtAt: "2026-07-23",
      note: "Fully synthetic demonstration world. All values default/assumed unless replaced by imported data. Not calibrated to any real place.",
      graph: g,
    };
    return world;
  };

  // serializable snapshot of the *mutable* simulation-relevant state
  W.mutableState = function (world) {
    const g = world.graph;
    // align org payrolls with the jobs actually assigned to cohorts
    const assigned = {};
    for (const c of g.byType("cohort"))
      for (const [oid, n] of Object.entries(c.attrs.employment)) assigned[oid] = (assigned[oid] || 0) + n;
    const orgs = {};
    for (const o of g.byType("organization")) {
      orgs[o.id] = {
        jobs: assigned[o.id] ?? o.attrs.jobs, wage: o.attrs.wage, priceLevel: o.attrs.priceLevel, quality: o.attrs.quality,
        capacityDaily: o.attrs.capacityDaily, fixedDaily: o.attrs.fixedDaily, backupPower: o.attrs.backupPower,
        sector: o.attrs.sector, nb: o.nb, open: true, cash: 30 * (o.attrs.fixedDaily || 100),
        staff: assigned[o.id] ?? o.attrs.jobs, revenue7: [], memoryLog: [], facility: o.attrs.facility ? { ...o.attrs.facility } : null,
      };
    }
    const cohorts = {};
    for (const c of g.byType("cohort")) {
      cohorts[c.id] = {
        nb: c.nb, band: c.attrs.band, households: c.attrs.households, persons: c.attrs.persons,
        workers: c.attrs.workers, carShare: c.attrs.carShare,
        employment: { ...c.attrs.employment }, unemployed: c.attrs.unemployed,
        income: 0, incomeBase: 0, spendScale: 1, commuteBase: {}, latenessDays: {},
      };
    }
    return { orgs, cohorts, closedRoads: {}, outages: {}, newOrgSeq: 0 };
  };
})();
