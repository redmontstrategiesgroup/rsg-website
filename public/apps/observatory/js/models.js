/* NEXUS Observatory — analytical models.
   Named methodologies, deliberately standard:
   - Traffic: shortest-path assignment + BPR volume-delay (Bureau of Public Roads)
   - Retail/service demand: Huff gravity model with price elasticity
   - Household spending: marginal-propensity-to-consume income response
   - Facility queues: Erlang-C (M/M/c) with balking
   Each function takes a `run` context: {world, state, rng, P(key), emit(...), day} */
(function () {
  const M = (OBS.models = {});
  const CATS = ["grocery", "dining", "retail", "services", "fitness", "healthcare"];
  M.CATS = CATS;

  // ---- traffic ---------------------------------------------------------
  M.roadOpen = (run, rid) => !run.state.closedRoads[rid];

  M.networkNodes = function (run) {
    return [...run.world.graph.byType("neighborhood").map((n) => n.id), "ext"];
  };

  function adjacency(run, timeOf) {
    const adj = {};
    for (const r of run.world.graph.byType("road")) {
      if (!M.roadOpen(run, r.id)) continue;
      const t = timeOf(r);
      (adj[r.attrs.a] = adj[r.attrs.a] || []).push({ to: r.attrs.b, t, rid: r.id });
      (adj[r.attrs.b] = adj[r.attrs.b] || []).push({ to: r.attrs.a, t, rid: r.id });
    }
    return adj;
  }

  function dijkstra(adj, from, nodes) {
    const dist = {}, prevEdge = {};
    for (const n of nodes) dist[n] = Infinity;
    dist[from] = 0;
    const visited = new Set();
    while (visited.size < nodes.length) {
      let u = null, best = Infinity;
      for (const n of nodes) if (!visited.has(n) && dist[n] < best) { best = dist[n]; u = n; }
      if (u == null) break;
      visited.add(u);
      for (const e of adj[u] || []) {
        if (dist[u] + e.t < dist[e.to]) { dist[e.to] = dist[u] + e.t; prevEdge[e.to] = { from: u, rid: e.rid }; }
      }
    }
    return { dist, prevEdge };
  }

  function pathEdges(prevEdge, from, to) {
    const out = [];
    let cur = to;
    let guard = 0;
    while (cur !== from && prevEdge[cur] && guard++ < 50) { out.push(prevEdge[cur].rid); cur = prevEdge[cur].from; }
    return out;
  }

  // commuter flows: cohort → employer neighborhood (veh in AM peak)
  M.flows = function (run) {
    const g = run.world.graph;
    const out = [];
    for (const [cid, c] of Object.entries(run.state.cohorts)) {
      for (const [oid, workers] of Object.entries(c.employment)) {
        const dest = oid === "ext" ? "ext" : run.state.orgs[oid]?.nb;
        if (!dest || dest === c.nb || workers <= 0) continue;
        const veh = (workers * c.carShare) / run.P("car_occupancy");
        out.push({ cid, oid, from: c.nb, to: dest, veh });
      }
    }
    return out.sort((a, b) => (a.cid + a.oid).localeCompare(b.cid + b.oid)); // deterministic order
  };

  // two-pass assignment → skim matrix + edge loads
  M.skims = function (run) {
    const nodes = M.networkNodes(run);
    const flows = M.flows(run);
    const alpha = run.P("bpr_alpha"), bexp = run.P("bpr_beta"), spread = run.P("peak_spread_hr");
    const loads = {};
    const bpr = (r) => {
      const v = (loads[r.id] || 0) / spread; // veh/hr in peak
      const vc = v / r.attrs.capacityHr;
      return Math.min(r.attrs.baseMin * (1 + alpha * Math.pow(vc, bexp)), r.attrs.baseMin * 4);
    };
    // pass 1: free-flow assignment
    let adj = adjacency(run, (r) => r.attrs.baseMin);
    const sp1 = {};
    for (const n of nodes) sp1[n] = dijkstra(adj, n, nodes);
    for (const f of flows) for (const rid of pathEdges(sp1[f.from].prevEdge, f.from, f.to)) loads[rid] = (loads[rid] || 0) + f.veh;
    // pass 2: congested reassignment
    adj = adjacency(run, bpr);
    const sp2 = {};
    for (const n of nodes) sp2[n] = dijkstra(adj, n, nodes);
    for (const rid of Object.keys(loads)) loads[rid] = 0;
    for (const f of flows) for (const rid of pathEdges(sp2[f.from].prevEdge, f.from, f.to)) loads[rid] = (loads[rid] || 0) + f.veh;
    // final metrics
    adj = adjacency(run, bpr);
    const sp3 = {};
    for (const n of nodes) sp3[n] = dijkstra(adj, n, nodes);
    const tt = {};
    for (const a of nodes) { tt[a] = {}; for (const b of nodes) tt[a][b] = a === b ? 2.5 : (sp3[a].dist[b] === Infinity ? 999 : sp3[a].dist[b]); }
    const edges = {};
    let vcSum = 0, vcW = 0;
    for (const r of run.world.graph.byType("road")) {
      const open = M.roadOpen(run, r.id);
      const veh = loads[r.id] || 0;
      const vc = open ? (veh / spread) / r.attrs.capacityHr : 0;
      edges[r.id] = { veh: Math.round(veh), vc: OBS.round(vc, 3), time: open ? OBS.round(bpr(r), 1) : null, open };
      if (open) { vcSum += vc * veh; vcW += veh; }
    }
    // commute per flow (weighted average per cohort)
    let commuteSum = 0, commuteW = 0;
    const cohortCommute = {};
    for (const f of flows) {
      const t = tt[f.from][f.to];
      commuteSum += t * f.veh; commuteW += f.veh;
      const cc = (cohortCommute[f.cid] = cohortCommute[f.cid] || {});
      cc[f.oid] = t;
    }
    return { tt, edges, cohortCommute, avgCommute: commuteW ? commuteSum / commuteW : 0, congestionIndex: vcW ? vcSum / vcW : 0 };
  };

  // ---- power / outages -------------------------------------------------
  M.applyInfrastructure = function (run) {
    // orgs open/closed derives from outage state + business closures
    for (const [oid, o] of Object.entries(run.state.orgs)) {
      if (o.failed) { o.open = false; continue; }
      const sub = (run.world.graph.out(oid, "powered_by")[0] || run.world.graph.out(o.nb, "powered_by")[0])?.to;
      const outed = sub && run.state.outages[sub] > 0;
      const wasOpen = o.open;
      o.open = !(outed && !o.backupPower);
      o.powerConstrained = outed && o.backupPower; // running on backup
      if (wasOpen && !o.open) {
        const ev = run.emit("org_closed_outage", `${run.world.graph.get(oid).name} closed — no power (${sub})`, { oid, sub }, run.state.outageEventId);
        o.memoryLog.push({ day: run.day, kind: "incident", text: `Closed by power outage (${sub})`, ev });
        if (o.sector === "grocery") {
          const spoil = OBS.round((OBS.stat.mean(o.revenue7) || o.capacityDaily * 8) * run.P("spoilage_share"));
          o.cash -= spoil;
          run.emit("spoilage_loss", `${run.world.graph.get(oid).name} lost ${OBS.fmt.money(spoil)} to spoilage`, { oid, spoil }, ev);
        }
      }
      if (!wasOpen && o.open && !o.failed) {
        o.reopenBumpDays = 3;
        run.emit("org_reopened", `${run.world.graph.get(oid).name} reopened after outage`, { oid }, run.state.outageEventId);
      }
    }
    for (const sub of Object.keys(run.state.outages)) {
      if (run.state.outages[sub] > 0) run.state.outages[sub]--;
    }
  };

  // ---- demand (Huff) ---------------------------------------------------
  M.demandDay = function (run, skims) {
    const g = run.world.graph;
    const noiseMag = run.P("demand_noise");
    const results = { orgRevenue: {}, orgCustomers: {}, channels: {}, leakage: 0, totalSpend: 0 };
    const orgsByCat = {};
    for (const [oid, o] of Object.entries(run.state.orgs)) {
      if (CATS.includes(o.sector)) (orgsByCat[o.sector] = orgsByCat[o.sector] || []).push(oid);
    }
    for (const cat of CATS) {
      const beta = run.P("beta_" + cat) || 0.07;
      const elast = run.P("elast_" + cat) || 1.2;
      const catNoise = run.rng.noise(noiseMag);
      const shock = run.state.demandShocks?.[cat] || 0;
      for (const [cid, c] of Object.entries(run.state.cohorts)) {
        const spend = OBS.world.SPEND[c.band];
        let budget = c.households * spend.total * (spend.shares[cat] || 0) * c.spendScale * catNoise * (1 + shock);
        if (budget <= 0) continue;
        results.totalSpend += budget;
        // attraction of each open venue
        const cands = (orgsByCat[cat] || []).filter((oid) => run.state.orgs[oid].open).map((oid) => {
          const o = run.state.orgs[oid];
          const ttm = skims.tt[c.nb][o.nb] ?? 999;
          const priceTerm = Math.pow(o.priceLevel, -elast);
          // attraction: sub-linear size term (large venues don't dominate linearly),
          // quality squared (differentiation), price elasticity, travel decay
          const rep = Math.pow(0.4 + o.quality * (1 - (o.repPenalty || 0)), 2);
          const bump = o.reopenBumpDays > 0 ? 1 + run.P("reopen_bump") : 1;
          const A = Math.pow(Math.max(1, o.capacityDaily), 0.6) * rep * priceTerm * bump * Math.exp(-beta * ttm);
          return { oid, A, ttm };
        });
        const totA = cands.reduce((s, x) => s + x.A, 0);
        if (totA <= 0) { results.leakage += budget; continue; }
        // an increasingly inaccessible/closed category leaks demand to the external market
        const bestTT = Math.min(...cands.map((x) => x.ttm));
        const leakShare = OBS.clamp(0.06 + 0.012 * Math.max(0, bestTT - 8), 0.06, 0.55);
        results.leakage += budget * leakShare;
        budget *= (1 - leakShare);
        for (const { oid, A, ttm } of cands) {
          const rev = budget * (A / totA);
          results.orgRevenue[oid] = (results.orgRevenue[oid] || 0) + rev;
          const ch = (results.channels[oid] = results.channels[oid] || { access: 0, w: 0 });
          ch.access += ttm * rev; ch.w += rev;
        }
      }
    }
    // capacity constraint: overflow is partially lost, partially redistributed within category
    for (const [oid, o] of Object.entries(run.state.orgs)) {
      let rev = results.orgRevenue[oid] || 0;
      if (!rev) { results.orgCustomers[oid] = 0; continue; }
      const ticket = OBS.world.TICKET[o.sector] || 30;
      // revenue ceiling: customer capacity × per-customer spend (scales with price point)
      const cap = o.capacityDaily * ticket * o.priceLevel * (o.powerConstrained ? 0.85 : 1) * (o.staffShort ? 0.9 : 1);
      if (cap > 0 && rev > cap) {
        const overflow = rev - cap;
        rev = cap;
        const peers = Object.keys(results.orgRevenue).filter((p) => p !== oid && run.state.orgs[p].sector === o.sector && run.state.orgs[p].open);
        for (const p of peers) results.orgRevenue[p] += (overflow * 0.6) / peers.length;
        results.leakage += overflow * 0.4;
      }
      results.orgRevenue[oid] = rev;
      results.orgCustomers[oid] = Math.round(rev / ticket);
    }
    if (run.state.demandShockDays) {
      for (const cat of Object.keys(run.state.demandShocks || {})) {
        if (--run.state.demandShockDays[cat] <= 0) delete run.state.demandShocks[cat];
      }
    }
    return results;
  };

  // ---- labor & income --------------------------------------------------
  M.applyLayoff = function (run, oid, count, causeId) {
    const o = run.state.orgs[oid];
    if (!o) return 0;
    const cohorts = Object.entries(run.state.cohorts).filter(([, c]) => (c.employment[oid] || 0) > 0)
      .sort((a, b) => a[0].localeCompare(b[0]));
    const total = cohorts.reduce((s, [, c]) => s + c.employment[oid], 0);
    let cut = Math.min(count, total), done = 0;
    for (const [cid, c] of cohorts) {
      const share = Math.round((c.employment[oid] / total) * cut);
      const n = Math.min(share, c.employment[oid]);
      if (n <= 0) continue;
      c.employment[oid] -= n; c.unemployed += n; done += n;
      if (n >= 5) run.emit("jobs_lost", `${n} workers in ${run.world.graph.get(cid).name} lost jobs at ${run.nameOf(oid)}`, { cid, oid, n }, causeId);
    }
    // remainder (rounding) from largest cohort
    if (done < cut && cohorts.length) {
      const [cid, c] = cohorts.sort((a, b) => (b[1].employment[oid] || 0) - (a[1].employment[oid] || 0))[0];
      const n = Math.min(cut - done, c.employment[oid]);
      c.employment[oid] -= n; c.unemployed += n; done += n;
    }
    o.jobs -= done; o.staff = o.jobs;
    return done;
  };

  M.hire = function (run, oid, count, causeId) {
    const o = run.state.orgs[oid];
    const pool = Object.entries(run.state.cohorts).filter(([, c]) => c.unemployed > 0)
      .sort((a, b) => b[1].unemployed - a[1].unemployed);
    let hired = 0;
    for (const [cid, c] of pool) {
      if (hired >= count) break;
      const n = Math.min(count - hired, c.unemployed, Math.max(1, Math.round(count * 0.5)));
      c.unemployed -= n; c.employment[oid] = (c.employment[oid] || 0) + n; hired += n;
    }
    if (hired > 0) {
      o.jobs += hired; o.staff = o.jobs;
      run.emit("jobs_added", `${run.nameOf(oid)} hired ${hired} workers`, { oid, n: hired }, causeId);
    }
    return hired;
  };

  M.incomeDay = function (run) {
    const benefit = run.P("unemp_benefit");
    let totalIncome = 0, unemployed = 0, workers = 0;
    for (const [cid, c] of Object.entries(run.state.cohorts)) {
      let inc = c.unemployed * benefit;
      for (const [oid, n] of Object.entries(c.employment)) {
        inc += n * (oid === "ext" ? 180 : (run.state.orgs[oid]?.open === false ? run.state.orgs[oid].wage * 0.55 : run.state.orgs[oid]?.wage ?? 0));
      }
      c.income = inc;
      if (!c.incomeBase) c.incomeBase = inc;
      const mpc = run.P("mpc_" + c.band);
      c.spendScale = OBS.clamp(1 + mpc * (inc / c.incomeBase - 1), 0.3, 1.6);
      totalIncome += inc; unemployed += c.unemployed;
      workers += c.unemployed + Object.values(c.employment).reduce((s, n) => s + n, 0);
    }
    return { totalIncome, unemployed, workers, unemploymentRate: workers ? unemployed / workers : 0 };
  };

  // lateness: added commute vs day-0 baseline → productivity/behavior chain
  M.latenessDay = function (run, skims) {
    const thr = run.P("lateness_threshold");
    const out = { affected: 0, events: [] };
    for (const [cid, c] of Object.entries(run.state.cohorts)) {
      for (const [oid] of Object.entries(c.employment)) {
        if (oid === "ext") continue;
        const now = skims.cohortCommute[cid]?.[oid];
        const base = c.commuteBase[cid + oid];
        if (now == null) continue;
        if (base == null) { c.commuteBase[cid + oid] = now; continue; }
        const delta = now - base;
        const key = cid + oid;
        if (delta > thr) {
          c.latenessDays[key] = (c.latenessDays[key] || 0) + 1;
          out.affected += c.employment[oid];
          const o = run.state.orgs[oid];
          if (c.latenessDays[key] === 3) {
            const ev = run.emit("lateness_pattern", `Repeated late arrivals at ${run.world.graph.get(oid).name} (commutes +${OBS.round(delta)} min from ${run.world.graph.get(cid).name})`, { cid, oid, delta: OBS.round(delta, 1) }, run.state.trafficEventId);
            out.events.push(ev);
          }
          if (c.latenessDays[key] === 7 && !o.shiftAdjusted) {
            o.shiftAdjusted = true;
            o.memoryLog.push({ day: run.day, kind: "operational", text: "Adjusted shift start times in response to sustained commute delays" });
            run.emit("employer_response", `${run.world.graph.get(oid).name} adjusted shift schedules to absorb commute delays`, { oid }, run.state.trafficEventId);
          }
          o.productivityLoss = OBS.clamp((o.productivityLoss || 0) * 0.7 + OBS.clamp(delta / 120, 0, 0.2) * (o.shiftAdjusted ? 0.4 : 1), 0, 0.25);
        } else {
          c.latenessDays[key] = 0;
        }
      }
    }
    return out;
  };

  // ---- facility queue (Erlang-C, M/M/c) --------------------------------
  M.erlangC = function (lambdaHr, servers, serviceMin) {
    const mu = 60 / serviceMin;              // service rate per server per hour
    const a = lambdaHr / mu;                 // offered load (erlangs)
    const c = Math.max(1, Math.round(servers));
    const rhoRaw = a / c;
    const rho = Math.min(rhoRaw, 0.98);
    const aEff = rho * c;
    let sum = 0, term = 1;
    for (let k = 0; k < c; k++) { if (k > 0) term *= aEff / k; sum += term; }
    const termC = term * (aEff / c);
    const pWait = termC / ((1 - rho) * sum + termC);
    const wq = (pWait / (c * mu - aEff)) * 60; // minutes
    return { waitMin: Math.max(0, wq), util: rhoRaw, pWait, overload: Math.max(0, rhoRaw - 0.98) };
  };

  M.facilityDay = function (run, oid, dailyVisits) {
    const o = run.state.orgs[oid];
    const f = o.facility;
    if (!f || !o.open) return { waitMin: null, util: null, lost: o.open ? 0 : dailyVisits, served: 0 };
    const profile = [0.7, 1.2, 1.3, 1.1, 1.0, 1.0, 1.1, 1.2, 0.8, 0.6]; // 10-hour day
    const serviceMin = run.P("clinic_service_min") * f.layoutEff * (f.triage ? 0.88 : 1);
    const balkAt = run.P("clinic_balk_min");
    let waitSum = 0, lost = 0, served = 0, utilSum = 0;
    const perHour = dailyVisits / profile.reduce((s, x) => s + x, 0);
    const capHr = f.servers * (60 / serviceMin); // service capacity, patients/hr
    for (const p of profile) {
      const lam = perHour * p * run.rng.noise(0.08);
      const q = M.erlangC(lam, f.servers, serviceMin);
      if (q.util >= 0.98) {
        // saturated hour: throughput caps at ~capacity; excess demand is lost
        // (walkaways/deferrals); experienced waits pin near the balk tolerance
        const sv = capHr * 0.98;
        served += sv;
        lost += Math.max(0, lam - sv);
        waitSum += balkAt * 1.2 * sv;
        utilSum += 1;
      } else {
        let sv = lam, balked = 0;
        if (q.waitMin > balkAt) { balked = lam * 0.25; sv = lam - balked; }
        lost += balked;
        served += sv;
        waitSum += q.waitMin * sv;
        utilSum += q.util;
      }
    }
    return { waitMin: served ? waitSum / served : 0, util: utilSum / profile.length, lost: Math.round(lost), served: Math.round(served) };
  };
})();
