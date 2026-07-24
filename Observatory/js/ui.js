/* NEXUS Observatory — interface. Views: overview, map, scenarios, timeline,
   entities, graph, data, reports, audit, settings + contextual inspector. */
(function () {
  const UI = (OBS.ui = {});
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const esc = OBS.esc;
  UI.S = { view: "overview", specId: null, scMode: "list", results: {}, selBranch: null, replayDay: 1, entType: "organization", reportId: null, briefs: {}, sens: {} };

  // ---------- shell ----------
  UI.init = function () {
    $$(".nav-item").forEach((n) => {
      n.setAttribute("role", "button"); n.tabIndex = 0;
      n.addEventListener("click", () => UI.setView(n.dataset.view));
      n.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); UI.setView(n.dataset.view); } });
    });
    $("#theme-btn").onclick = () => {
      const s = OBS.store.data.settings;
      s.theme = s.theme === "light" ? "dark" : "light";
      OBS.store.save(); UI.applyTheme();
    };
    $("#insp-close").onclick = () => UI.inspector(null);
    UI.applyTheme();
    OBS.mapview.init($("#map-canvas"));
    OBS.mapview.onPick = (hit) => UI.inspectEntity(hit.id);
    const loop = () => { if (UI.S.view === "map") OBS.mapview.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    UI.setView("overview");
  };

  UI.applyTheme = function () {
    document.documentElement.dataset.theme = OBS.store.data.settings.theme;
    $("#theme-btn").textContent = OBS.store.data.settings.theme === "light" ? "◐ dark" : "◑ light";
  };

  UI.setView = function (v) {
    UI.S.view = v;
    $$(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.view === v));
    $$(".view").forEach((p) => p.classList.toggle("active", p.id === "view-" + v));
    UI.render();
  };

  UI.render = function () {
    const v = UI.S.view;
    if (v === "overview") UI.rOverview();
    else if (v === "map") UI.rMap();
    else if (v === "scenarios") UI.rScenarios();
    else if (v === "timeline") UI.rTimeline();
    else if (v === "entities") UI.rEntities();
    else if (v === "graph") UI.rGraph();
    else if (v === "data") UI.rData();
    else if (v === "reports") UI.rReports();
    else if (v === "audit") UI.rAudit();
    else if (v === "settings") UI.rSettings();
  };

  UI.toast = function (msg, cls = "") {
    const t = document.createElement("div");
    t.className = "toast " + cls; t.textContent = msg;
    $("#toasts").appendChild(t);
    setTimeout(() => t.remove(), 5000);
  };

  // ---------- inspector ----------
  UI.inspector = function (html) {
    const p = $("#inspector");
    if (!html) { p.classList.remove("open"); return; }
    $("#insp-body").innerHTML = html;
    p.classList.add("open");
  };

  UI.currentRep = function () {
    const res = UI.S.results[UI.S.specId];
    if (!res) return null;
    const bid = UI.S.selBranch && res.branches[UI.S.selBranch] ? UI.S.selBranch : Object.keys(res.branches)[0];
    return res.branches[bid]?.repRun || null;
  };

  UI.inspectEntity = function (id) {
    const g = OBS.app.world.graph;
    const e = g.get(id);
    const rep = UI.currentRep();
    if (!e && !(rep && rep.state.orgs[id])) return;
    let html = "";
    const srcBadge = (src, conf) => `<div class="srcline">source: <b>${esc(src?.kind || "synthetic")}</b> (${esc(src?.ref || "demo")}) · confidence ${(conf ?? 0.6).toFixed(1)} · updated ${esc(src?.date || "—")}</div>`;
    if (e?.type === "agent") {
      const st = rep?.agents.find((a) => a.id === id);
      const mems = st?.memories || [];
      html = `<div class="badge syn">SYNTHETIC AGENT</div><h2>${esc(e.name)}</h2>
        <p class="muted">Archetype sample of cohort ${esc(g.get(e.attrs.cohort)?.name || e.attrs.cohort)}. Does not represent any real person.</p>
        ${kv({ "age range": e.attrs.ageRange, occupation: e.attrs.occupation, employer: e.attrs.employer ? (g.get(e.attrs.employer)?.name || e.attrs.employer) : "—", "income band": e.attrs.incomeBand, "car access": e.attrs.carAccess ? "yes" : "no", "risk tolerance": e.attrs.riskTolerance, stress: st ? st.stress.toFixed(2) : e.attrs.stress })}
        <h3>Memories (epistemically tagged)</h3>
        ${mems.length ? mems.slice().reverse().map((m) => `<div class="mem"><span class="etag ${m.epistemic}">${m.epistemic}</span> <b>d${m.day}</b> ${esc(m.text)} <span class="muted">w=${m.weight.toFixed(2)}</span></div>`).join("") : "<p class='muted'>No memories in the selected run (or no run selected).</p>"}
        ${srcBadge(e.source, e.confidence)}`;
    } else if (e?.type === "cohort") {
      const st = rep?.state.cohorts[id];
      const emp = st ? Object.entries(st.employment).map(([o, n]) => `${esc(rep.state.orgs[o]?.name || g.get(o)?.name || o)}: ${n}`).join("<br>") : "—";
      html = `<div class="badge syn">SYNTHETIC COHORT</div><h2>${esc(e.name)}</h2>
        ${kv({ households: st?.households ?? e.attrs.households, persons: st?.persons ?? e.attrs.persons, workers: st?.workers ?? e.attrs.workers, unemployed: st?.unemployed ?? e.attrs.unemployed, "car share": OBS.fmt.pct(e.attrs.carShare, 0), "income (run)": st ? OBS.fmt.money(st.income) + "/day" : "—", "spend scale": st ? st.spendScale.toFixed(2) : "—" })}
        <h3>Employment</h3><p>${emp}</p>${srcBadge(e.source, e.confidence)}`;
    } else if ((e?.type === "organization") || rep?.state.orgs[id]) {
      const o = rep?.state.orgs[id];
      const base = e?.attrs || {};
      const name = e?.name || o?.name || id;
      const revChart = rep?.orgSeries[id]?.length ? `<div id="insp-chart"></div>` : "";
      html = `<h2>${esc(name)}</h2>
        ${o?.failed ? '<div class="badge crit">CLOSED — insolvent</div>' : o?.open === false ? '<div class="badge crit">CLOSED (power)</div>' : ""}
        ${kv({ sector: o?.sector || base.sector, neighborhood: g.get(o?.nb || e?.nb)?.name, jobs: o?.jobs ?? base.jobs, "wage": OBS.fmt.money(o?.wage ?? base.wage) + "/day", "price level": (o?.priceLevel ?? base.priceLevel) + "×", quality: (o?.quality ?? base.quality), "capacity/day": o?.capacityDaily ?? base.capacityDaily, "cash (run)": o ? OBS.fmt.money(o.cash) : "—", "customers/day (run)": o?.customersToday ?? "—", "backup power": (o?.backupPower ?? base.backupPower) ? "yes" : "no" })}
        <h3>Relationships</h3>
        ${g.neighbors(id).slice(0, 10).map((r) => `<div class="rel">${esc(r.from === id ? "→" : "←")} <b>${esc(r.rel)}</b> ${esc(g.get(r.from === id ? r.to : r.from)?.name || (r.from === id ? r.to : r.from))}</div>`).join("") || "<p class='muted'>—</p>"}
        <h3>Institutional memory</h3>
        ${(o?.memoryLog || []).length ? o.memoryLog.slice(-8).reverse().map((m) => `<div class="mem"><span class="etag observed">${m.kind}</span> <b>d${m.day}</b> ${esc(m.text)}</div>`).join("") : "<p class='muted'>No recorded incidents in the selected run.</p>"}
        ${revChart}${srcBadge(e?.source, e?.confidence)}`;
    } else if (e?.type === "road") {
      const rep2 = UI.currentRep();
      const vcArr = rep2?.edgeSeries?.[id];
      html = `<h2>${esc(e.name)}</h2>${kv({ connects: g.get(e.attrs.a).name + " ↔ " + g.get(e.attrs.b).name, "capacity": e.attrs.capacityHr + " veh/hr", "free-flow time": e.attrs.baseMin + " min", "v/c (run, last day)": vcArr ? (vcArr[vcArr.length - 1] == null ? "closed" : vcArr[vcArr.length - 1]) : "—" })}${srcBadge(e.source, e.confidence)}`;
    } else if (e) {
      html = `<h2>${esc(e.name)}</h2>${kv(Object.fromEntries(Object.entries(e.attrs).filter(([k, v]) => typeof v !== "object").slice(0, 12)))}${srcBadge(e.source, e.confidence)}`;
    }
    UI.inspector(html);
    if (rep?.orgSeries[id]?.length) {
      OBS.charts.line($("#insp-chart"), { title: "Revenue/day (selected run)", series: [{ name: "revenue", med: rep.orgSeries[id] }], fmt: (v) => OBS.fmt.money(v), height: 150 });
    }
    function kv(obj) {
      return `<div class="kv">` + Object.entries(obj).map(([k, v]) => `<div class="k">${esc(k)}</div><div>${v == null ? "—" : esc(String(v))}</div>`).join("") + `</div>`;
    }
  };

  UI.inspectEvent = function (specId, bid, evId) {
    const res = UI.S.results[specId];
    const rep = res?.branches[bid]?.repRun;
    if (!rep) return;
    const byId = {}; for (const e of rep.events) byId[e.id] = e;
    const ev = byId[evId]; if (!ev) return;
    const up = [];
    let cur = ev;
    while (cur.causeId && byId[cur.causeId]) { cur = byId[cur.causeId]; up.unshift(cur); }
    const kids = (ev.kids || []).map((k) => byId[k]).filter(Boolean);
    UI.inspector(`
      <h2>Causal inspector</h2>
      <div class="badge">day ${ev.day} · ${esc(ev.type)}</div>
      <p><b>${esc(ev.label)}</b></p>
      <h3>What led to this</h3>
      ${up.length ? up.map((u, i) => `<div class="chain-node" style="margin-left:${i * 14}px">${i ? "↳" : "●"} <b>d${u.day}</b> <a class="lnk" data-ev="${u.id}">${esc(u.label)}</a></div>`).join("") : "<p class='muted'>Root cause — this is a scenario input or exogenous event.</p>"}
      <h3>What it caused next</h3>
      ${kids.length ? kids.map((k) => `<div class="chain-node">↳ <b>d${k.day}</b> <a class="lnk" data-ev="${k.id}">${esc(k.label)}</a></div>`).join("") : "<p class='muted'>No recorded downstream effects (yet).</p>"}
      <p class="muted" style="margin-top:10px">Chains show modeled mechanisms in the representative run (seed 1). Confidence: pathways are deterministic given assumptions; magnitudes vary across seeds — see the metric bands.</p>`);
    $$("#insp-body .lnk").forEach((a) => a.onclick = () => UI.inspectEvent(specId, bid, a.dataset.ev));
  };

  // ---------- overview ----------
  UI.rOverview = function () {
    const w = OBS.app.world;
    const pv = OBS.app.baselinePreview;
    const tile = (m) => {
      const d = OBS.metricDef(m);
      const arr = pv?.agg[m];
      const last = arr ? arr.med[arr.med.length - 1] : null;
      return `<div class="tile"><div class="tk">${esc(d.label)}</div><div class="tv">${last == null ? "…" : d.fmt(last)}</div>
        <div class="tsub">${arr ? "P10–P90: " + d.fmt(arr.p10[arr.p10.length - 1]) + " – " + d.fmt(arr.p90[arr.p90.length - 1]) : ""}</div>
        <div class="spark" id="spark-${m}"></div></div>`;
    };
    $("#view-overview").innerHTML = `
      <div class="banner">SYNTHETIC DEMO WORLD — ${esc(w.name)}. All residents, businesses and values are generated; nothing here describes real people or a real place. Import data (Data view) and calibrate before treating magnitudes as meaningful.</div>
      <div class="hero-row">
        <div class="hero-stat"><div class="hv">${OBS.fmt.num(w.population)}</div><div class="hk">synthetic residents<br>(18 cohorts, 72 inspectable samples)</div></div>
        <div class="hero-stat"><div class="hv">${w.graph.byType("organization").length - 1}</div><div class="hk">organizations</div></div>
        <div class="hero-stat"><div class="hv">${w.graph.byType("road").length}</div><div class="hk">road segments</div></div>
        <div class="hero-stat"><div class="hv">${OBS.fmt.num(w.households)}</div><div class="hk">households</div></div>
      </div>
      <h3 class="sec">BASELINE (30-day preview · ${pv ? pv.seeds : "…"} seeds · median and band)</h3>
      <div class="tiles">${["unemployment_rate", "avg_commute", "retail_revenue", "clinic_wait"].map(tile).join("")}</div>
      <h3 class="sec">START HERE</h3>
      <div class="cards">
        ${OBS.scenario.TEMPLATES.map((t) => `<div class="card" data-tpl="${t.id}"><div class="ct">${esc(t.title)}</div><div class="cb">${esc(t.blurb)}</div><button class="btn small">Open scenario →</button></div>`).join("")}
        <div class="card"><div class="ct">Describe your own</div><div class="cb">"What happens if Canal St closes for two months?" — the scenario builder turns plain language into a reviewable spec.</div><button class="btn small" id="ov-new">New scenario →</button></div>
      </div>`;
    for (const m of ["unemployment_rate", "avg_commute", "retail_revenue", "clinic_wait"]) {
      const a = pv?.agg[m];
      if (a) OBS.charts.line($("#spark-" + m), { series: [{ name: OBS.metricDef(m).label, med: a.med, p10: a.p10, p90: a.p90 }], height: 70, fmt: OBS.metricDef(m).fmt });
    }
    $$("#view-overview .card[data-tpl]").forEach((c) => c.onclick = () => UI.openTemplate(c.dataset.tpl));
    $("#ov-new").onclick = () => { UI.newScenario(); };
  };

  // ---------- map ----------
  UI.rMap = function () {
    const res = UI.S.results[UI.S.specId];
    const branches = res ? Object.values(res.branches) : [];
    $("#map-side").innerHTML = `
      <h3 class="sec">LAYERS</h3>
      ${Object.keys(OBS.mapview.layers).map((l) => `<label class="chk"><input type="checkbox" data-layer="${l}" ${OBS.mapview.layers[l] ? "checked" : ""}> ${l}</label>`).join("")}
      <h3 class="sec">RUN REPLAY</h3>
      ${res ? `
        <select id="map-branch" class="sel">${branches.map((b) => `<option value="${b.id}" ${UI.S.selBranch === b.id ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select>
        <input type="range" id="map-day" min="1" max="${res.branches[branches[0].id].repRun.series[Object.keys(res.branches[branches[0].id].repRun.series)[0]].length}" value="${UI.S.replayDay}" style="width:100%">
        <div class="muted" id="map-dayl">Day ${UI.S.replayDay} · simulation time (baseline real-world date unset)</div>
        <div class="legend">
          <div><span class="lg-line" style="background:#3987e5"></span> road width = volume, blue depth = v/c</div>
          <div><span class="lg-ring"></span> saturated segment (v/c > 0.95)</div>
          <div><span class="lg-sq"></span> organization · <span style="color:var(--critical)">■</span> closed</div>
        </div>`
        : `<p class="muted">Run a scenario to replay it spatially. The map shows network state, closures and outages day by day.</p>`}
    `;
    $$("#map-side [data-layer]").forEach((c) => c.onchange = () => { OBS.mapview.layers[c.dataset.layer] = c.checked; });
    if (res) {
      const setReplay = () => {
        const bid = $("#map-branch").value;
        UI.S.selBranch = bid;
        UI.S.replayDay = +$("#map-day").value;
        $("#map-dayl").textContent = `Day ${UI.S.replayDay} · simulation time`;
        OBS.mapview.replay = { run: res.branches[bid].repRun, day: UI.S.replayDay };
      };
      $("#map-branch").onchange = setReplay;
      $("#map-day").oninput = setReplay;
      setReplay();
    } else OBS.mapview.replay = null;
    setTimeout(() => OBS.mapview.resize(), 0);
  };

  // ---------- scenarios ----------
  UI.openTemplate = function (tplId) {
    const t = OBS.scenario.TEMPLATES.find((x) => x.id === tplId);
    const spec = t.build();
    spec.id = "sc_" + tplId + "_" + Date.now().toString(36).slice(-4);
    OBS.scenario.saveSpec(spec);
    OBS.audit("scenario_created", spec.id + " (template " + tplId + ")");
    UI.S.specId = spec.id; UI.S.scMode = "edit";
    UI.setView("scenarios");
  };

  UI.newScenario = function () {
    const spec = OBS.scenario.newSpec({ name: "New scenario" });
    OBS.scenario.saveSpec(spec);
    OBS.audit("scenario_created", spec.id);
    UI.S.specId = spec.id; UI.S.scMode = "edit";
    UI.setView("scenarios");
  };

  UI.rScenarios = function () {
    const mode = UI.S.scMode;
    if (mode === "edit" && UI.S.specId) return UI.rScenarioEdit();
    if (mode === "results" && UI.S.specId) return UI.rScenarioResults();
    const list = OBS.store.data.scenarios;
    $("#view-scenarios").innerHTML = `
      <div class="toolbar"><h2>Scenarios</h2><button class="btn primary" id="sc-new">+ New scenario</button></div>
      ${list.length ? `<table class="tbl"><thead><tr><th>Name</th><th>Branches</th><th>Horizon</th><th>Status</th><th></th></tr></thead><tbody>
        ${list.map((s) => `<tr><td><b>${esc(s.name)}</b><div class="muted">${esc((s.objective || "").slice(0, 90))}</div></td><td>${s.branches.length}</td><td>${s.horizonDays}d</td>
        <td>${UI.S.results[s.id] ? '<span class="badge ok">ran</span>' : s.reviewed ? '<span class="badge">ready</span>' : '<span class="badge warn">needs review</span>'}</td>
        <td><button class="btn small" data-open="${s.id}">open</button> ${UI.S.results[s.id] ? `<button class="btn small" data-res="${s.id}">results</button>` : ""} <button class="btn small danger" data-del="${s.id}">✕</button></td></tr>`).join("")}
      </tbody></table>` : `<p class="muted">No scenarios yet. Start from a template on the Overview, or describe one in plain language.</p>`}`;
    $("#sc-new").onclick = UI.newScenario;
    $$("#view-scenarios [data-open]").forEach((b) => b.onclick = () => { UI.S.specId = b.dataset.open; UI.S.scMode = "edit"; UI.rScenarios(); });
    $$("#view-scenarios [data-res]").forEach((b) => b.onclick = () => { UI.S.specId = b.dataset.res; UI.S.scMode = "results"; UI.rScenarios(); });
    $$("#view-scenarios [data-del]").forEach((b) => b.onclick = () => {
      if (!OBS.can("analyst")) return UI.toast("Viewer role cannot delete scenarios", "bad");
      OBS.store.data.scenarios = OBS.store.data.scenarios.filter((s) => s.id !== b.dataset.del);
      OBS.store.save(); OBS.audit("scenario_deleted", b.dataset.del); UI.rScenarios();
    });
  };

  UI.rScenarioEdit = function () {
    const spec = OBS.scenario.get(UI.S.specId);
    if (!spec) { UI.S.scMode = "list"; return UI.rScenarios(); }
    const world = OBS.app.world;
    const blocked = spec.flags.some((f) => f.level === "blocked");
    const asm = OBS.scenario.assumptionRows(spec, world);
    $("#view-scenarios").innerHTML = `
      <div class="toolbar"><a class="lnk" id="sc-back">← scenarios</a><h2>Scenario builder</h2>
        <span class="badge">${esc(spec.id)}</span></div>

      <div class="panel-box">
        <h3 class="sec">DESCRIBE (natural language)</h3>
        <div class="nlrow">
          <input id="nl-text" class="inp" placeholder='e.g. "What happens if Harbor Bridge closes for six months?" or "Open a premium gym — compare Midtown vs Northfield"' value="">
          <button class="btn" id="nl-parse">Parse</button>
          <button class="btn" id="nl-copilot" ${OBS.copilot.enabled() ? "" : "disabled title='Add an API key in Settings'"}>Parse with Copilot</button>
        </div>
        <p class="muted">Parsing produces a specification below. Nothing runs until you review it.</p>
      </div>

      <div class="panel-box">
        <h3 class="sec">SPECIFICATION</h3>
        <div class="frm">
          <label>Name <input class="inp" id="sp-name" value="${esc(spec.name)}"></label>
          <label>Objective <input class="inp" id="sp-obj" value="${esc(spec.objective)}"></label>
          <label>Horizon (days) <input class="inp num" id="sp-hor" type="number" min="14" max="400" value="${spec.horizonDays}"></label>
          <label>Seeded runs / branch <input class="inp num" id="sp-seeds" type="number" min="1" max="25" value="${spec.seeds}"></label>
          <label>Headline metric <select class="sel" id="sp-head">${OBS.METRICS.map((m) => `<option value="${m.id}" ${spec.headlineMetric === m.id ? "selected" : ""}>${esc(m.label)}</option>`).join("")}</select></label>
        </div>
        <h4>Branches <span class="muted">(a no-intervention baseline is always run for comparison)</span></h4>
        ${spec.branches.map((b, bi) => `
          <div class="branch"><b>${esc(b.name)}</b> <button class="btn small danger" data-delbr="${bi}">remove</button>
            ${b.deltas.map((d, di) => `<div class="delta">▸ ${esc(OBS.scenario.describeDelta(d, world))} <button class="btn small danger" data-deld="${bi}:${di}">✕</button></div>`).join("") || "<div class='muted'>no changes</div>"}
          </div>`).join("") || "<p class='muted'>No branches yet — parse a description above or add one from a template.</p>"}
        ${spec.flags.length ? `<h4>Parser notes — resolve before running</h4>${spec.flags.map((f) => `<div class="flag ${f.level}">${f.level === "blocked" ? "⛔" : "⚠"} ${esc(f.text)}</div>`).join("")}` : ""}
      </div>

      <div class="panel-box">
        <h3 class="sec">ASSUMPTIONS IN PLAY (edit values to override for this scenario)</h3>
        <table class="tbl"><thead><tr><th>Assumption</th><th>Value</th><th>Unit</th><th>Source</th></tr></thead><tbody>
          ${asm.map((a) => `<tr><td>${esc(a.label)}</td><td><input class="inp num asm" data-key="${a.key}" value="${a.value}"></td><td>${esc(a.unit)}</td><td class="muted">${esc(a.source)}</td></tr>`).join("")}
        </tbody></table>
        ${spec.assumptionsNotes.map((n) => `<div class="flag review">ℹ ${esc(n)}</div>`).join("")}
      </div>

      <div class="panel-box runrow">
        <label class="chk big"><input type="checkbox" id="sp-reviewed" ${spec.reviewed ? "checked" : ""}> I reviewed the branches and assumptions above; defaults I did not change are acceptable for this run.</label>
        <button class="btn primary big" id="sp-run" ${blocked || !OBS.can("analyst") ? "disabled" : ""}>${blocked ? "RESOLVE ⛔ ITEMS FIRST" : "RUN SIMULATION"}</button>
        <div id="run-prog" class="prog" hidden><div id="run-bar"></div><span id="run-lbl"></span></div>
      </div>`;

    $("#sc-back").onclick = () => { UI.S.scMode = "list"; UI.rScenarios(); };
    const saveEdits = () => {
      spec.name = $("#sp-name").value; spec.objective = $("#sp-obj").value;
      spec.horizonDays = OBS.clamp(+$("#sp-hor").value || 90, 14, 400);
      spec.seeds = OBS.clamp(+$("#sp-seeds").value || 7, 1, 25);
      spec.headlineMetric = $("#sp-head").value;
      OBS.scenario.saveSpec(spec);
    };
    $$("#view-scenarios .inp, #view-scenarios .sel").forEach((i) => i.addEventListener("change", saveEdits));
    $$("#view-scenarios .asm").forEach((i) => i.addEventListener("change", () => {
      const key = i.dataset.key, v = parseFloat(i.value);
      if (!isNaN(v)) { spec.paramOverrides[key] = v; OBS.scenario.saveSpec(spec); OBS.audit("assumption_changed", `${spec.id}: ${key} → ${v}`); UI.toast("Assumption recorded: " + key + " = " + v); }
    }));
    $$("#view-scenarios [data-delbr]").forEach((b) => b.onclick = () => { spec.branches.splice(+b.dataset.delbr, 1); OBS.scenario.saveSpec(spec); UI.rScenarioEdit(); });
    $$("#view-scenarios [data-deld]").forEach((b) => b.onclick = () => { const [bi, di] = b.dataset.deld.split(":").map(Number); spec.branches[bi].deltas.splice(di, 1); OBS.scenario.saveSpec(spec); UI.rScenarioEdit(); });
    $("#nl-parse").onclick = () => {
      const txt = $("#nl-text").value.trim(); if (!txt) return;
      const draft = OBS.scenario.parseNL(txt, world);
      Object.assign(spec, { name: draft.name, objective: draft.objective, horizonDays: draft.horizonDays, headlineMetric: draft.headlineMetric, metrics: draft.metrics, branches: draft.branches.length ? draft.branches : spec.branches, flags: draft.flags, watchOrg: draft.watchOrg, reviewed: false });
      OBS.scenario.saveSpec(spec); OBS.audit("scenario_parsed", spec.id + " (local): " + txt.slice(0, 80));
      UI.rScenarioEdit();
    };
    $("#nl-copilot").onclick = async () => {
      const txt = $("#nl-text").value.trim(); if (!txt) return;
      $("#nl-copilot").textContent = "parsing…";
      try {
        const draft = await OBS.copilot.parseScenario(txt);
        Object.assign(spec, { name: draft.name, objective: draft.objective, horizonDays: draft.horizonDays, headlineMetric: draft.headlineMetric, metrics: draft.metrics, branches: draft.branches, flags: draft.flags, watchOrg: draft.watchOrg, reviewed: false });
        OBS.scenario.saveSpec(spec); OBS.audit("scenario_parsed", spec.id + " (copilot): " + txt.slice(0, 80));
        UI.rScenarioEdit();
      } catch (e) { UI.toast("Copilot parse failed: " + e.message, "bad"); $("#nl-copilot").textContent = "Parse with Copilot"; }
    };
    $("#sp-reviewed").onchange = (e) => { spec.reviewed = e.target.checked; OBS.scenario.saveSpec(spec); if (e.target.checked) OBS.audit("scenario_reviewed", spec.id); };
    $("#sp-run").onclick = async () => {
      saveEdits();
      if (!spec.reviewed) return UI.toast("Confirm the review checkbox first — assumptions must be seen before running.", "bad");
      if (!spec.branches.length) return UI.toast("Add at least one intervention branch.", "bad");
      $("#run-prog").hidden = false; $("#sp-run").disabled = true;
      try {
        const res = await OBS.scenario.run(spec, (p, lbl) => { $("#run-bar").style.width = (p * 100).toFixed(0) + "%"; $("#run-lbl").textContent = lbl; });
        UI.S.results[spec.id] = res;
        spec.status = "ran"; OBS.scenario.saveSpec(spec);
        UI.S.selBranch = Object.keys(res.branches).find((b) => b !== "baseline") || "baseline";
        UI.S.scMode = "results"; UI.rScenarios();
      } catch (e) { UI.toast(e.message, "bad"); $("#sp-run").disabled = false; }
    };
  };

  UI.rScenarioResults = function () {
    const spec = OBS.scenario.get(UI.S.specId);
    const res = UI.S.results[UI.S.specId];
    if (!spec || !res) { UI.S.scMode = "edit"; return UI.rScenarios(); }
    const sum = OBS.copilot.summarize(spec, res);
    const brName = (bid) => res.branches[bid].name;
    const bids = Object.keys(res.branches);
    const brief = UI.S.briefs[spec.id];
    const sens = UI.S.sens[spec.id];

    $("#view-scenarios").innerHTML = `
      <div class="toolbar"><a class="lnk" id="sc-back">← scenarios</a><h2>${esc(spec.name)}</h2>
        <button class="btn" id="rs-edit">edit & re-run</button>
        <button class="btn" id="rs-map">replay on map</button>
        <button class="btn primary" id="rs-report">generate report</button></div>
      <div class="banner slim">Model estimates under stated assumptions — median of ${spec.seeds} seeded runs with P10–P90 bands. Not predictions. Spec hash ${res.meta.specHash} · reproducible.</div>

      <h3 class="sec">OUTCOMES — final ${sum.window}-day window vs baseline</h3>
      <table class="tbl cmp"><thead><tr><th>Metric</th>${bids.map((b) => `<th>${esc(brName(b))}</th>`).join("")}</tr></thead><tbody>
        ${spec.metrics.map((m) => {
          const d = OBS.metricDef(m);
          return `<tr><th>${esc(d.label)}</th>${bids.map((bid) => {
            const r = sum.metrics[m][bid];
            if (!r || r.med == null) return "<td>—</td>";
            const dl = bid !== "baseline" && r.delta != null ? `<div class="dl ${((d.better === "up") === (r.delta > 0)) ? "good" : "bad"}">${r.delta > 0 ? "▲" : "▼"} ${d.fmt(Math.abs(r.delta))}</div>` : "";
            return `<td><b>${d.fmt(r.med)}</b><div class="rng">${d.fmt(r.p10)} – ${d.fmt(r.p90)}</div>${dl}</td>`;
          }).join("")}</tr>`;
        }).join("")}
      </tbody></table>

      ${sum.watch ? `<h3 class="sec">NEW BUSINESS VIABILITY</h3><table class="tbl"><thead><tr><th>Branch</th><th>Revenue/day (med)</th><th>P10–P90</th><th>Operating cost/day</th><th>Modeled margin</th></tr></thead><tbody>
        ${Object.entries(sum.watch).map(([bid, w2]) => `<tr><td>${esc(w2.name)}</td><td>${OBS.fmt.money(w2.revenue)}</td><td>${OBS.fmt.money(w2.p10)} – ${OBS.fmt.money(w2.p90)}</td><td>${OBS.fmt.money(w2.dailyCost)}</td><td class="${w2.margin >= 0 ? "good" : "bad"}"><b>${OBS.fmt.money(w2.margin)}/day</b></td></tr>`).join("")}</tbody></table>` : ""}

      <h3 class="sec">TRAJECTORIES</h3>
      <div class="chartgrid">${spec.metrics.map((m) => `<div class="chartcell" id="ch-${m}"></div>`).join("")}${spec.watchOrg ? `<div class="chartcell" id="ch-watch"></div>` : ""}</div>

      <h3 class="sec">WHERE BRANCHES DIVERGE</h3>
      ${Object.entries(res.divergence).map(([bid, dv]) => `
        <div class="panel-box"><b>${esc(brName(bid))}</b> — ${dv.firstDay != null ? `diverges from baseline around <b>day ${dv.firstDay}</b> (headline metric, sustained ≥3 days).` : "no sustained divergence on the headline metric."}
          ${dv.firstEvents.length ? `<div class="muted" style="margin-top:6px">First branch-specific events:</div>${dv.firstEvents.slice(0, 5).map((e) => `<div class="delta">d${e.day} · <a class="lnk" data-ev="${bid}:${e.id}">${esc(e.label)}</a></div>`).join("")}` : ""}
        </div>`).join("")}

      <h3 class="sec">CAUSAL PATHWAYS (representative run)</h3>
      ${bids.filter((b) => b !== "baseline").map((bid) => {
        const chains = OBS.scenario.causalChains(res.branches[bid].repRun, 4);
        const rend = (n, depth) => `<div class="chain-node" style="margin-left:${depth * 16}px">${depth ? "↳" : "●"} <b>d${n.day}</b> <a class="lnk" data-ev="${bid}:${n.id}">${esc(n.label)}</a></div>` + n.children.map((c) => rend(c, depth + 1)).join("");
        return `<div class="panel-box"><b>${esc(brName(bid))}</b>${chains.map((c) => `<div class="chain">${rend(c.tree, 0)}</div>`).join("") || "<p class='muted'>no chains recorded</p>"}</div>`;
      }).join("")}

      <div class="toolbar">
        <button class="btn" id="rs-sens">${sens ? "re-run" : "run"} sensitivity analysis</button>
        <button class="btn" id="rs-brief">${OBS.copilot.enabled() ? "Copilot brief" : "generate brief (local)"}</button>
        <span class="muted" id="rs-busy"></span>
      </div>
      <div id="rs-sens-out">${sens ? "" : ""}</div>
      <div id="rs-brief-out"></div>`;

    // charts
    for (const m of spec.metrics) {
      const d = OBS.metricDef(m);
      OBS.charts.line($("#ch-" + m), {
        title: d.label, fmt: d.fmt, height: 210,
        markers: spec.branches.flatMap((b) => b.deltas.map((x) => ({ day: x.startDay }))),
        series: bids.map((bid, i) => ({
          name: brName(bid),
          color: bid === "baseline" ? "var(--muted)" : OBS.charts.seriesColor(i - 1),
          med: res.branches[bid].agg[m].med, p10: res.branches[bid].agg[m].p10, p90: res.branches[bid].agg[m].p90,
        })),
      });
    }
    if (spec.watchOrg) {
      const withWatch = bids.filter((b) => res.branches[b].watch);
      if (withWatch.length) OBS.charts.line($("#ch-watch"), {
        title: "New business — revenue/day", fmt: (v) => OBS.fmt.money(v), height: 210,
        series: withWatch.map((bid, i) => ({ name: brName(bid), color: OBS.charts.seriesColor(i), med: res.branches[bid].watch.med, p10: res.branches[bid].watch.p10, p90: res.branches[bid].watch.p90 })),
      });
    }
    if (sens) OBS.charts.tornado($("#rs-sens-out"), {
      rows: sens,
      fmt: spec.watchOrg ? ((v) => OBS.fmt.money(v)) : OBS.metricDef(spec.headlineMetric).fmt,
      title: `Sensitivity of ${spec.watchOrg ? "new-business revenue/day" : OBS.metricDef(spec.headlineMetric).label} (±20% per assumption)`,
    });
    if (brief) UI.renderBrief(brief);

    $("#sc-back").onclick = () => { UI.S.scMode = "list"; UI.rScenarios(); };
    $("#rs-edit").onclick = () => { UI.S.scMode = "edit"; UI.rScenarios(); };
    $("#rs-map").onclick = () => UI.setView("map");
    $$("#view-scenarios [data-ev]").forEach((a) => a.onclick = () => { const [bid, ev] = a.dataset.ev.split(":"); UI.inspectEvent(spec.id, bid, ev); });
    $("#rs-sens").onclick = async () => {
      $("#rs-busy").textContent = "computing sensitivity…";
      const bid = bids.find((b) => b !== "baseline");
      const rows = await OBS.scenario.sensitivity(spec, bid, (p, l) => $("#rs-busy").textContent = `sensitivity: ${l} (${Math.round(p * 100)}%)`);
      UI.S.sens[spec.id] = rows;
      $("#rs-busy").textContent = "";
      UI.rScenarioResults();
    };
    $("#rs-brief").onclick = async () => {
      $("#rs-busy").textContent = "generating brief…";
      let brief2;
      if (OBS.copilot.enabled()) {
        try { brief2 = await OBS.copilot.brief(spec, res, UI.S.sens[spec.id]); }
        catch (e) { UI.toast("Copilot failed (" + e.message + ") — using local generator.", "bad"); brief2 = OBS.copilot.localBrief(spec, res, UI.S.sens[spec.id]); }
      } else brief2 = OBS.copilot.localBrief(spec, res, UI.S.sens[spec.id]);
      UI.S.briefs[spec.id] = brief2;
      $("#rs-busy").textContent = "";
      UI.renderBrief(brief2);
    };
    $("#rs-report").onclick = () => {
      const brief2 = UI.S.briefs[spec.id] || OBS.copilot.localBrief(spec, res, UI.S.sens[spec.id]);
      const rp = OBS.report.build(spec, res, brief2, UI.S.sens[spec.id]);
      OBS.report.save(rp);
      UI.S.reportId = rp.id;
      UI.setView("reports");
    };
  };

  UI.renderBrief = function (b) {
    const out = $("#rs-brief-out"); if (!out) return;
    out.innerHTML = `<div class="panel-box brief">
      <div class="badge">${esc(b.generator || "brief")}</div>
      <h3>Executive summary</h3><p>${esc(b.executive_summary)}</p>
      <h3>Key findings</h3><ul>${b.key_findings.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <h3>Risks & second-order effects</h3><ul>${b.risks.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
      <h3>Recommended pilot</h3><p>${esc(b.recommended_pilot)}</p>
      <h3>Monitor</h3><p>${b.monitoring.map(esc).join(" · ")}</p>
      <h3>Caveats</h3><ul>${b.caveats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></div>`;
  };

  // ---------- timeline ----------
  const LANES = [
    ["scenario", ["road_closed", "road_reopened", "power_outage", "workforce_reduction", "business_opened", "price_change", "facility_reconfigured", "housing_added", "demand_shock", "assumption_changed"]],
    ["traffic", ["traffic_shifted", "lateness_pattern", "employer_response"]],
    ["economy", ["jobs_lost", "jobs_added", "revenue_shift", "expansion_hiring"]],
    ["organizations", ["staff_reduction", "business_failed", "org_closed_outage", "org_reopened", "spoilage_loss"]],
    ["services", ["service_strain"]],
  ];
  UI.rTimeline = function () {
    const res = UI.S.results[UI.S.specId];
    const spec = OBS.scenario.get(UI.S.specId);
    if (!res || !spec) { $("#view-timeline").innerHTML = "<p class='muted pad'>Run a scenario first — the timeline shows its events, checkpoints, and lets you fork from any checkpoint.</p>"; return; }
    const bids = Object.keys(res.branches);
    const bid = UI.S.selBranch && res.branches[UI.S.selBranch] ? UI.S.selBranch : bids[1] || bids[0];
    const rep = res.branches[bid].repRun;
    const horizon = spec.horizonDays;
    const px = Math.max(4, Math.min(14, 1100 / horizon));
    const laneOf = (t) => { for (const [name, types] of LANES) if (types.includes(t)) return name; return "economy"; };
    const evByLane = {};
    for (const e of rep.events) (evByLane[laneOf(e.type)] = evByLane[laneOf(e.type)] || []).push(e);
    $("#view-timeline").innerHTML = `
      <div class="toolbar"><h2>Timeline — ${esc(spec.name)}</h2>
        <select id="tl-branch" class="sel">${bids.map((b) => `<option value="${b}" ${b === bid ? "selected" : ""}>${esc(res.branches[b].name)}</option>`).join("")}</select></div>
      <p class="muted">Simulation days 1–${horizon}. ● events (click to trace causality) · ◆ checkpoints (fork a new branch of reality from that moment).</p>
      <div class="tl-scroll"><div class="tl" style="width:${horizon * px + 160}px">
        ${LANES.map(([lane]) => `<div class="tl-lane"><div class="tl-lab">${lane}</div><div class="tl-track" style="width:${horizon * px}px">
          ${(evByLane[lane] || []).map((e) => `<span class="tl-ev ${lane}" style="left:${(e.day - 1) * px}px" title="d${e.day} ${esc(e.label)}" data-ev="${e.id}"></span>`).join("")}
        </div></div>`).join("")}
        <div class="tl-lane"><div class="tl-lab">checkpoints</div><div class="tl-track" style="width:${horizon * px}px">
          ${(res.branches[bid]._snapshots || []).map((s) => `<span class="tl-cp" style="left:${(s.day - 1) * px}px" title="checkpoint day ${s.day} — click to fork" data-cp="${s.day}">◆</span>`).join("")}
        </div></div>
        <div class="tl-axis" style="width:${horizon * px}px">${Array.from({ length: Math.floor(horizon / 14) + 1 }, (_, i) => `<span style="left:${i * 14 * px}px">d${i * 14 + 1}</span>`).join("")}</div>
      </div></div>`;
    $("#tl-branch").onchange = (e) => { UI.S.selBranch = e.target.value; UI.rTimeline(); };
    $$("#view-timeline [data-ev]").forEach((s) => s.onclick = () => UI.inspectEvent(spec.id, bid, s.dataset.ev));
    $$("#view-timeline [data-cp]").forEach((s) => s.onclick = () => {
      if (!OBS.can("analyst")) return UI.toast("Viewer role cannot fork scenarios", "bad");
      const day = +s.dataset.cp;
      const snap = res.branches[bid]._snapshots.find((x) => x.day === day);
      if (!snap) return;
      const fork = OBS.scenario.newSpec({ name: spec.name + ` — fork @ day ${day}`, objective: `Forked from "${spec.name}" branch "${res.branches[bid].name}" at day ${day}. Same world-state at the fork point; add new deltas to explore an alternative continuation.`, horizonDays: Math.max(30, spec.horizonDays - day), headlineMetric: spec.headlineMetric, metrics: spec.metrics, branches: [{ id: "b1", name: "Continuation", deltas: [] }] });
      fork.initState = OBS.clone(snap.state);
      OBS.scenario.saveSpec(fork);
      OBS.audit("scenario_forked", `${fork.id} from ${spec.id}@d${day}`);
      UI.S.specId = fork.id; UI.S.scMode = "edit"; UI.setView("scenarios");
      UI.toast(`Forked reality at day ${day}. Add deltas and run.`);
    });
  };

  // ---------- entities ----------
  UI.rEntities = function () {
    const g = OBS.app.world.graph;
    const types = ["organization", "cohort", "agent", "road", "neighborhood", "substation"];
    const t = UI.S.entType;
    const rows = g.byType(t);
    $("#view-entities").innerHTML = `
      <div class="toolbar"><h2>Entities</h2>${types.map((x) => `<button class="btn small ${x === t ? "on" : ""}" data-t="${x}">${x} (${g.byType(x).length})</button>`).join("")}</div>
      ${t === "agent" ? `<div class="banner slim">Synthetic agents are archetype samples used for inspection and memory tracing. Aggregate behavior is computed at cohort level. None represents a real person.</div>` : ""}
      <table class="tbl"><thead><tr><th>Name</th><th>Location</th><th>Key attributes</th><th>Source</th></tr></thead><tbody>
      ${rows.map((e) => `<tr class="rowlink" data-id="${e.id}"><td><b>${esc(e.name)}</b></td><td>${esc(g.get(e.nb)?.name || e.nb || "—")}</td>
        <td class="muted">${esc(summ(e))}</td><td><span class="badge">${esc(e.source?.kind || "synthetic")}</span></td></tr>`).join("")}
      </tbody></table>`;
    $$("#view-entities [data-t]").forEach((b) => b.onclick = () => { UI.S.entType = b.dataset.t; UI.rEntities(); });
    $$("#view-entities .rowlink").forEach((r) => r.onclick = () => UI.inspectEntity(r.dataset.id));
    function summ(e) {
      if (e.type === "organization") return `${e.attrs.sector} · ${e.attrs.jobs} jobs`;
      if (e.type === "cohort") return `${e.attrs.households} hh · ${e.attrs.workers} workers · ${e.attrs.band}`;
      if (e.type === "agent") return `${e.attrs.occupation} · ${e.attrs.ageRange}`;
      if (e.type === "road") return `cap ${e.attrs.capacityHr}/hr · ${e.attrs.baseMin} min`;
      if (e.type === "substation") return `serves ${e.attrs.serves.join(", ")}`;
      return e.attrs.desc || "";
    }
  };

  // ---------- graph ----------
  UI.rGraph = function () {
    const g = OBS.app.world.graph;
    const cols = [["neighborhood"], ["road", "substation"], ["organization"], ["cohort"]];
    $("#view-graph").innerHTML = `
      <div class="toolbar"><h2>Entity graph</h2><span class="muted">click a node to see its relationships; propagation paths follow these edges</span></div>
      <div class="graphwrap" id="graphwrap"><svg id="graph-svg" width="100%" height="640"></svg></div>`;
    const svg = $("#graph-svg");
    const W2 = svg.clientWidth || 1000;
    const pos = {};
    cols.forEach((types, ci) => {
      const nodes = types.flatMap((t) => g.byType(t));
      nodes.forEach((n, i) => { pos[n.id] = { x: 90 + ci * ((W2 - 160) / (cols.length - 1)), y: 40 + i * (580 / Math.max(1, nodes.length - 1) || 0) }; });
    });
    const NSVG = "http://www.w3.org/2000/svg";
    const sel = UI.S.graphSel;
    let edgesHtml = "";
    for (const e of g.edges) {
      if (!pos[e.from] || !pos[e.to]) continue;
      const active = sel && (e.from === sel || e.to === sel);
      if (!active && sel) continue;
      if (!sel && !["connects", "powered_by", "located_in"].includes(e.rel)) continue;
      const a = pos[e.from], b = pos[e.to];
      edgesHtml += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="ge ${active ? "on" : ""}"/>`;
      if (active) edgesHtml += `<text x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 3}" class="gel">${esc(e.rel)}</text>`;
    }
    let nodesHtml = "";
    for (const [id, p] of Object.entries(pos)) {
      const n = g.get(id);
      const dim = sel && id !== sel && !g.neighbors(sel).some((e) => e.from === id || e.to === id);
      nodesHtml += `<g class="gn ${dim ? "dim" : ""} ${id === sel ? "sel" : ""}" data-id="${id}"><circle cx="${p.x}" cy="${p.y}" r="${n.type === "organization" ? 7 : 5}"/><text x="${p.x + 10}" y="${p.y + 3}">${esc(n.name.slice(0, 24))}</text></g>`;
    }
    svg.innerHTML = edgesHtml + nodesHtml;
    $$("#graph-svg .gn").forEach((n) => n.addEventListener("click", () => {
      UI.S.graphSel = UI.S.graphSel === n.dataset.id ? null : n.dataset.id;
      UI.rGraph();
      if (UI.S.graphSel) UI.inspectEntity(UI.S.graphSel);
    }));
  };

  // ---------- data & calibration ----------
  UI.rData = function () {
    const d = OBS.store.data;
    $("#view-data").innerHTML = `
      <div class="toolbar"><h2>Data & calibration</h2></div>
      <div class="banner slim">Every value in this platform carries a source. Defaults are engine assumptions; imports and calibrations replace them and are logged.</div>
      <h3 class="sec">SOURCE MAP — model parameters</h3>
      <table class="tbl"><thead><tr><th>Parameter</th><th>Active value</th><th>Default</th><th>Source</th></tr></thead><tbody>
        ${OBS.world.PARAMS.map((p) => {
          const ov = d.paramOverrides[p.key];
          return `<tr><td>${esc(p.label)}</td><td><b>${ov ?? p.value}</b> ${esc(p.unit)}</td><td class="muted">${p.value}</td><td>${ov != null ? '<span class="badge ok">calibrated/user</span>' : `<span class="badge">${esc(p.source.kind)}</span>`}</td></tr>`;
        }).join("")}
      </tbody></table>
      <h3 class="sec">IMPORT DATA (CSV)</h3>
      <div class="panel-box">
        <p class="muted">Businesses: <code>id,name,sector,nb,jobs,wage,priceLevel,quality,capacityDaily,fixedDaily</code> — updates or adds organizations (source recorded as csv-import).<br>
        Actuals for calibration: <code>day,value</code> for one metric.</p>
        <select class="sel" id="imp-kind"><option value="businesses">businesses</option><option value="actuals">calibration actuals</option></select>
        <select class="sel" id="imp-metric">${OBS.METRICS.map((m) => `<option value="${m.id}">${esc(m.label)}</option>`).join("")}</select>
        <textarea class="inp" id="imp-csv" rows="5" placeholder="paste CSV here"></textarea>
        <button class="btn" id="imp-apply" ${OBS.can("analyst") ? "" : "disabled"}>Import</button>
        <span class="muted">${d.imports.length} import(s) applied this workspace</span>
      </div>
      <h3 class="sec">CALIBRATION</h3>
      <div class="panel-box">
        <p class="muted">Procedure: import actuals above → run the baseline over the same window → compare (MAPE) → adjust parameters → re-run → save. Uncalibrated worlds should be treated as directional only.</p>
        <button class="btn" id="cal-run">Run baseline vs actuals</button>
        <div id="cal-out"></div>
        <h4>Adjust parameters</h4>
        <div id="cal-sliders">${OBS.world.PARAMS.slice(0, 8).map((p) => {
          const v = d.paramOverrides[p.key] ?? p.value;
          return `<div class="cal-row"><label>${esc(p.label)}</label><input type="range" data-k="${p.key}" min="${p.value * 0.4}" max="${p.value * 2}" step="${p.value / 50}" value="${v}"><span class="mono" id="cal-v-${p.key}">${OBS.round(v, 3)}</span></div>`;
        }).join("")}</div>
        <button class="btn primary" id="cal-save" ${OBS.can("analyst") ? "" : "disabled"}>Save calibration</button>
        <span class="muted">${d.calibrations.length} calibration(s) recorded</span>
      </div>`;
    $$("#cal-sliders input").forEach((s) => s.oninput = () => { $("#cal-v-" + s.dataset.k).textContent = OBS.round(+s.value, 3); });
    $("#imp-apply").onclick = () => {
      const kind = $("#imp-kind").value, csv = $("#imp-csv").value.trim();
      if (!csv) return;
      try {
        const rows = csv.split(/\n+/).map((l) => l.split(",").map((x) => x.trim()));
        if (kind === "businesses") {
          const hdr = rows[0].map((h) => h.toLowerCase());
          const recs = [];
          for (const r of rows.slice(1)) {
            const rec = Object.fromEntries(hdr.map((h, i) => [h, r[i]]));
            if (!rec.id) continue;
            OBS.app.applyBusinessImport(rec); recs.push(rec);
          }
          const n = recs.length;
          d.imports.push({ at: new Date().toISOString(), kind, records: recs });
          OBS.audit("data_imported", `businesses: ${n} rows`);
          UI.toast(`Imported ${n} organizations (source: csv-import). Baseline preview refreshing…`);
          OBS.app.refreshBaseline();
        } else {
          const metric = $("#imp-metric").value;
          const vals = rows.filter((r) => r.length >= 2 && !isNaN(+r[1])).map((r) => ({ day: +r[0], value: +r[1] }));
          d.imports.push({ at: new Date().toISOString(), kind: "actuals", metric, values: vals });
          OBS.audit("data_imported", `actuals: ${metric}, ${vals.length} points`);
          UI.toast(`Stored ${vals.length} actuals for ${metric}.`);
        }
        OBS.store.save(); UI.rData();
      } catch (e2) { UI.toast("Import failed: " + e2.message, "bad"); }
    };
    $("#cal-run").onclick = async () => {
      const act = [...d.imports].reverse().find((i) => i.kind === "actuals");
      if (!act) return UI.toast("Import calibration actuals first.", "bad");
      $("#cal-out").innerHTML = "<p class='muted'>running baseline…</p>";
      const horizon = Math.max(...act.values.map((v) => v.day));
      const spec = OBS.scenario.newSpec({ name: "calibration", horizonDays: horizon, seeds: 3, metrics: [act.metric], headlineMetric: act.metric });
      spec.reviewed = true;
      const paramTrial = {};
      $$("#cal-sliders input").forEach((s) => paramTrial[s.dataset.k] = +s.value);
      spec.paramOverrides = paramTrial;
      const res = await OBS.scenario.run(spec, () => {});
      const med = res.branches.baseline.agg[act.metric].med;
      const pred = act.values.map((v) => med[v.day - 1]);
      const mape = OBS.stat.mape(pred, act.values.map((v) => v.value));
      UI._calTrial = { paramTrial, mape, metric: act.metric };
      $("#cal-out").innerHTML = "";
      OBS.charts.line($("#cal-out"), {
        title: `Baseline vs actuals — ${OBS.metricDef(act.metric).label} (MAPE ${mape == null ? "n/a" : mape.toFixed(1) + "%"})`,
        fmt: OBS.metricDef(act.metric).fmt, height: 220,
        series: [
          { name: "model (median)", med, p10: res.branches.baseline.agg[act.metric].p10, p90: res.branches.baseline.agg[act.metric].p90 },
          { name: "actuals", color: "var(--s2)", med: Array.from({ length: horizon }, (_, i) => act.values.find((v) => v.day === i + 1)?.value ?? null) },
        ],
      });
    };
    $("#cal-save").onclick = () => {
      if (!UI._calTrial) return UI.toast("Run a comparison first.", "bad");
      Object.assign(d.paramOverrides, UI._calTrial.paramTrial);
      d.calibrations.push({ at: new Date().toISOString(), metric: UI._calTrial.metric, mape: UI._calTrial.mape, params: UI._calTrial.paramTrial });
      OBS.store.save();
      OBS.audit("calibration_saved", `${UI._calTrial.metric} MAPE ${UI._calTrial.mape?.toFixed(1)}%`);
      UI.toast("Calibration saved — parameters now carry 'calibrated/user' provenance.");
      OBS.app.refreshBaseline(); UI.rData();
    };
  };

  // ---------- reports ----------
  UI.rReports = function () {
    const d = OBS.store.data;
    const cur = d.reports.find((r) => r.id === UI.S.reportId) || d.reports[d.reports.length - 1];
    $("#view-reports").innerHTML = `
      <div class="toolbar"><h2>Reports</h2>
        ${d.reports.map((r) => `<button class="btn small ${cur && r.id === cur.id ? "on" : ""}" data-rp="${r.id}">${esc(r.name.slice(0, 26))}</button>`).join("")}
        ${cur ? `<button class="btn" id="rp-print">print / PDF</button><button class="btn" id="rp-dl">export JSON</button><button class="btn small danger" id="rp-del">delete</button>` : ""}</div>
      ${cur ? `<div id="report-host">${cur.html}</div>` : "<p class='muted pad'>No reports yet. Generate one from a scenario's results.</p>"}`;
    $$("#view-reports [data-rp]").forEach((b) => b.onclick = () => { UI.S.reportId = b.dataset.rp; UI.rReports(); });
    if (cur) {
      $("#rp-print").onclick = () => { document.body.classList.add("printing"); window.print(); setTimeout(() => document.body.classList.remove("printing"), 500); };
      $("#rp-dl").onclick = () => {
        const blob = new Blob([JSON.stringify(cur, null, 1)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = OBS.slug(cur.name) + ".nexus-report.json"; a.click();
      };
      $("#rp-del").onclick = () => { d.reports = d.reports.filter((r) => r.id !== cur.id); OBS.store.save(); UI.rReports(); };
    }
  };

  // ---------- audit ----------
  UI.rAudit = function () {
    const rows = [...OBS.store.data.audit].reverse();
    $("#view-audit").innerHTML = `
      <div class="toolbar"><h2>Audit log</h2><span class="muted">${rows.length} entries · append-only · local workspace</span></div>
      <table class="tbl"><thead><tr><th>When</th><th>Role</th><th>Action</th><th>Detail</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td class="mono">${esc(r.at.replace("T", " ").slice(0, 19))}</td><td>${esc(r.role)}</td><td><b>${esc(r.action)}</b></td><td class="muted">${esc(r.detail)}</td></tr>`).join("") || "<tr><td colspan=4 class='muted'>empty</td></tr>"}
      </tbody></table>`;
  };

  // ---------- settings ----------
  UI.rSettings = function () {
    const s = OBS.store.data.settings;
    $("#view-settings").innerHTML = `
      <div class="toolbar"><h2>Settings</h2></div>
      <div class="panel-box">
        <h3 class="sec">WORKSPACE</h3>
        <label class="setrow">Role (client-side gate — see limitations)
          <select class="sel" id="set-role">${["viewer", "analyst", "admin"].map((r) => `<option ${s.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></label>
        <label class="setrow">Default seeded runs per branch <input class="inp num" id="set-seeds" type="number" min="1" max="25" value="${s.seeds}"></label>
      </div>
      <div class="panel-box">
        <h3 class="sec">COPILOT (optional)</h3>
        <label class="setrow">Anthropic API key <input class="inp" id="set-key" type="password" value="${esc(OBS.copilot.getKey())}" placeholder="sk-ant-…"></label>
        <label class="setrow">Model <select class="sel" id="set-model">${["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"].map((m) => `<option ${s.copilotModel === m ? "selected" : ""}>${m}</option>`).join("")}</select></label>
        <p class="muted">Used only for: parsing plain-language scenarios into specs, and writing evidence-grounded briefs. The engine itself never calls a model. Key stays in this browser; sent only to api.anthropic.com.</p>
      </div>
      <div class="panel-box">
        <h3 class="sec">ETHICS & SCOPE (always on)</h3>
        <ul class="muted" style="line-height:1.9;margin-left:18px">
          <li>Population is synthetic/aggregated; agents are labeled and never mapped to real persons.</li>
          <li>No sensitive-trait inference; cohorts carry income band + geography only.</li>
          <li>Distributional (winners/losers) analysis is included in every report.</li>
          <li>Assumption changes, imports, calibrations, runs and reports are audit-logged with role.</li>
          <li>NEXUS informs human decisions; it does not automate decisions about individuals.</li>
        </ul>
      </div>
      <div class="panel-box">
        <button class="btn danger" id="set-reset" ${OBS.can("admin") ? "" : "disabled title='admin role required'"}>Reset workspace (scenarios, reports, calibrations, audit)</button>
      </div>`;
    $("#set-role").onchange = (e) => { s.role = e.target.value; OBS.store.save(); OBS.audit("role_changed", s.role); UI.render(); };
    $("#set-seeds").onchange = (e) => { s.seeds = OBS.clamp(+e.target.value || 7, 1, 25); OBS.store.save(); };
    $("#set-key").onchange = (e) => { OBS.copilot.setKey(e.target.value); UI.toast(e.target.value ? "Copilot enabled." : "Copilot disabled."); };
    $("#set-model").onchange = (e) => { s.copilotModel = e.target.value; OBS.store.save(); };
    $("#set-reset").onclick = () => { if (confirm("Erase all local workspace data?")) OBS.store.reset(); };
  };
})();
