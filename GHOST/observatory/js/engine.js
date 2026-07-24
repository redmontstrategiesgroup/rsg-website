/* NEXUS Observatory — simulation engine.
   A Run is fully reproducible from (world version, scenario spec, branch, seed, params).
   Every state change flows through events; events carry causeId → a causal DAG. */
(function () {
  const CATS = OBS.models.CATS;

  OBS.METRICS = [
    { id: "unemployment_rate", label: "Unemployment rate", unit: "%", better: "down", fmt: (v) => (v * 100).toFixed(1) + "%" },
    { id: "labor_income", label: "Household labor income", unit: "$/day", better: "up", fmt: (v) => OBS.fmt.money(v) },
    { id: "consumer_spend", label: "Local consumer spend", unit: "$/day", better: "up", fmt: (v) => OBS.fmt.money(v) },
    { id: "external_leakage", label: "Spending leakage (external)", unit: "$/day", better: "down", fmt: (v) => OBS.fmt.money(v) },
    { id: "retail_revenue", label: "Local business revenue", unit: "$/day", better: "up", fmt: (v) => OBS.fmt.money(v) },
    { id: "avg_commute", label: "Average commute", unit: "min", better: "down", fmt: (v) => v.toFixed(1) + " min" },
    { id: "congestion_index", label: "Congestion index (v/c)", unit: "", better: "down", fmt: (v) => v.toFixed(2) },
    { id: "grocery_access", label: "Grocery access time", unit: "min", better: "down", fmt: (v) => v.toFixed(1) + " min" },
    { id: "clinic_wait", label: "Clinic average wait", unit: "min", better: "down", fmt: (v) => v == null ? "closed" : v.toFixed(0) + " min" },
    { id: "clinic_lost", label: "Clinic lost visits", unit: "/day", better: "down", fmt: (v) => OBS.fmt.num(v) },
    { id: "productivity_loss", label: "Employer productivity loss", unit: "%", better: "down", fmt: (v) => (v * 100).toFixed(1) + "%" },
    { id: "closures_cum", label: "Business closures (cumulative)", unit: "", better: "down", fmt: (v) => OBS.fmt.num(v) },
  ];
  OBS.metricDef = (id) => OBS.METRICS.find((m) => m.id === id);

  OBS.Run = class {
    constructor(world, spec, branch, seed) {
      this.world = world;
      this.spec = spec;
      this.branch = branch; // {id, name, deltas}
      this.seed = seed;
      this.rng = new OBS.Rng(OBS.hash(spec.id + "|" + branch.id) ^ seed);
      this.state = spec.initState ? OBS.clone(spec.initState) : OBS.world.mutableState(world);
      this.paramLocal = { ...(spec.paramOverrides || {}) };
      this.day = 0;
      this.events = [];
      this.evById = {};
      this.evSeq = 0;
      this.series = {};              // metricId -> number[]
      this.orgSeries = {};           // oid -> revenue[]
      this.edgeSeries = {};          // rid -> v/c[]
      this.snapshots = [];
      this.skimsCache = null;
      this.skimsDirty = true;
      this.schedule = this.expand(branch.deltas || []);
      this.agents = world.graph.byType("agent").map((a) => ({ id: a.id, cohort: a.attrs.cohort, stress: a.attrs.stress, memories: [] }));
      for (const m of OBS.METRICS) this.series[m.id] = [];
    }

    P(key) { return this.paramLocal[key] != null ? this.paramLocal[key] : OBS.world.param(null, key); }
    nameOf(id) { return this.world.graph.get(id)?.name || this.state.orgs[id]?.name || id; }

    emit(type, label, data = {}, causeId = null) {
      const id = "e" + (++this.evSeq);
      const ev = { id, day: this.day, type, label, data, causeId, kids: [] };
      this.events.push(ev); this.evById[id] = ev;
      if (causeId && this.evById[causeId]) this.evById[causeId].kids.push(id);
      return id;
    }

    rec(metricId, v) { this.series[metricId].push(v == null ? null : OBS.round(v, 4)); }

    // expand deltas into a per-day schedule (start + end actions)
    expand(deltas) {
      const sched = [];
      deltas.forEach((d, i) => {
        sched.push({ day: d.startDay ?? 1, action: "start", delta: d, idx: i });
        if (d.days) sched.push({ day: (d.startDay ?? 1) + d.days, action: "end", delta: d, idx: i });
      });
      return sched.sort((a, b) => a.day - b.day || a.idx - b.idx);
    }

    // ---- scenario deltas ------------------------------------------------
    applyDelta(item) {
      const d = item.delta, S = this.state;
      const g = this.world.graph;
      if (item.action === "end") {
        if (d.type === "close_road") {
          delete S.closedRoads[d.edgeId]; this.skimsDirty = true;
          this.emit("road_reopened", `${this.nameOf(d.edgeId)} reopened`, { edgeId: d.edgeId }, S.trafficEventId);
        }
        return;
      }
      switch (d.type) {
        case "close_road": {
          S.closedRoads[d.edgeId] = 1; this.skimsDirty = true;
          S.trafficEventId = this.emit("road_closed", `${this.nameOf(d.edgeId)} closed for ${d.days ?? "?"} days`, d, null);
          S.lastMajorCause = S.trafficEventId;
          break;
        }
        case "outage": {
          const subs = d.subId === "all" ? ["sub_north", "sub_south"] : [d.subId];
          S.outageEventId = this.emit("power_outage", `Power outage: ${subs.map((s) => this.nameOf(s)).join(", ")} down ${d.days} days`, d, null);
          for (const s of subs) S.outages[s] = d.days;
          S.lastMajorCause = S.outageEventId;
          break;
        }
        case "layoff": {
          const o = S.orgs[d.orgId];
          const count = d.count ?? Math.round(o.jobs * (d.pct || 0));
          const ev = this.emit("workforce_reduction", `${this.nameOf(d.orgId)} reduces workforce by ${count}`, { ...d, count }, null);
          S.lastMajorCause = ev;
          const done = OBS.models.applyLayoff(this, d.orgId, count, ev);
          S.orgs[d.orgId].memoryLog.push({ day: this.day, kind: "workforce", text: `Reduced workforce by ${done}` });
          this.skimsDirty = true;
          break;
        }
        case "open_business": {
          const oid = d.orgId || `new_${d.sector}_${++S.newOrgSeq}`;
          S.orgs[oid] = {
            name: d.name || `New ${d.sector} (${this.nameOf(d.nb)})`, sector: d.sector, nb: d.nb,
            jobs: d.staff ?? 10, staff: d.staff ?? 10, wage: d.wage ?? 130,
            priceLevel: d.priceLevel ?? 1.15, quality: d.quality ?? 0.7,
            capacityDaily: d.capacityDaily ?? 500, fixedDaily: d.fixedDaily ?? Math.round((d.capacityDaily ?? 500) * 1.4),
            backupPower: false, open: true, cash: d.startingCash ?? 20000, revenue7: [], memoryLog: [],
            facility: null, isNew: true,
          };
          const ev = this.emit("business_opened", `${S.orgs[oid].name} opens in ${this.nameOf(d.nb)}`, { ...d, oid }, null);
          S.lastMajorCause = ev;
          // staff hired from the unemployed pool
          const o = S.orgs[oid]; o.jobs = 0;
          OBS.models.hire(this, oid, d.staff ?? 10, ev);
          this.skimsDirty = true;
          break;
        }
        case "price_change": {
          const targets = d.orgId ? [d.orgId] : Object.keys(S.orgs).filter((k) => S.orgs[k].sector === d.sector);
          const ev = this.emit("price_change", `Prices ${d.pct > 0 ? "+" : ""}${Math.round(d.pct * 100)}% at ${targets.map((t) => this.nameOf(t)).join(", ")}`, d, null);
          S.lastMajorCause = ev;
          for (const t of targets) S.orgs[t].priceLevel = OBS.round(S.orgs[t].priceLevel * (1 + d.pct), 3);
          break;
        }
        case "facility_config": {
          const o = S.orgs[d.orgId || "clinic"];
          if (o?.facility) {
            Object.assign(o.facility, d.config);
            this.emit("facility_reconfigured", `${this.nameOf(d.orgId || "clinic")} reconfigured: ${JSON.stringify(d.config)}`, d, null);
          }
          break;
        }
        case "add_housing": {
          const cid = `c_${d.nb}_mid`;
          const c = S.cohorts[cid];
          const ev = this.emit("housing_added", `${d.units} housing units added in ${this.nameOf(d.nb)}`, d, null);
          S.lastMajorCause = ev;
          c.households += d.units; c.persons += Math.round(d.units * 2.4);
          const newWorkers = Math.round(d.units * 1.1);
          c.workers += newWorkers; c.unemployed += newWorkers;
          c.incomeBase = 0; // re-baseline income response for the grown cohort
          this.skimsDirty = true;
          break;
        }
        case "demand_shock": {
          S.demandShocks = S.demandShocks || {}; S.demandShockDays = S.demandShockDays || {};
          S.demandShocks[d.category] = d.pct; S.demandShockDays[d.category] = d.days ?? 30;
          this.emit("demand_shock", `Demand shock: ${d.category} ${d.pct > 0 ? "+" : ""}${Math.round(d.pct * 100)}% for ${d.days ?? 30} days`, d, null);
          break;
        }
        case "param": {
          this.paramLocal[d.key] = d.value;
          this.emit("assumption_changed", `Parameter ${d.key} → ${d.value}`, d, null);
          break;
        }
      }
    }

    // ---- daily pipeline -------------------------------------------------
    dayStep() {
      this.day++;
      const S = this.state;
      // 1. scheduled scenario deltas
      for (const item of this.schedule) if (item.day === this.day) this.applyDelta(item);
      // 2. infrastructure
      OBS.models.applyInfrastructure(this);
      // 3. traffic skims (recompute when network/labor changed, else weekly refresh)
      if (this.skimsDirty || this.day % 7 === 1 || !this.skimsCache) {
        this.skimsCache = OBS.models.skims(this);
        if (this.skimsDirty && S.trafficEventId && this.day > 1) {
          // describe the reroute consequences once
          for (const [rid, e] of Object.entries(this.skimsCache.edges)) {
            const prev = this.prevEdges?.[rid];
            if (prev && e.open && e.vc > prev.vc * 1.3 && e.vc > 0.5) {
              this.emit("traffic_shifted", `Traffic shifted onto ${this.nameOf(rid)} (v/c ${prev.vc.toFixed(2)} → ${e.vc.toFixed(2)})`, { rid, from: prev.vc, to: e.vc }, S.trafficEventId);
            }
          }
        }
        this.prevEdges = this.skimsCache.edges;
        this.skimsDirty = false;
      }
      const skims = this.skimsCache;
      // 4. lateness / workforce behavior
      OBS.models.latenessDay(this, skims);
      // 5. income & spending power
      const inc = OBS.models.incomeDay(this);
      // 6. demand & business P&L
      const dem = OBS.models.demandDay(this, skims);
      let retailRev = 0, prodLossW = 0, prodLossN = 0;
      for (const [oid, o] of Object.entries(S.orgs)) {
        if (CATS.includes(o.sector)) {
          const rev = o.open ? (dem.orgRevenue[oid] || 0) : 0;
          const cogs = (OBS.world.COGS[o.sector] ?? 0.4) * rev;
          o.cash += rev - cogs - o.staff * o.wage - (o.open ? o.fixedDaily : o.fixedDaily * 0.6);
          o.revenue7.push(rev); if (o.revenue7.length > 7) o.revenue7.shift();
          (this.orgSeries[oid] = this.orgSeries[oid] || []).push(OBS.round(rev));
          retailRev += rev;
          o.customersToday = dem.orgCustomers[oid] || 0;
          if (o.reopenBumpDays > 0) o.reopenBumpDays--;
        }
        if (o.productivityLoss) { prodLossW += o.productivityLoss * o.staff; prodLossN += o.staff; }
      }
      // 7. weekly org decisions
      if (this.day % 7 === 0) this.orgDecisions(dem);
      // 8. facility
      const clinicRes = S.orgs.clinic ? OBS.models.facilityDay(this, "clinic", (dem.orgCustomers.clinic || 0) + 40) : { waitMin: null, lost: 0 };
      if (clinicRes.waitMin > 60 && !S.clinicStrained) {
        S.clinicStrained = true;
        this.emit("service_strain", `Harbor Walk-in Clinic average waits exceed 60 min`, { wait: OBS.round(clinicRes.waitMin) }, S.lastMajorCause);
      }
      // 9. synthetic agent memories (samples only — aggregate behavior lives in cohorts)
      this.agentMemories();
      // 10. metrics
      this.rec("unemployment_rate", inc.unemploymentRate);
      this.rec("labor_income", inc.totalIncome);
      this.rec("consumer_spend", dem.totalSpend - dem.leakage);
      this.rec("external_leakage", dem.leakage);
      this.rec("retail_revenue", retailRev);
      this.rec("avg_commute", skims.avgCommute);
      this.rec("congestion_index", skims.congestionIndex);
      this.rec("grocery_access", this.groceryAccess(skims));
      this.rec("clinic_wait", clinicRes.waitMin);
      this.rec("clinic_lost", clinicRes.lost);
      this.rec("productivity_loss", prodLossN ? prodLossW / prodLossN : 0);
      this.rec("closures_cum", Object.values(S.orgs).filter((o) => o.failed).length);
      for (const [rid, e] of Object.entries(skims.edges)) (this.edgeSeries[rid] = this.edgeSeries[rid] || []).push(e.open ? e.vc : null);
      // 11. checkpoints
      if (this.day === 1 || this.day % 14 === 0) {
        this.snapshots.push({ day: this.day, state: OBS.clone(S), rngS: this.rng.s });
        if (this.snapshots.length > 16) this.snapshots.splice(1, 1);
      }
    }

    orgDecisions(dem) {
      const S = this.state;
      for (const oid of Object.keys(S.orgs).sort()) {
        const o = S.orgs[oid];
        if (!CATS.includes(o.sector) || o.failed) continue;
        const avg7 = OBS.stat.mean(o.revenue7);
        const margin = avg7 - (OBS.world.COGS[o.sector] ?? 0.4) * avg7 - o.staff * o.wage - o.fixedDaily;
        const ticket = OBS.world.TICKET[o.sector] || 30;
        const util = o.capacityDaily ? (avg7 / ticket) / o.capacityDaily : 0;
        // revenue-shift narration (weekly, with measured channel)
        const prev = o.prevAvg7;
        if (prev != null && prev > 50 && Math.abs(avg7 - prev) / prev > 0.12) {
          const dir = avg7 > prev ? "rose" : "fell";
          this.emit("revenue_shift", `${this.nameOf(oid)} weekly revenue ${dir} ${Math.round(Math.abs(avg7 - prev) / prev * 100)}% (${OBS.fmt.money(prev)}→${OBS.fmt.money(avg7)}/day)`, { oid, prev: OBS.round(prev), now: OBS.round(avg7) }, S.lastMajorCause);
        }
        o.prevAvg7 = avg7;
        // distress → staffing cuts → closure
        if (margin < -0.15 * (o.fixedDaily + 1)) o.badWeeks = (o.badWeeks || 0) + 1; else o.badWeeks = 0;
        if (o.badWeeks >= 2 && o.staff > 4) {
          const cut = Math.max(1, Math.round(o.staff * 0.12));
          const ev = this.emit("staff_reduction", `${this.nameOf(oid)} cut ${cut} staff after ${o.badWeeks} weeks of losses`, { oid, cut }, S.lastMajorCause);
          OBS.models.applyLayoff(this, oid, cut, ev);
          o.quality = Math.max(0.3, o.quality - 0.04);
          o.staffShort = o.staff < (this.world.graph.get(oid)?.attrs.jobs ?? o.staff) * 0.75;
          o.memoryLog.push({ day: this.day, kind: "workforce", text: `Cut ${cut} staff; service quality reduced` });
        }
        if (o.cash < -14 * (o.fixedDaily + 1) && !o.isNew) {
          o.failed = true; o.open = false;
          const ev = this.emit("business_failed", `${this.nameOf(oid)} closed permanently (insolvent)`, { oid }, S.lastMajorCause);
          OBS.models.applyLayoff(this, oid, o.staff, ev);
          o.memoryLog.push({ day: this.day, kind: "incident", text: "Closed permanently — insolvency" });
        }
        if (this.day > 14 && util > 0.92 && margin > 0.1 * (o.fixedDaily + 1) && o.staff < o.capacityDaily / 8) {
          const n = Math.max(1, Math.round(o.staff * 0.06));
          const ev = this.emit("expansion_hiring", `${this.nameOf(oid)} hiring ${n} (utilization ${(util * 100).toFixed(0)}%)`, { oid, n }, S.lastMajorCause);
          OBS.models.hire(this, oid, n, ev);
        }
      }
    }

    groceryAccess(skims) {
      let sum = 0, w = 0;
      for (const c of Object.values(this.state.cohorts)) {
        let best = 999;
        for (const [oid, o] of Object.entries(this.state.orgs)) {
          if (o.sector !== "grocery" || !o.open) continue;
          best = Math.min(best, skims.tt[c.nb][o.nb]);
        }
        sum += best * c.households; w += c.households;
      }
      return w ? sum / w : 0;
    }

    agentMemories() {
      const todays = this.events.filter((e) => e.day === this.day);
      if (!todays.length) return;
      for (const ev of todays) {
        const cid = ev.data?.cid;
        for (const a of this.agents) {
          let epistemic = null;
          if (cid && a.cohort === cid) epistemic = "experienced";
          else if (["power_outage", "road_closed", "business_failed", "workforce_reduction"].includes(ev.type) && this.rng.next() < 0.35) epistemic = "reported";
          if (!epistemic) continue;
          a.memories.push({ day: this.day, epistemic, text: ev.label, ev: ev.id, weight: epistemic === "experienced" ? 1 : 0.5 });
          if (epistemic === "experienced") a.stress = OBS.clamp(a.stress + 0.15, 0, 1);
          if (a.memories.length > 20) {
            a.memories.sort((x, y) => (x.weight * (1 - (this.day - x.day) / 200)) - (y.weight * (1 - (this.day - y.day) / 200)));
            a.memories.splice(0, a.memories.length - 20);
            a.memories.sort((x, y) => x.day - y.day);
          }
        }
      }
      // memory decay: stress relaxes, old memory weights fade (configurable rule)
      if (this.day % 7 === 0) for (const a of this.agents) { a.stress = OBS.clamp(a.stress * 0.93, 0, 1); for (const m of a.memories) m.weight *= 0.98; }
    }

    runAll(horizon) {
      for (let i = 0; i < horizon; i++) this.dayStep();
      return this;
    }

    fingerprint() {
      // reproducibility hash over all metric series
      let h = 0;
      for (const m of OBS.METRICS) for (const v of this.series[m.id]) h = (Math.imul(h, 31) + Math.round((v ?? -1) * 1000)) | 0;
      return h;
    }
  };
})();
