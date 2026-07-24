/* NEXUS Observatory — scenarios: spec schema, NL parsing, branching, Monte Carlo,
   divergence, sensitivity, causal chains. A spec must be human-reviewed before running. */
(function () {
  const SC = (OBS.scenario = {});

  // ---- spec ------------------------------------------------------------
  SC.newSpec = function (partial = {}) {
    const id = partial.id || "sc_" + OBS.slug(partial.name || "untitled") + "_" + (OBS.store.data.scenarios.length + 1);
    return {
      id, name: partial.name || "Untitled scenario",
      objective: partial.objective || "",
      worldId: "harborview", worldVersion: "1.0.0",
      horizonDays: partial.horizonDays || 90,
      seeds: partial.seeds || OBS.store.data.settings.seeds || 7,
      headlineMetric: partial.headlineMetric || "retail_revenue",
      metrics: partial.metrics || ["retail_revenue", "unemployment_rate", "avg_commute"],
      branches: partial.branches || [],   // baseline auto-added at run time
      paramOverrides: partial.paramOverrides || {},
      watchOrg: partial.watchOrg || null, // per-branch org revenue tracking (e.g. a new business)
      assumptionsNotes: partial.assumptionsNotes || [],
      flags: partial.flags || [],         // parser warnings requiring review
      reviewed: false, createdAt: new Date().toISOString(), status: "draft",
    };
  };

  SC.describeDelta = function (d, world) {
    const n = (id) => world.graph.get(id)?.name || id;
    switch (d.type) {
      case "close_road": return `Close ${n(d.edgeId)} from day ${d.startDay} for ${d.days} days`;
      case "outage": return `Power outage at ${d.subId === "all" ? "both substations" : n(d.subId)} — day ${d.startDay}, ${d.days} days`;
      case "layoff": return `${n(d.orgId)} cuts ${d.count ?? Math.round((d.pct || 0) * 100) + "% of"} jobs on day ${d.startDay}`;
      case "open_business": return `Open ${d.name || d.sector} in ${n(d.nb)} on day ${d.startDay} (capacity ${d.capacityDaily}, staff ${d.staff}, price ×${d.priceLevel})`;
      case "price_change": return `${d.orgId ? n(d.orgId) : d.sector} prices ${d.pct > 0 ? "+" : ""}${Math.round(d.pct * 100)}% from day ${d.startDay}`;
      case "facility_config": return `Reconfigure ${n(d.orgId || "clinic")}: ${Object.entries(d.config).map(([k, v]) => k + "=" + v).join(", ")}`;
      case "add_housing": return `Add ${d.units} housing units in ${n(d.nb)} (day ${d.startDay})`;
      case "demand_shock": return `${d.category} demand ${d.pct > 0 ? "+" : ""}${Math.round(d.pct * 100)}% for ${d.days} days`;
      case "param": return `Assumption override: ${d.key} = ${d.value}`;
      default: return JSON.stringify(d);
    }
  };

  // assumptions table for the review step — every default is visible & sourced
  SC.assumptionRows = function (spec, world) {
    const rows = [];
    const tagsInPlay = new Set(["demand", "economy", "uncertainty"]);
    for (const b of spec.branches) for (const d of b.deltas) {
      if (d.type === "close_road") { tagsInPlay.add("traffic"); tagsInPlay.add("workforce"); }
      if (d.type === "outage") tagsInPlay.add("resilience");
      if (d.type === "facility_config") tagsInPlay.add("facility");
      if (d.type === "layoff") tagsInPlay.add("workforce");
    }
    for (const p of OBS.world.PARAMS) {
      if (!tagsInPlay.has(p.tag)) continue;
      const overridden = spec.paramOverrides[p.key] != null;
      const stored = OBS.store.data.paramOverrides[p.key] != null;
      rows.push({
        key: p.key, label: p.label,
        value: overridden ? spec.paramOverrides[p.key] : (stored ? OBS.store.data.paramOverrides[p.key] : p.value),
        unit: p.unit,
        source: overridden ? "scenario override" : stored ? "calibrated/user" : p.source.kind + " (" + p.source.ref + ")",
        tag: p.tag,
      });
    }
    return rows;
  };

  // ---- natural-language parser ----------------------------------------
  SC.parseNL = function (text, world) {
    const t = text.toLowerCase();
    const flags = [];
    const deltas = [];
    const g = world.graph;
    const findByName = (type) => g.byType(type).find((e) => t.includes(e.name.toLowerCase()) || new RegExp("\\b" + e.id + "\\b").test(t));
    const num = (re, def) => { const m = t.match(re); return m ? parseFloat(m[1]) : def; };
    const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
    const wordNum = (m) => (m ? (WORDS[m[1]] ?? parseFloat(m[1])) : null);
    const duration = () => {
      let m = t.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s*(day|week|month|year)s?/);
      if (!m) return null;
      const n = WORDS[m[1]] ?? parseFloat(m[1]);
      return Math.round(n * ({ day: 1, week: 7, month: 30, year: 365 }[m[2]]));
    };
    const pct = () => { const m = t.match(/(\d+(?:\.\d+)?)\s*%|(\d+(?:\.\d+)?)\s*percent/); return m ? parseFloat(m[1] ?? m[2]) / 100 : null; };
    const nb = findByName("neighborhood");
    let horizonDays = 90, headline = "retail_revenue", name = "Scenario", objective = text.trim();

    if (/clos|shut|block/.test(t) && /(road|bridge|street|ave|pkwy|rd\b|route|spur|loop)/.test(t)) {
      const road = findByName("road");
      if (!road) flags.push({ level: "blocked", text: "Could not identify which road. Name one of: " + g.byType("road").map((r) => r.name).join(", ") });
      const days = duration() || 90;
      if (!duration()) flags.push({ level: "review", text: "No duration found — defaulted to 90 days." });
      if (road) deltas.push({ type: "close_road", edgeId: road.id, startDay: 8, days });
      name = `Road closure — ${road ? road.name : "?"}`;
      horizonDays = Math.min(400, days + 40); headline = "avg_commute";
    } else if (/outage|blackout|power (goes|out|failure|cut)/.test(t)) {
      const days = duration() || 3;
      let subId = "sub_south";
      if (/north/.test(t)) subId = "sub_north";
      if (/region|city|both|entire|whole/.test(t)) subId = "all";
      else flags.push({ level: "review", text: `Assumed the outage hits ${subId === "sub_north" ? "North" : "South"} Substation. Change to 'all' for a regional outage.` });
      deltas.push({ type: "outage", subId, startDay: 8, days });
      name = `Power outage — ${days} days`; horizonDays = days + 30; headline = "retail_revenue";
    } else if (/(layoff|lay off|cut|reduce|shed).*(workforce|staff|jobs|workers|employees)|workforce reduction/.test(t)) {
      const org = findByName("organization") || (/(largest|biggest|major) employer/.test(t) ? g.get("meridian") : null);
      if (!org) flags.push({ level: "blocked", text: "Could not identify the employer. Largest is Meridian Assembly Co." });
      const p = pct();
      const count = !p ? wordNum(t.match(/(\d{2,5})\s*(jobs|workers|staff|employees|positions)/)) : null;
      if (!p && !count) flags.push({ level: "review", text: "No size found — defaulted to 10% of workforce." });
      if (org) deltas.push({ type: "layoff", orgId: org.id, pct: p ?? (count ? undefined : 0.10), count: count ?? undefined, startDay: 8 });
      name = `Workforce reduction — ${org ? org.name : "?"}`; horizonDays = 180; headline = "unemployment_rate";
    } else if (/open|launch|new/.test(t) && /(gym|fitness|studio|grocery|market|restaurant|diner|cafe|retail|store|shop|clinic|business)/.test(t)) {
      const sector = /gym|fitness|studio/.test(t) ? "fitness" : /grocery|market/.test(t) ? "grocery" : /restaurant|diner|cafe|dining/.test(t) ? "dining" : /clinic|health/.test(t) ? "healthcare" : /service/.test(t) ? "services" : "retail";
      const premium = /premium|high[- ]end|upscale|luxury/.test(t);
      const where = nb || g.get("mt");
      if (!nb) flags.push({ level: "review", text: "No neighborhood named — defaulted to Midtown. Consider branching across candidate sites." });
      flags.push({ level: "review", text: "Capacity, staffing, pricing and fixed costs are engine defaults — review before running." });
      deltas.push({ type: "open_business", orgId: "newbiz", sector, nb: where.id, name: (premium ? "Premium " : "New ") + sector + " (" + where.name + ")", priceLevel: premium ? 1.3 : 1.0, quality: premium ? 0.8 : 0.65, capacityDaily: sector === "fitness" ? 1400 : 600, staff: 12, wage: 135, startDay: 8 });
      name = `New ${sector} — ${where.name}`; horizonDays = 120; headline = "retail_revenue";
    } else if (/(raise|increase|lower|drop|cut).*(price)|price (increase|rise|hike|cut)/.test(t)) {
      const p = pct() || 0.1;
      const org = findByName("organization");
      const sign = /(lower|drop|cut|decrease)/.test(t) ? -1 : 1;
      if (!org) flags.push({ level: "review", text: "No specific business identified — applied to the retail sector." });
      deltas.push({ type: "price_change", orgId: org?.id, sector: org ? undefined : "retail", pct: sign * p, startDay: 8 });
      name = `Price change ${sign * p > 0 ? "+" : ""}${Math.round(sign * p * 100)}% — ${org ? org.name : "retail"}`; horizonDays = 90;
    } else if (/(add|build|construct).*(housing|apartments|units|homes)/.test(t)) {
      const units = wordNum(t.match(/(\d{2,5})\s*(housing|units|apartments|homes)/)) || 200;
      const where = nb || g.get("eg");
      if (!nb) flags.push({ level: "review", text: "No neighborhood named — defaulted to Eastgate." });
      flags.push({ level: "review", text: "New residents assumed mid-income, 1.1 workers and 2.4 persons/household." });
      deltas.push({ type: "add_housing", nb: where.id, units, startDay: 8 });
      name = `Housing — ${units} units in ${where.name}`; horizonDays = 180; headline = "unemployment_rate";
    } else if (/staffing|servers|clinic|queue|triage|front desk/.test(t)) {
      const n = wordNum(t.match(/(\d+)\s*(servers|staff|providers|clinicians|desks)/)) || 4;
      deltas.push({ type: "facility_config", orgId: "clinic", config: { servers: n }, startDay: 8 });
      name = `Facility staffing — clinic (${n} providers)`; horizonDays = 60; headline = "clinic_wait";
      flags.push({ level: "review", text: "Compare multiple configurations by adding branches (e.g. triage on/off)." });
    } else if (/bus route|transit|train|delivery time|supply chain|shipping delay/.test(t)) {
      flags.push({ level: "blocked", text: "Transit routes and supply-chain lead times are not modeled in Harborview v1. Closest available levers: road closures (network), demand shocks (category demand), price changes (cost pass-through). See LIMITATIONS in the README." });
    } else {
      flags.push({ level: "blocked", text: "Could not map this request to modeled levers. Available: road closures, power outages, layoffs, new businesses, price changes, housing, facility staffing, demand shocks. The Copilot (Settings → API key) can attempt a structured parse." });
    }

    const spec = SC.newSpec({ name, objective, horizonDays, headlineMetric: headline, metrics: defaultMetricsFor(headline), branches: deltas.length ? [{ id: "b1", name: "Intervention", deltas }] : [] });
    spec.flags = flags;
    if (deltas.some((d) => d.type === "open_business")) spec.watchOrg = "newbiz";
    return spec;
  };

  function defaultMetricsFor(headline) {
    const base = { avg_commute: ["avg_commute", "congestion_index", "retail_revenue", "productivity_loss", "grocery_access"], unemployment_rate: ["unemployment_rate", "labor_income", "consumer_spend", "retail_revenue", "external_leakage"], retail_revenue: ["retail_revenue", "consumer_spend", "external_leakage", "unemployment_rate"], clinic_wait: ["clinic_wait", "clinic_lost"] };
    return base[headline] || ["retail_revenue", "unemployment_rate", "avg_commute"];
  }

  // ---- demo templates (§17) -------------------------------------------
  SC.TEMPLATES = [
    {
      id: "demo_location", title: "Demo 1 · New business location",
      blurb: "A premium fitness studio in Midtown vs Northfield: demand, staffing, travel, competition, financials.",
      build: () => {
        const mk = (nb) => ({ type: "open_business", orgId: "newbiz", sector: "fitness", nb, name: `Premium fitness studio (${nb === "mt" ? "Midtown" : "Northfield"})`, priceLevel: 1.3, quality: 0.8, capacityDaily: 1400, staff: 12, wage: 135, fixedDaily: 1350, startingCash: 60000, startDay: 8 });
        const s = SC.newSpec({
          name: "New business location — premium fitness studio", horizonDays: 120, headlineMetric: "retail_revenue",
          objective: "Choose between two candidate sites for a premium fitness studio. Compare member demand, revenue, effect on the incumbent (Harborview Athletic Club), and financial viability.",
          metrics: ["retail_revenue", "consumer_spend", "external_leakage", "unemployment_rate"],
          branches: [{ id: "site_mt", name: "Site A — Midtown", deltas: [mk("mt")] }, { id: "site_nf", name: "Site B — Northfield", deltas: [mk("nf")] }],
          watchOrg: "newbiz",
          assumptionsNotes: ["Studio parameters (capacity 900 visits/day-equivalent, 14 staff, price ×1.3) are identical across sites — only location differs.", "Fitness demand follows a Huff gravity model with travel-decay β = 0.09/min and price elasticity 1.3."],
        });
        return s;
      },
    },
    {
      id: "demo_road", title: "Demo 2 · Major road closure",
      blurb: "Harbor Bridge closes for six months: traffic, commutes, lateness, business access, recovery.",
      build: () => SC.newSpec({
        name: "Harbor Bridge closure — 6 months", horizonDays: 200, headlineMetric: "avg_commute",
        objective: "Close Harbor Bridge (Harbor Point ↔ Midtown) for 180 days. Quantify commute and congestion impacts, knock-on effects on employers and businesses, and post-reopening recovery.",
        metrics: ["avg_commute", "congestion_index", "retail_revenue", "grocery_access", "productivity_loss", "unemployment_rate"],
        branches: [{ id: "closure", name: "Bridge closed 180d", deltas: [{ type: "close_road", edgeId: "r1", startDay: 8, days: 180 }] }],
        assumptionsNotes: ["Traffic reassigns by congested shortest path (BPR α=0.15, exp 4).", "Employers adjust shift schedules after ~1 week of sustained lateness, dampening productivity loss."],
      }),
    },
    {
      id: "demo_outage", title: "Demo 3 · Regional power outage",
      blurb: "A 3-day outage at the South Substation: closures, spoilage, service strain, recovery bump.",
      build: () => SC.newSpec({
        name: "South Substation outage — 3 days", horizonDays: 40, headlineMetric: "retail_revenue",
        objective: "Simulate a 3-day power outage across Harbor Point, Old Row, Eastgate and Westside Industrial. Measure business losses, access to groceries and care, and the shape of recovery.",
        metrics: ["retail_revenue", "grocery_access", "clinic_wait", "external_leakage", "closures_cum"],
        branches: [{ id: "outage3", name: "3-day South outage", deltas: [{ type: "outage", subId: "sub_south", startDay: 8, days: 3 }] }],
        assumptionsNotes: ["Facilities with backup power (hospital, Meridian plant, city ops) stay open at reduced capacity.", "Groceries lose 40% of a day's revenue per outage day to spoilage (assumption — review)."],
      }),
    },
    {
      id: "demo_workforce", title: "Demo 4 · Workforce reduction",
      blurb: "Meridian Assembly cuts 20% of staff: household income, spending, local business, second-order effects.",
      build: () => SC.newSpec({
        name: "Meridian Assembly — 20% workforce reduction", horizonDays: 180, headlineMetric: "unemployment_rate",
        objective: "The district's largest employer cuts 280 of 1,400 jobs. Trace effects through household income and spending into local business revenue, staffing, and possible closures.",
        metrics: ["unemployment_rate", "labor_income", "consumer_spend", "retail_revenue", "external_leakage", "closures_cum"],
        branches: [
          { id: "cut20", name: "20% reduction", deltas: [{ type: "layoff", orgId: "meridian", pct: 0.2, startDay: 8 }] },
          { id: "cut20_ubi", name: "20% cut + relief ($90/day benefit)", deltas: [{ type: "layoff", orgId: "meridian", pct: 0.2, startDay: 8 }, { type: "param", key: "unemp_benefit", value: 90, startDay: 1 }] },
        ],
        assumptionsNotes: ["Spending responds to income via MPC (0.95/0.85/0.70 by band).", "Unemployment benefit $64/day baseline; relief branch raises it to $90/day."],
      }),
    },
    {
      id: "demo_facility", title: "Demo 5 · Facility redesign",
      blurb: "Harbor Walk-in Clinic under a demand surge: staffing vs triage vs layout, measured in waits and lost visits.",
      build: () => SC.newSpec({
        name: "Clinic redesign under 20% demand surge", horizonDays: 60, headlineMetric: "clinic_wait",
        objective: "Healthcare demand rises 20% for two months. Compare three clinic configurations on average wait, abandoned visits, and utilization.",
        metrics: ["clinic_wait", "clinic_lost"],
        branches: [
          { id: "cfg_base", name: "Current — 3 providers", deltas: [{ type: "demand_shock", category: "healthcare", pct: 0.2, days: 55, startDay: 5 }] },
          { id: "cfg_staff", name: "Add 4th provider", deltas: [{ type: "demand_shock", category: "healthcare", pct: 0.2, days: 55, startDay: 5 }, { type: "facility_config", orgId: "clinic", config: { servers: 4 }, startDay: 5 }] },
          { id: "cfg_flow", name: "Triage + layout (3 providers)", deltas: [{ type: "demand_shock", category: "healthcare", pct: 0.2, days: 55, startDay: 5 }, { type: "facility_config", orgId: "clinic", config: { servers: 3, layoutEff: 0.85, triage: true }, startDay: 5 }] },
        ],
        assumptionsNotes: ["Queue model is Erlang-C (M/M/c); mean service 18 min; patients balk when expected wait exceeds 45 min.", "Layout redesign modeled as 15% service-time reduction; triage as a further 12% (assumptions — review)."],
      }),
    },
  ];

  // ---- run: branches × seeds → aggregated results ----------------------
  SC.run = async function (spec, onProgress) {
    if (!spec.reviewed) throw new Error("Scenario has not been reviewed. Confirm the assumption review before running.");
    const world = OBS.app.world;
    const branches = [{ id: "baseline", name: "Baseline (no intervention)", deltas: [] }, ...spec.branches];
    const seeds = Array.from({ length: spec.seeds }, (_, i) => i + 1);
    const results = { specId: spec.id, branches: {}, meta: null };
    let step = 0, total = branches.length * seeds.length;
    for (const br of branches) {
      const perSeed = [];
      let repRun = null;
      for (const seed of seeds) {
        const run = new OBS.Run(world, spec, br, seed);
        run.runAll(spec.horizonDays);
        perSeed.push(run);
        if (seed === 1) repRun = run;
        if (onProgress) { onProgress(++step / total, `${br.name} — seed ${seed}`); await new Promise((r) => setTimeout(r, 0)); }
      }
      const agg = {};
      for (const m of spec.metrics.concat([spec.headlineMetric])) {
        const seriesList = perSeed.map((r) => r.series[m]);
        agg[m] = { med: OBS.stat.bandOf(seriesList, 0.5), p10: OBS.stat.bandOf(seriesList, 0.1), p90: OBS.stat.bandOf(seriesList, 0.9) };
      }
      let watch = null;
      if (spec.watchOrg) {
        const list = perSeed.map((r) => r.orgSeries[spec.watchOrg] || []);
        if (list[0]?.length) {
          watch = { med: OBS.stat.bandOf(list, 0.5), p10: OBS.stat.bandOf(list, 0.1), p90: OBS.stat.bandOf(list, 0.9) };
          const o = repRun.state.orgs[spec.watchOrg];
          if (o) watch.dailyCost = o.staff * o.wage + o.fixedDaily + (OBS.world.COGS[o.sector] ?? 0.3) * OBS.stat.mean(watch.med.slice(-28));
        }
      }
      results.branches[br.id] = {
        id: br.id, name: br.name, agg, watch,
        fingerprints: perSeed.map((r) => r.fingerprint()),
        repRun: { events: repRun.events, series: repRun.series, orgSeries: repRun.orgSeries, edgeSeries: repRun.edgeSeries, snapshots: repRun.snapshots.map((s) => ({ day: s.day })), state: repRun.state, agents: repRun.agents },
        _snapshots: repRun.snapshots, // full checkpoints (memory only)
      };
    }
    results.divergence = SC.divergence(spec, results);
    results.meta = {
      engine: OBS.ENGINE, app: OBS.VERSION, world: world.id + "@" + world.version,
      specHash: OBS.hash(JSON.stringify({ ...spec, reviewed: 0, createdAt: 0, status: 0 })),
      seeds, params: Object.fromEntries(OBS.world.PARAMS.map((p) => [p.key, (spec.paramOverrides[p.key] ?? OBS.store.data.paramOverrides[p.key] ?? p.value)])),
      ranAt: new Date().toISOString(),
    };
    OBS.audit("scenario_run", `${spec.id} · ${branches.length} branches × ${seeds.length} seeds · hash ${results.meta.specHash}`);
    return results;
  };

  // ---- divergence vs baseline -----------------------------------------
  SC.divergence = function (spec, results) {
    const base = results.branches.baseline;
    const out = {};
    for (const [bid, br] of Object.entries(results.branches)) {
      if (bid === "baseline") continue;
      const m = spec.headlineMetric;
      const a = base.agg[m].med, b = br.agg[m].med;
      let firstDay = null, runLen = 0;
      for (let i = 0; i < b.length; i++) {
        const thr = Math.max(Math.abs(a[i] ?? 0) * 0.02, 1e-4);
        if (Math.abs((b[i] ?? 0) - (a[i] ?? 0)) > thr) { runLen++; if (runLen >= 3 && firstDay == null) firstDay = i - 1; }
        else runLen = 0;
      }
      const startDay = Math.min(...(spec.branches.find((x) => x.id === bid)?.deltas.map((d) => d.startDay ?? 1) || [1]));
      const baseLabels = new Set(base.repRun.events.map((e) => e.type + "|" + e.label));
      const unique = br.repRun.events.filter((e) => e.day >= startDay && !baseLabels.has(e.type + "|" + e.label)).slice(0, 8);
      out[bid] = { firstDay, firstEvents: unique.map((e) => ({ day: e.day, label: e.label, id: e.id })) };
    }
    return out;
  };

  // ---- causal chains ---------------------------------------------------
  SC.causalChains = function (repRun, maxRoots = 6) {
    const roots = repRun.events.filter((e) => !e.causeId && e.kids.length > 0);
    const byId = {}; for (const e of repRun.events) byId[e.id] = e;
    const build = (ev, depth) => ({
      id: ev.id, day: ev.day, type: ev.type, label: ev.label,
      children: depth >= 4 ? [] : ev.kids.slice(0, 8).map((k) => build(byId[k], depth + 1)).filter(Boolean),
    });
    const countDesc = (node) => 1 + node.children.reduce((s, c) => s + countDesc(c), 0);
    return roots.map((r) => build(r, 0)).map((t) => ({ tree: t, size: countDesc(t) }))
      .sort((x, y) => y.size - x.size).slice(0, maxRoots);
  };

  // ---- sensitivity (one-at-a-time ±20% tornado) ------------------------
  const SENS_PREF = {
    unemployment_rate: ["economy", "workforce", "demand"], labor_income: ["economy", "workforce", "demand"],
    consumer_spend: ["economy", "demand"], external_leakage: ["demand", "economy"],
    retail_revenue: ["demand", "economy", "traffic"], avg_commute: ["traffic", "workforce"],
    congestion_index: ["traffic"], grocery_access: ["traffic", "demand"],
    clinic_wait: ["facility", "demand"], clinic_lost: ["facility", "demand"],
    productivity_loss: ["workforce", "traffic"], closures_cum: ["demand", "economy", "resilience"],
  };
  SC.sensitivity = async function (spec, branchId, onProgress) {
    const world = OBS.app.world;
    const br = spec.branches.find((b) => b.id === branchId) || spec.branches[0];
    if (!br) return [];
    const m = spec.headlineMetric;
    const pref = SENS_PREF[m] || ["demand", "economy"];
    const rank = (tag) => { const i = pref.indexOf(tag); return i < 0 ? 99 : i; };
    // params that name a sector/category the scenario actually touches come first
    const terms = new Set(spec.branches.flatMap((b) => b.deltas.flatMap((d) => [d.sector, d.category].filter(Boolean))));
    const score = (key) => ([...terms].some((t2) => key.includes(t2)) ? 0 : 5);
    const rows = SC.assumptionRows(spec, world)
      .sort((a, b) => (rank(a.tag) * 10 + score(a.key)) - (rank(b.tag) * 10 + score(b.key)))
      .slice(0, 6);
    const outcome = (paramKey, mult) => {
      const s2 = OBS.clone(spec);
      if (paramKey) s2.paramOverrides[paramKey] = (s2.paramOverrides[paramKey] ?? OBS.store.data.paramOverrides[paramKey] ?? OBS.world.PARAMS.find((p) => p.key === paramKey).value) * mult;
      const run = new OBS.Run(world, s2, br, 1);
      run.runAll(spec.horizonDays);
      // for decisions about a specific new business, the decision variable is its revenue
      const series = spec.watchOrg && run.orgSeries[spec.watchOrg]?.length ? run.orgSeries[spec.watchOrg] : run.series[m];
      const tail = series.slice(-28).filter((v) => v != null);
      return OBS.stat.mean(tail);
    };
    const base = outcome(null, 1);
    const out = [];
    let i = 0;
    for (const r of rows) {
      const lo = outcome(r.key, 0.8), hi = outcome(r.key, 1.2);
      out.push({ key: r.key, label: r.label, base, lo, hi, range: Math.abs(hi - lo) });
      if (onProgress) { onProgress(++i / rows.length, r.label); await new Promise((x) => setTimeout(x, 0)); }
    }
    return out.sort((a, b) => b.range - a.range);
  };

  // ---- persistence -----------------------------------------------------
  SC.saveSpec = function (spec) {
    const d = OBS.store.data;
    const i = d.scenarios.findIndex((s) => s.id === spec.id);
    if (i >= 0) d.scenarios[i] = spec; else d.scenarios.push(spec);
    OBS.store.save();
  };
  SC.get = (id) => OBS.store.data.scenarios.find((s) => s.id === id);
})();
