/* NEXUS Observatory — decision reports (web view + print-to-PDF). */
(function () {
  const R = (OBS.report = {});
  const esc = OBS.esc;

  const REVERSIBILITY = {
    close_road: ["reversible", "Road reopens at the end of the window; residual effects fade with habit re-formation."],
    outage: ["exogenous", "Not a decision — recovery dynamics apply."],
    layoff: ["partially irreversible", "Rehiring is slower than cutting; skills and trust attrit."],
    open_business: ["reversible with sunk cost", "Exit is possible; startup capital and lease costs are lost."],
    price_change: ["reversible", "Prices can be restored; customer perception may lag."],
    facility_config: ["reversible", "Staffing/layout changes can be rolled back within weeks."],
    add_housing: ["irreversible", "Construction is effectively permanent at this horizon."],
    demand_shock: ["exogenous", "Not a decision — an environment assumption."],
    param: ["assumption", "A modeling assumption, not an action."],
  };

  R.winnersLosers = function (spec, results) {
    const base = results.branches.baseline;
    const out = {};
    for (const [bid, br] of Object.entries(results.branches)) {
      if (bid === "baseline") continue;
      const rows = [];
      // cohorts by income delta
      for (const [cid, c] of Object.entries(br.repRun.state.cohorts)) {
        const b = base.repRun.state.cohorts[cid];
        if (!b) continue;
        const d = c.income - b.income;
        if (Math.abs(d) > Math.max(50, b.income * 0.02)) {
          rows.push({ kind: "cohort", name: OBS.app.world.graph.get(cid).name, delta: d, unit: "$/day income" });
        }
      }
      // organizations by revenue delta (last week averages)
      for (const [oid, o] of Object.entries(br.repRun.state.orgs)) {
        const b = base.repRun.state.orgs[oid];
        const now = OBS.stat.mean(o.revenue7 || []);
        const was = b ? OBS.stat.mean(b.revenue7 || []) : 0;
        if (Math.abs(now - was) > Math.max(80, was * 0.05)) {
          rows.push({ kind: "organization", name: o.name || OBS.app.world.graph.get(oid)?.name || oid, delta: now - was, unit: "$/day revenue" });
        }
      }
      rows.sort((a, b2) => b2.delta - a.delta);
      out[bid] = { name: br.name, winners: rows.filter((r) => r.delta > 0).slice(0, 6), losers: rows.filter((r) => r.delta < 0).slice(-6).reverse() };
    }
    return out;
  };

  R.build = function (spec, results, brief, sensitivity) {
    const world = OBS.app.world;
    const sum = OBS.copilot.summarize(spec, results);
    const wl = R.winnersLosers(spec, results);
    const meta = results.meta;
    const asm = OBS.scenario.assumptionRows(spec, world);
    const hm = OBS.metricDef(spec.headlineMetric);

    const metricTable = spec.metrics.map((m) => {
      const d = OBS.metricDef(m);
      const cells = Object.entries(sum.metrics[m]).map(([bid, r]) =>
        `<td>${r.med == null ? "—" : d.fmt(r.med)}<div class="rng">${r.p10 == null ? "" : d.fmt(r.p10) + " – " + d.fmt(r.p90)}</div>${bid !== "baseline" && r.delta != null ? `<div class="dl ${((d.better === "up") === (r.delta > 0)) ? "good" : "bad"}">${r.delta > 0 ? "▲" : "▼"} ${d.fmt(Math.abs(r.delta))}</div>` : ""}</td>`).join("");
      return `<tr><th>${esc(d.label)}</th>${cells}</tr>`;
    }).join("");
    const branchHeads = Object.values(results.branches).map((b) => `<th>${esc(b.name)}</th>`).join("");

    const chains = Object.entries(results.branches).filter(([bid]) => bid !== "baseline").map(([bid, br]) => {
      const cs = OBS.scenario.causalChains(br.repRun, 3);
      const render = (n, depth) => `<div class="chain-node" style="margin-left:${depth * 18}px">${depth ? "↳ " : "● "}<b>d${n.day}</b> ${esc(n.label)}</div>` + n.children.map((c) => render(c, depth + 1)).join("");
      return `<h4>${esc(br.name)}</h4>` + (cs.length ? cs.map((c) => `<div class="chain">${render(c.tree, 0)}</div>`).join("") : "<p class='muted'>No multi-step causal chains recorded.</p>");
    }).join("");

    const wlHtml = Object.values(wl).map((w) => `
      <h4>${esc(w.name)}</h4>
      <div class="cols2">
        <div><h5>Relative gainers</h5>${w.winners.map((r) => `<div class="wl">▲ ${esc(r.name)} <span class="muted">(${OBS.fmt.money(r.delta)}/day)</span></div>`).join("") || "<p class='muted'>none material</p>"}</div>
        <div><h5>Relative losers</h5>${w.losers.map((r) => `<div class="wl">▼ ${esc(r.name)} <span class="muted">(${OBS.fmt.money(r.delta)}/day)</span></div>`).join("") || "<p class='muted'>none material</p>"}</div>
      </div>`).join("");

    const revs = spec.branches.flatMap((b) => b.deltas).map((d) => {
      const [cls, note] = REVERSIBILITY[d.type] || ["unknown", ""];
      return `<tr><td>${esc(OBS.scenario.describeDelta(d, world))}</td><td><b>${cls}</b></td><td>${note}</td></tr>`;
    }).join("");

    const sens = (sensitivity || []).slice(0, 6).map((r) =>
      `<tr><td>${esc(r.label)}</td><td>${hm.fmt(r.lo)}</td><td>${hm.fmt(r.base)}</td><td>${hm.fmt(r.hi)}</td></tr>`).join("");

    const html = `
<div class="report">
  <div class="rp-head">
    <div class="rp-brand">NEXUS OBSERVATORY · DECISION REPORT</div>
    <h1>${esc(spec.name)}</h1>
    <div class="rp-meta">World: ${esc(world.name)} · Horizon ${spec.horizonDays} days · ${spec.seeds} seeded runs/branch · Generated ${new Date().toLocaleString()}</div>
    <div class="banner">SYNTHETIC SIMULATION — outputs are model estimates under stated assumptions, not predictions. No real individuals are represented.</div>
  </div>

  <h2>1 · Decision summary</h2>
  <p>${esc(spec.objective || "—")}</p>
  <p class="muted">Branches tested: ${Object.values(results.branches).map((b) => esc(b.name)).join(" · ")}</p>

  <h2>2 · Executive summary</h2>
  <p>${esc(brief.executive_summary)}</p>
  <ul>${brief.key_findings.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
  <p class="muted">Summary generator: ${esc(brief.generator || "local")}. All claims trace to engine output.</p>

  <h2>3 · Outcomes (final ${sum.window}-day window, median with P10–P90 band)</h2>
  <table class="rp-table"><thead><tr><th>Metric</th>${branchHeads}</tr></thead><tbody>${metricTable}</tbody></table>
  ${sum.watch ? `<h3>New business viability</h3><table class="rp-table"><thead><tr><th>Branch</th><th>Revenue/day</th><th>Range</th><th>Op. cost/day</th><th>Modeled margin</th></tr></thead><tbody>${Object.values(sum.watch).map((w) => `<tr><td>${esc(w.name)}</td><td>${OBS.fmt.money(w.revenue)}</td><td>${OBS.fmt.money(w.p10)} – ${OBS.fmt.money(w.p90)}</td><td>${OBS.fmt.money(w.dailyCost)}</td><td class="${w.margin >= 0 ? "good" : "bad"}">${OBS.fmt.money(w.margin)}/day</td></tr>`).join("")}</tbody></table>` : ""}

  <h2>4 · Causal pathways</h2>
  <p class="muted">Modeled mechanism chains from the representative run (seed 1). These are the pathways that produced the outcome — not merely correlations.</p>
  ${chains}

  <h2>5 · Distributional impact — winners & losers</h2>
  ${wlHtml}

  <h2>6 · Risks & second-order effects</h2>
  <ul>${brief.risks.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>

  <h2>7 · Sensitivity of the headline metric (${esc(hm.label)})</h2>
  ${sens ? `<table class="rp-table"><thead><tr><th>Assumption (±20%)</th><th>Low</th><th>Base</th><th>High</th></tr></thead><tbody>${sens}</tbody></table>` : "<p class='muted'>Sensitivity analysis not run for this report.</p>"}

  <h2>8 · Reversibility of actions</h2>
  <table class="rp-table"><thead><tr><th>Action</th><th>Class</th><th>Note</th></tr></thead><tbody>${revs}</tbody></table>

  <h2>9 · Recommended pilot & monitoring</h2>
  <p>${esc(brief.recommended_pilot)}</p>
  <p><b>Monitor:</b> ${brief.monitoring.map(esc).join(" · ")}</p>
  <p><b>Reconsider when:</b> observed values leave the modeled P10–P90 band for 2+ consecutive weeks, or a sensitive assumption is measured to differ ≥20% from its modeled value.</p>

  <h2>10 · Assumptions & data sources</h2>
  <table class="rp-table"><thead><tr><th>Assumption</th><th>Value</th><th>Source</th></tr></thead><tbody>
    ${asm.map((a) => `<tr><td>${esc(a.label)}</td><td>${a.value}${a.unit ? " " + esc(a.unit) : ""}</td><td>${esc(a.source)}</td></tr>`).join("")}
    ${spec.assumptionsNotes.map((n) => `<tr><td colspan="3" class="muted">${esc(n)}</td></tr>`).join("")}
  </tbody></table>

  <h2>11 · Model limitations</h2>
  <ul>${brief.caveats.map((c) => `<li>${esc(c)}</li>`).join("")}
    <li>Mechanisms modeled: BPR traffic assignment, Huff demand allocation, MPC income response, Erlang-C queues, rule-based organizational decisions. Channels outside these do not appear in results.</li>
  </ul>

  <h2>12 · Reproducibility</h2>
  <p class="mono muted">engine ${esc(meta.engine)} · app ${esc(meta.app)} · world ${esc(meta.world)} · spec hash ${meta.specHash} · seeds [${meta.seeds.join(",")}] · ran ${esc(meta.ranAt)}</p>
</div>`;

    return { id: "rp_" + Date.now().toString(36), specId: spec.id, name: spec.name, createdAt: new Date().toISOString(), html, meta };
  };

  R.save = function (report) {
    OBS.store.data.reports.push({ ...report });
    if (OBS.store.data.reports.length > 12) OBS.store.data.reports.shift();
    OBS.store.save();
    OBS.audit("report_generated", report.name);
  };
})();
