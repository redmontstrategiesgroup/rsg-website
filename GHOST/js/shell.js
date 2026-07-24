/* ============================================================
   GHOST // shell.js — app bar, view router, and the real views:
   World Model · Command pipeline · Devices · Approvals · Audit
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const { h, $, clear, mount } = G;
  const S = G.store, W = G.world, P = G.planner, O = G.orch;

  const NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, kids) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) { if (k === "on") continue; if (k.startsWith("on") && typeof attrs[k] === "function") el.addEventListener(k.slice(2), attrs[k]); else el.setAttribute(k, attrs[k]); }
    (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach((c) => el.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return el;
  }

  const VIEWS = [
    { id: "ops", ic: "📡", label: "Live Ops" },
    { id: "command", ic: "❯", label: "Command" },
    { id: "world", ic: "🗺️", label: "World Model" },
    { id: "devices", ic: "🖥️", label: "Devices" },
    { id: "approvals", ic: "✓", label: "Approvals" },
    { id: "audit", ic: "🧾", label: "Audit" },
  ];
  let activeView = "ops";
  let currentPlan = null;
  let selectedEntity = null;
  const refs = {};

  /* ============================================================ APP BAR */
  function buildAppbar() {
    refs.tabs = {};
    const tabs = h("div", { class: "vtabs" }, VIEWS.map((v) => {
      const badge = v.id === "approvals" ? h("span", { class: "badge", style: { display: "none" } }, "0") : null;
      const el = h("button", { class: "vtab" + (v.id === activeView ? " active" : ""), onclick: () => nav(v.id) }, [
        h("span", { class: "ic" }, v.ic), h("span", { class: "lbl" }, v.label), badge,
      ]);
      refs.tabs[v.id] = el; if (badge) refs.apprBadge = badge;
      return el;
    }));

    refs.gcmd = h("input", { placeholder: "Tell GHOST what needs to happen…", onkeydown: (e) => { if (e.key === "Enter") submitCommand(); } });
    refs.ohToggle = h("button", { class: "oh-toggle", onclick: toggleOnehand }, [h("span", null, "✋"), h("span", null, "OneHand")]);

    mount($("#appbar"), [
      h("div", { class: "brand2" }, [
        h("div", { class: "mk" }, "👻"),
        h("div", null, [h("div", { class: "wm" }, "GHOST"), h("div", { class: "full" }, "Hardware Orchestration & Systems Terminal")]),
      ]),
      tabs,
      h("div", { class: "gcmd" }, [h("span", { class: "pr" }, "❯"), refs.gcmd, h("button", { class: "go", onclick: submitCommand }, "PLAN")]),
      h("div", { class: "appbar-right" }, [
        refs.ohToggle,
        h("button", { class: "kill2", title: "Halt all agents & power down fleet", onclick: () => G.ui.emergency() }, [h("span", { class: "g" }), h("span", null, "STOP")]),
      ]),
    ]);
  }

  function submitCommand() {
    const v = refs.gcmd.value.trim(); if (!v) return;
    currentPlan = P.plan(v);
    refs.gcmd.value = "";
    renderPlan(currentPlan);
    renderRun();
    nav("command");
    G.bus.emit("toast", { kind: "ok", ic: "❯", text: `Plan drafted — ${currentPlan.steps.length} steps, max impact L${currentPlan.maxImpact}.` });
  }

  function toggleOnehand() {
    if (G.onehand.isActive()) G.onehand.deactivate();
    else G.onehand.activate(G.onehand.defaultProfile());
  }

  /* ============================================================ ROUTER */
  function nav(view) {
    activeView = view;
    VIEWS.forEach((v) => { const el = $("#view-" + v.id); if (el) el.hidden = v.id !== view; });
    Object.entries(refs.tabs).forEach(([id, el]) => el.classList.toggle("active", id === view));
    S.setting("activeView", view);
    if (view === "world") renderWorld();
    if (view === "devices") renderDevices();
    if (view === "approvals") renderApprovals();
    if (view === "audit") renderAudit();
    if (view === "command") renderRun();
  }

  /* ============================================================ COMMAND VIEW */
  function buildCommandView() {
    refs.planBody = h("div", { class: "card-b" });
    refs.planActions = h("div", { class: "plan-actions" });
    refs.runCard = h("div", { class: "run-card" });
    const demos = h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } }, [
      demoChip("Investigate why the site is slow"),
      demoChip("Deploy the roofing site to production"),
      demoChip("Move qualified leads and follow up on missed calls"),
      demoChip("Start my dev workspace across both computers, one-handed"),
      demoChip("Build a workflow: when a lead misses a call, text them and notify the crew"),
      demoChip("Check last night's backups"),
    ]);
    mount($("#view-command"), h("div", { class: "view-inner" }, [
      h("div", { class: "view-head" }, [h("h2", null, "Command"), h("span", { class: "sub" }, "Every directive becomes a visible plan → approval → execution → verification."), h("span", { class: "spacer" }), demos]),
      h("div", { class: "cmd-grid" }, [
        h("div", { class: "plan-card" }, [h("div", { class: "card-h" }, "Execution Plan"), refs.planBody, refs.planActions]),
        refs.runCard,
      ]),
    ]));
    renderPlan(null); renderRun();
  }
  function demoChip(text) { return h("button", { class: "k-chip", onclick: () => { currentPlan = P.plan(text); renderPlan(currentPlan); renderRun(); nav("command"); } }, text); }

  function impactChip(lvl) {
    const m = P.IMPACT[lvl];
    return h("span", { class: "impact-chip", style: { background: "color-mix(in srgb," + m.color + " 18%, transparent)", color: m.color, border: "1px solid " + m.color } }, "L" + lvl + " " + m.name);
  }

  function renderPlan(plan) {
    clear(refs.planBody); clear(refs.planActions);
    if (!plan) { refs.planBody.appendChild(h("div", { class: "ent-empty" }, "Type a directive above (or pick a demo) to generate a plan.")); return; }
    refs.planBody.appendChild(h("div", { class: "plan-goal" }, plan.goal));
    refs.planBody.appendChild(h("div", { class: "plan-meta" }, [
      h("span", { class: "k-chip mode" }, plan.mode.toUpperCase()),
      h("span", { class: "k-chip" }, "max impact L" + plan.maxImpact),
      plan.approvalRequired ? h("span", { class: "k-chip warn" }, "approval required") : h("span", { class: "k-chip" }, "no approval"),
      plan.irreversibleCount ? h("span", { class: "k-chip warn" }, plan.irreversibleCount + " irreversible") : null,
      h("span", { class: "k-chip" }, "~" + plan.resource.estSeconds + "s · " + G.compact(plan.resource.estTokens) + " tok · " + G.money(plan.resource.estCost)),
    ]));
    if (plan.systems.length) refs.planBody.appendChild(h("div", null, [h("div", { class: "block-t" }, "Systems involved"),
      h("div", { class: "sys-chips" }, plan.systems.map((id) => h("span", { class: "k-chip" }, (W.entity(id) ? (W.entity(id).ico || "") + " " + W.entity(id).name : id))))]));
    if (plan.risks.length) refs.planBody.appendChild(h("div", null, [h("div", { class: "block-t" }, "Risks"),
      h("div", { class: "risk-list" }, plan.risks.map((r) => h("div", { class: "risk" }, [h("span", null, "⚠"), h("span", null, r)])))]));
    refs.planBody.appendChild(h("div", null, [h("div", { class: "block-t" }, "Plan · " + plan.steps.length + " steps"),
      h("div", { class: "plan-steps" }, plan.steps.map((st) => h("div", { class: "pstep" }, [
        impactChip(st.impact), h("span", null, st.title), h("span", { class: "agent", title: "verified against real state" }, (G.DATA.agents[st.agent] ? G.DATA.agents[st.agent].name : st.agent))])))]));
    refs.planBody.appendChild(h("div", { style: { fontSize: "10px", color: "var(--text-faint)" } }, "✓ " + plan.verificationSummary));

    const executing = plan.status === "executing" || plan.status === "completed";
    refs.planActions.appendChild(h("button", { class: "btn primary", disabled: plan.maxImpact >= 4 || executing, onclick: () => { O.start(plan); nav("command"); } }, executing ? "Executing…" : "▸ Execute Plan"));
    refs.planActions.appendChild(h("button", { class: "btn ghost", onclick: () => { currentPlan = null; renderPlan(null); } }, "Discard"));
  }

  function renderRun() {
    const card = refs.runCard; if (!card) return; clear(card);
    card.appendChild(h("div", { class: "card-h" }, [h("span", null, "Agent Orchestration"), h("span", { style: { marginLeft: "auto", fontSize: "9px", color: "var(--text-faint)" } }, "bounded agents · independent verification")]));
    const run = O.current || latestRun();
    if (!run) { card.appendChild(h("div", { class: "run-empty" }, "No active run.\nGenerate a plan and press Execute to coordinate agents.")); return; }
    const tasks = run.taskIds.map((id) => S.get("tasks", id)).filter(Boolean);
    const done = tasks.filter((t) => ["completed", "completed_warn", "rolled_back"].includes(t.status)).length;

    card.appendChild(h("div", { class: "run-status-strip" }, [
      statStrip("Status", run.status.replace(/_/g, " ")),
      statStrip("Tasks", done + "/" + tasks.length),
      statStrip("Verified", String(run.metrics.verifications)),
      statStrip("Approvals", String(run.metrics.approvals)),
      run.status === "completed" || run.status === "completed_warn"
        ? h("button", { class: "btn ghost", style: { marginLeft: "auto", padding: "5px 10px", fontSize: "9px" }, onclick: () => O.rollback(run.id) }, "↺ Rollback")
        : (O.current ? h("button", { class: "btn danger", style: { marginLeft: "auto", padding: "5px 10px", fontSize: "9px" }, onclick: () => O.cancel() }, "Cancel") : null),
    ]));

    const pending = S.query("approvals", (a) => a.runId === run.id && a.status === "pending")[0];
    if (pending) card.appendChild(h("div", { style: { margin: "10px 14px" } }, [
      h("div", { class: "approval-banner" }, "⏸ " + pending.prompt),
      h("div", { class: "appr-actions", style: { marginTop: "8px" } }, [
        h("button", { class: "btn approve", onclick: () => O.approve(pending.id) }, "✓ Approve"),
        h("button", { class: "btn reject", onclick: () => O.reject(pending.id) }, "✕ Reject"),
      ]),
    ]));

    const dag = h("div", { class: "dag" });
    tasks.forEach((t, i) => {
      const vr = t.verificationId ? S.get("verifications", t.verificationId) : null;
      const knob = ["completed", "completed_warn"].includes(t.status) ? "✓" : t.status === "failed" ? "✕" : t.status === "awaiting_approval" ? "⏸" : ["running", "verifying"].includes(t.status) ? "●" : (i + 1);
      dag.appendChild(h("div", { class: "task " + t.status }, [
        h("div", { class: "spine" }, [h("div", { class: "knob" }, String(knob)), h("div", { class: "conn" })]),
        h("div", { class: "body" }, [
          h("div", { class: "title" }, [h("span", null, t.title), statusPill(t.status)]),
          h("div", { class: "detail" }, t.detail),
          h("div", { class: "agent-tool" }, (G.DATA.agents[t.agent] ? G.DATA.agents[t.agent].name : t.agent) + " · " + t.tool + " · impact L" + t.impact + (t.reversible ? " · reversible" : " · irreversible")),
          vr ? h("div", { class: "verify " + (vr.passed ? (t.status === "completed_warn" ? "warn" : "pass") : "fail") }, [
            h("span", null, vr.passed ? "✓" : "✕"),
            h("div", null, [h("span", null, (vr.passed ? "Verified" : "Verification failed") + " — " + vr.evidence), h("div", { class: "m" }, "method: " + vr.method)]),
          ]) : (t.status === "verifying" ? h("div", { class: "verify" }, "⟳ verifying against real state…") : null),
        ]),
      ]));
    });
    card.appendChild(dag);
  }
  function statStrip(k, v) { return h("div", { class: "s" }, [h("span", null, k), h("b", null, v)]); }
  function statusPill(st) {
    const map = { completed: ["var(--ok)", "done"], completed_warn: ["var(--warn)", "warn"], running: ["var(--cyan)", "running"], verifying: ["var(--cyan)", "verifying"], awaiting_approval: ["var(--warn)", "needs approval"], failed: ["var(--danger)", "failed"], blocked: ["var(--idle)", "blocked"], pending: ["var(--idle)", "queued"], rolled_back: ["var(--idle)", "rolled back"], cancelled: ["var(--idle)", "cancelled"] };
    const [c, l] = map[st] || ["var(--idle)", st];
    return h("span", { class: "st-pill", style: { background: "color-mix(in srgb," + c + " 16%, transparent)", color: c } }, l);
  }
  function latestRun() { const r = S.all("runs"); return r.sort((a, b) => b.startedAt - a.startedAt)[0]; }

  /* ============================================================ WORLD VIEW */
  const CAT_COL = { user: 0, environment: 0, device: 1, camera: 1, repo: 2, integration: 2, credential: 2, deployment: 3, service: 3, database: 3, client: 4, workflow: 4, lead: 4, incident: 4, message: 4 };
  const NODE_W = 130, NODE_H = 34, COL_X = 210, V_GAP = 46;
  let nodePos = {};

  function buildWorldView() {
    refs.worldAnswer = h("div", { class: "world-answer" });
    refs.worldQ = h("input", { placeholder: "Ask the graph…  e.g. “what breaks if the database goes offline?”  ·  “what has access to production?”", onkeydown: (e) => { if (e.key === "Enter") runWorldQuery(); } });
    refs.graphHolder = h("div", { class: "graph-holder" }, [h("div", { class: "gq-hint" }, "click any node to trace dependencies & blast radius")]);
    refs.entDetail = h("div", { class: "ent-detail" });
    mount($("#view-world"), h("div", { class: "view-inner" }, [
      h("div", { class: "view-head" }, [h("h2", null, "World Model"), h("span", { class: "sub" }, W.entities().length + " entities · " + W.edges().length + " relationships (stored & queryable)")]),
      h("div", { class: "world-grid" }, [
        h("div", { class: "world-main" }, [
          h("div", { class: "world-q" }, [refs.worldQ, h("button", { class: "go", onclick: runWorldQuery }, "ASK")]),
          refs.worldAnswer,
          refs.graphHolder,
        ]),
        refs.entDetail,
      ]),
    ]));
    renderEntDetail(null);
  }

  function renderWorld() { drawGraph(); if (selectedEntity) selectEntity(selectedEntity, true); }

  function drawGraph(highlight) {
    const ents = W.entities().filter((e) => CAT_COL[e.type] != null);
    const cols = {};
    ents.forEach((e) => { const c = CAT_COL[e.type]; (cols[c] = cols[c] || []).push(e); });
    const maxCount = Math.max(...Object.values(cols).map((a) => a.length), 1);
    const H = maxCount * V_GAP + 30, Wd = 5 * COL_X + 30;
    nodePos = {};
    Object.keys(cols).forEach((c) => {
      const list = cols[c]; const startY = (H - list.length * V_GAP) / 2 + 10;
      list.forEach((e, i) => { nodePos[e.id] = { x: (+c) * COL_X + 20, y: startY + i * V_GAP, w: NODE_W, h: NODE_H }; });
    });

    const svg = s("svg", { viewBox: `0 0 ${Wd} ${H}`, preserveAspectRatio: "xMidYMid meet" });
    // edges first
    const eg = s("g");
    W.edges().forEach((e) => {
      const a = nodePos[e.from], b = nodePos[e.to]; if (!a || !b) return;
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      const mx = (x1 + x2) / 2;
      let cls = "gedge"; if (W.ACCESS_RELS.includes(e.rel)) cls += " access";
      if (highlight) { if (highlight.blast && highlight.blast.has(e.from) && highlight.blast.has(e.to)) cls += " hi-blast"; else if (highlight.dep && highlight.dep.has(e.from) && highlight.dep.has(e.to)) cls += " hi-dep"; }
      eg.appendChild(s("path", { class: cls, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` }));
    });
    svg.appendChild(eg);
    // nodes
    ents.forEach((e) => {
      const p = nodePos[e.id];
      let cls = "gnode";
      if (highlight) { if (e.id === highlight.sel) cls += " sel"; else if (highlight.blast && highlight.blast.has(e.id)) cls += " blast"; else if (highlight.dep && highlight.dep.has(e.id)) cls += " dep"; else if (highlight.dim) cls += " dim"; }
      const st = e.status === "offline" ? "danger" : e.status === "degraded" ? "warn" : (e.connected === false) ? "idle" : "ok";
      const g = s("g", { class: cls, transform: `translate(${p.x},${p.y})`, onclick: () => selectEntity(e.id) });
      g.appendChild(s("rect", { width: p.w, height: p.h, rx: 6 }));
      g.appendChild(s("circle", { class: "gdot " + st, cx: 10, cy: p.h / 2, r: 3 }));
      g.appendChild(s("text", { class: "nm", x: 18, y: 15 }, trunc((e.ico ? e.ico + " " : "") + e.name, 18)));
      g.appendChild(s("text", { class: "ty", x: 18, y: 26 }, e.type));
      svg.appendChild(g);
    });
    clear(refs.graphHolder);
    refs.graphHolder.appendChild(svg);
    refs.graphHolder.appendChild(h("div", { class: "gq-hint" }, "click any node to trace dependencies & blast radius"));
  }
  function trunc(s2, n) { return s2.length > n ? s2.slice(0, n - 1) + "…" : s2; }

  function selectEntity(id, keep) {
    selectedEntity = id;
    const blast = new Set(W.blastRadius(id)); const dep = new Set(W.dependencies(id));
    drawGraph({ sel: id, blast, dep, dim: true });
    renderEntDetail(id, blast, dep);
  }

  function renderEntDetail(id, blast, dep) {
    const el = refs.entDetail; clear(el);
    if (!id) { el.appendChild(h("div", { class: "ent-empty" }, "Select a system to inspect its relationships, dependencies, and blast radius.")); return; }
    const e = W.entity(id); if (!e) return;
    blast = blast || new Set(W.blastRadius(id)); dep = dep || new Set(W.dependencies(id));
    const access = W.accessTo(id);
    el.appendChild(h("div", { class: "eh" }, [h("div", { class: "nm" }, (e.ico || "") + " " + e.name), h("div", { class: "ty" }, e.type)]));
    const b = h("div", { class: "eb" });
    // fields
    const fields = ["status", "os", "url", "provider", "connection", "tier", "stage", "score", "role"].filter((f) => e[f] != null);
    if (fields.length) b.appendChild(h("div", { class: "ent-block" }, [h("div", { class: "t" }, "Properties"),
      ...fields.map((f) => h("div", { class: "row" }, [h("span", null, f), h("span", { style: { color: "var(--text)" } }, String(e[f]))]))]));
    // blast radius
    b.appendChild(h("div", { class: "ent-block" }, [h("div", { class: "t" }, "Blast radius — breaks if offline"),
      h("div", { style: { display: "flex", alignItems: "baseline", gap: "8px" } }, [h("span", { class: "blast-big" }, String(blast.size)), h("span", { style: { fontSize: "10px", color: "var(--text-faint)" } }, "dependent system(s)")]),
      ...[...blast].map((x) => h("div", { class: "ent-rel" }, [h("span", { class: "r" }, "↑"), h("span", null, W.label(x))]))]));
    // dependencies
    if (dep.size) b.appendChild(h("div", { class: "ent-block" }, [h("div", { class: "t" }, "Depends on"),
      ...[...dep].map((x) => h("div", { class: "ent-rel" }, [h("span", { class: "r" }, "↓"), h("span", null, W.label(x))]))]));
    // access
    if (access.length) b.appendChild(h("div", { class: "ent-block" }, [h("div", { class: "t" }, "Access / authorization"),
      ...access.map((x) => h("div", { class: "ent-rel" }, [h("span", { class: "r" }, "🔑"), h("span", null, W.label(x))]))]));
    el.appendChild(b);
  }

  function runWorldQuery() {
    const q = refs.worldQ.value.trim(); if (!q) return;
    const res = W.nlQuery(q);
    refs.worldAnswer.classList.add("show");
    clear(refs.worldAnswer);
    refs.worldAnswer.appendChild(h("div", null, [h("b", null, res.summary)]));
    if (res.list && res.list.length) refs.worldAnswer.appendChild(h("div", { style: { marginTop: "4px", fontSize: "11px" } }, res.list.slice(0, 12).join("  ·  ")));
    if (res.target) { selectEntity(res.target); }
    else if (res.nodes && res.nodes.length) { const set = new Set(res.nodes); selectedEntity = null; drawGraph({ blast: set, dim: true }); }
  }

  /* ============================================================ DEVICES VIEW */
  function buildDevicesView() {
    refs.devBody = h("div", { class: "dev-table" });
    mount($("#view-devices"), h("div", { class: "view-inner" }, [
      h("div", { class: "view-head" }, [h("h2", null, "Device Registry"), h("span", { class: "sub" }, "Every action labels its real control method — API, SSH, RDP, KVM, or vision.")]),
      refs.devBody,
    ]));
  }
  function renderDevices() {
    const devs = W.entities().filter((e) => e.type === "device" || e.type === "camera");
    const tbl = h("table", { class: "dt" }, [
      h("thead", null, h("tr", null, ["Device", "OS / Type", "Control Method", "Capabilities", "Status", "Reachable", ""].map((th) => h("th", null, th)))),
      h("tbody", null, devs.map((d) => h("tr", null, [
        h("td", null, h("div", { class: "name" }, [h("span", null, d.ico || "🖥️"), h("span", null, d.name)])),
        h("td", null, d.os || d.type),
        h("td", null, h("span", { class: "method-badge" }, d.connection || "—")),
        h("td", null, (d.capabilities || []).map((c) => h("span", { class: "cap" }, c))),
        h("td", null, h("span", { class: "name" }, [h("span", { class: "dot " + (d.status === "offline" ? "danger" : "ok") }), d.status || "online"])),
        h("td", null, d.reachable ? "yes" : "no"),
        h("td", null, h("div", { class: "act" }, [
          h("button", { onclick: () => deviceAction(d, "wake") }, "Wake"),
          h("button", { onclick: () => deviceAction(d, "probe") }, "Probe"),
        ])),
      ]))),
    ]);
    clear(refs.devBody); refs.devBody.appendChild(tbl);
  }
  function deviceAction(d, kind) {
    if (kind === "wake") {
      S.patch("entities", d.id, { status: "online", reachable: true });
      S.audit({ type: "device.wake", actor: "INFRA", summary: `Woke ${d.name} via ${d.connection} (reversible).` });
      G.bus.emit("toast", { kind: "ok", ic: "⏻", text: `${d.name} online.` });
    } else {
      S.audit({ type: "device.probe", actor: "VISION", summary: `Probed ${d.name} — ${d.reachable ? "reachable" : "unreachable"} via ${d.connection}.` });
      G.bus.emit("toast", { kind: "ok", ic: "📡", text: `${d.name} — ${d.reachable ? "reachable" : "unreachable"} (${d.connection}).` });
    }
    renderDevices();
  }

  /* ============================================================ APPROVALS VIEW */
  function buildApprovalsView() {
    refs.apprBody = h("div", { class: "appr-list" });
    mount($("#view-approvals"), h("div", { class: "view-inner" }, [
      h("div", { class: "view-head" }, [h("h2", null, "Approvals"), h("span", { class: "sub" }, "High-impact and irreversible actions hold here until you decide.")]),
      refs.apprBody,
    ]));
  }
  function renderApprovals() {
    const pend = S.query("approvals", (a) => a.status === "pending").sort((a, b) => b.ts - a.ts);
    const resolved = S.query("approvals", (a) => a.status !== "pending").sort((a, b) => (b.resolvedAt || 0) - (a.resolvedAt || 0)).slice(0, 8);
    clear(refs.apprBody);
    if (!pend.length && !resolved.length) { refs.apprBody.appendChild(h("div", { class: "appr-empty" }, "No approvals requested. High-impact steps will appear here.")); }
    pend.forEach((a) => refs.apprBody.appendChild(h("div", { class: "appr-card" }, [
      h("div", { class: "ah" }, [impactChip(a.impact), h("span", { class: "t" }, a.title), h("span", { style: { marginLeft: "auto", fontSize: "9px", color: "var(--text-faint)" } }, a.reversible ? "reversible" : "IRREVERSIBLE")]),
      h("div", { class: "prompt" }, a.detail),
      h("div", { class: "appr-actions" }, [
        h("button", { class: "btn approve", onclick: () => O.approve(a.id) }, "✓ Approve"),
        h("button", { class: "btn reject", onclick: () => O.reject(a.id) }, "✕ Reject"),
      ]),
    ])));
    resolved.forEach((a) => refs.apprBody.appendChild(h("div", { class: "appr-card resolved" }, [
      h("div", { class: "ah" }, [impactChip(a.impact), h("span", { class: "t" }, a.title), h("span", { style: { marginLeft: "auto", fontSize: "10px", color: a.status === "approved" ? "var(--ok)" : "var(--danger-bright)" } }, a.status.toUpperCase())]),
    ])));
    updateApprBadge();
  }
  function updateApprBadge() {
    const n = S.query("approvals", (a) => a.status === "pending").length;
    if (refs.apprBadge) { refs.apprBadge.textContent = n; refs.apprBadge.style.display = n ? "grid" : "none"; }
  }

  /* ============================================================ AUDIT VIEW */
  function buildAuditView() {
    refs.auditBody = h("div", { class: "audit-list" });
    mount($("#view-audit"), h("div", { class: "view-inner" }, [
      h("div", { class: "view-head" }, [h("h2", null, "Audit & Verification"), h("span", { class: "sub" }, "Append-only. Every plan, approval, action, and verification is recorded.")]),
      refs.auditBody,
    ]));
  }
  const AT_CLASS = (t) => t.startsWith("plan") ? "at-plan" : t.startsWith("run") ? "at-run" : t.startsWith("approval") ? "at-approval" : t === "verify.failed" ? "at-verifyfail" : t.startsWith("verify") ? "at-verify" : "at-sys";
  function auditRow(rec) {
    return h("div", { class: "audit-row" }, [
      h("span", { class: "ts" }, G.clock(new Date(rec.ts))),
      h("span", { class: "atype " + AT_CLASS(rec.type) }, rec.type.replace(/\./g, " ")),
      h("span", { class: "actor" }, rec.actor || "system"),
      h("span", { class: "sum" }, rec.summary || ""),
    ]);
  }
  function renderAudit() { clear(refs.auditBody); S.auditLog().slice(0, 200).forEach((r) => refs.auditBody.appendChild(auditRow(r))); }

  /* ============================================================ WIRING */
  function wire() {
    G.bus.on("run:start", () => { if (activeView === "command") renderRun(); });
    G.bus.on("task:update", () => { if (activeView === "command") renderRun(); });
    G.bus.on("run:end", () => { if (activeView === "command") renderRun(); if (currentPlan) renderPlan(currentPlan); });
    G.bus.on("approval", () => { updateApprBadge(); if (activeView === "command") renderRun(); if (activeView === "approvals") renderApprovals(); });
    G.bus.on("approval:resolved", () => { updateApprBadge(); if (activeView === "command") renderRun(); if (activeView === "approvals") renderApprovals(); });
    G.bus.on("audit", (rec) => { if (activeView === "audit" && refs.auditBody) refs.auditBody.insertBefore(auditRow(rec), refs.auditBody.firstChild); });
    G.bus.on("store:change", (c) => { if (activeView === "devices" && c.coll === "entities") renderDevices(); });
    G.bus.on("onehand", (o) => { refs.ohToggle.classList.toggle("on", !!o.active); });
    G.bus.on("oh:action", (a) => {
      if (a.type === "nav") nav(a.view);
      else if (a.type === "focus-command") { refs.gcmd.focus(); }
      else if (a.type === "command") { currentPlan = P.plan(a.text); renderPlan(currentPlan); renderRun(); nav("command"); }
      else if (a.type === "emergency") G.ui.emergency();
      else if (a.type === "voice") { refs.gcmd.focus(); G.bus.emit("toast", { kind: "ok", ic: "🎙️", text: "Listening… (voice input simulated)" }); }
    });
  }

  function build() {
    buildAppbar();
    buildCommandView();
    buildWorldView();
    buildDevicesView();
    buildApprovalsView();
    buildAuditView();
    wire();
    updateApprBadge();
  }

  G.shell = { build, nav };
})();
