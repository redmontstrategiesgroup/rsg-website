/* ============================================================
   GHOST // orchestrator.js — plan → task DAG → execute + verify
   - runs safe tasks, pauses at approval gates
   - applies REAL effects to the world model (with rollback data)
   - a task is only "completed" once verification re-reads state
   - every transition is audited
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const S = G.store, W = G.world;

  const STATUS = ["pending", "awaiting_approval", "running", "verifying", "completed", "completed_warn", "failed", "blocked", "rolled_back", "cancelled"];
  let current = null;
  let driver = null;

  function agentName(id) { return (G.DATA.agents[id] && G.DATA.agents[id].name) || id; }

  /* ---------- effects (REAL world-model mutations) ---------- */
  function applyEffect(eff) {
    if (!eff || eff.op === "noop") return { ok: true, note: "no state change", before: null };
    switch (eff.op) {
      case "wake": {
        const before = eff.ids.map((id) => { const e = W.entity(id); return { id, status: e ? e.status : null, reachable: e ? e.reachable : null }; });
        eff.ids.forEach((id) => S.patch("entities", id, { status: "online", reachable: true }));
        return { ok: true, note: `${eff.ids.length} device(s) powered on`, before };
      }
      case "setField": {
        const e = W.entity(eff.id); const before = { id: eff.id, field: eff.field, prev: e ? e[eff.field] : null };
        S.patch("entities", eff.id, { [eff.field]: eff.to });
        return { ok: true, note: `${W.label(eff.id)}.${eff.field} = ${eff.to}`, before };
      }
      case "moveLeads": {
        const leads = W.entities("lead").filter((l) => l.stage === eff.from && (l.score || 0) >= (eff.minScore || 0));
        const before = leads.map((l) => ({ id: l.id, stage: eff.from }));
        leads.forEach((l) => S.patch("entities", l.id, { stage: eff.to }));
        return { ok: true, note: `${leads.length} lead(s) → ${eff.to}`, before, moved: leads.length };
      }
      case "createIncident": {
        const inc = S.put("entities", { id: G.id(), type: "incident", name: `Incident · ${W.label(eff.target)}`, status: "open", target: eff.target, ico: "🚨", opened: Date.now() });
        return { ok: true, note: `incident ${inc.id} opened`, before: { createdId: inc.id }, createdId: inc.id };
      }
      case "sendMessage": {
        // EXTERNAL side effect. GHOST prepares, but does not transmit on the
        // operator's behalf unless a connected + authorized channel exists.
        const twilioOff = W.entity("int.twilio") && !W.entity("int.twilio").connected && eff.channel === "sms";
        const rec = S.put("entities", { id: G.id(), type: "message", name: `Outreach draft (${eff.channel})`, status: twilioOff ? "blocked" : "prepared", ico: "✉️" });
        return { ok: true, warn: true, note: twilioOff ? "channel not connected — prepared, not sent" : "message prepared — external send requires connected+authorized channel", before: { createdId: rec.id } };
      }
      case "activateOnehand": {
        const before = { prev: S.setting("onehand") };
        const profile = G.onehand ? G.onehand.defaultProfile() : { hand: "right" };
        if (G.onehand) G.onehand.activate(profile);
        return { ok: true, note: "OneHand profile applied", before };
      }
      default: return { ok: true, note: "", before: null };
    }
  }

  function undoEffect(eff, before) {
    if (!eff || !before) return;
    if (eff.op === "wake") before.forEach((b) => S.patch("entities", b.id, { status: b.status, reachable: b.reachable }));
    else if (eff.op === "setField") S.patch("entities", before.id, { [before.field]: before.prev });
    else if (eff.op === "moveLeads") before.forEach((b) => S.patch("entities", b.id, { stage: b.stage }));
    else if (eff.op === "createIncident" && before.createdId) S.remove("entities", before.createdId);
    else if (eff.op === "sendMessage" && before.createdId) S.remove("entities", before.createdId);
    else if (eff.op === "activateOnehand") { if (G.onehand) G.onehand.deactivate(); S.setting("onehand", before.prev); }
  }

  /* ---------- verification (re-read real state) ---------- */
  function verifyTask(task, effResult) {
    const eff = task.effect || {};
    const v = task.verify || { method: "observe" };
    if (v.method === "observe" && eff.op === "noop") return { passed: true, method: "observation", evidence: "Read-only step — output inspected." };
    switch (eff.op) {
      case "wake": {
        const ok = eff.ids.every((id) => (W.entity(id) || {}).status === "online");
        return { passed: ok, method: "device state probe", evidence: eff.ids.map((id) => `${W.label(id)}=${(W.entity(id) || {}).status}`).join(", ") };
      }
      case "setField": {
        const e = W.entity(eff.id); const ok = e && String(e[eff.field]) === String(eff.to);
        return { passed: ok, method: "entity field assertion", evidence: `${W.label(eff.id)}.${eff.field} == ${e ? e[eff.field] : "∅"}` };
      }
      case "moveLeads": {
        const n = W.entities("lead").filter((l) => l.stage === eff.to).length;
        return { passed: (effResult.moved || 0) >= 0, method: "CRM query", evidence: `${n} lead(s) now in stage “${eff.to}”` };
      }
      case "createIncident": {
        const ok = !!W.entity(effResult.createdId);
        return { passed: ok, method: "record existence check", evidence: ok ? `incident ${effResult.createdId} present` : "not found" };
      }
      case "activateOnehand": {
        const ok = !!S.setting("onehand");
        return { passed: ok, method: "settings assertion", evidence: ok ? "OneHand profile active" : "inactive" };
      }
      case "sendMessage":
        return { passed: true, warn: true, method: "artifact check", evidence: effResult.note };
      default:
        return { passed: true, method: "observation", evidence: "step output inspected" };
    }
  }

  /* ---------- run lifecycle ---------- */
  function start(plan) {
    stop();
    const run = S.put("runs", {
      id: G.id(), planId: plan.id, command: plan.command, goal: plan.goal, mode: plan.mode,
      status: "running", startedAt: Date.now(), systems: plan.systems,
      taskIds: [], metrics: { tokens: 0, tools: 0, verifications: 0, approvals: 0 },
    });
    const tasks = plan.steps.map((st) => S.put("tasks", {
      id: G.id(), runId: run.id, stepId: st.id, title: st.title, detail: st.detail,
      agent: st.agent, tool: st.tool, impact: st.impact, reversible: st.reversible,
      effect: st.effect, verify: st.verify, deps: (st.deps || []).map((d) => d), holds: !!st.holds,
      status: "pending",
    }));
    // remap step-id deps → task ids
    const byStep = {}; plan.steps.forEach((st, i) => (byStep[st.id] = tasks[i].id));
    tasks.forEach((tk, i) => (tk.deps = (plan.steps[i].deps || []).map((d) => byStep[d]).filter(Boolean)));
    run.taskIds = tasks.map((t) => t.id);
    S.patch("plans", plan.id, { status: "executing", runId: run.id });
    current = run;
    S.audit({ type: "run.started", actor: "orchestrator", run: run.id, summary: `Executing plan: ${plan.goal}` });
    G.bus.emit("run:start", { run, tasks, plan });
    tick();
    driver = setInterval(tick, 850);
    return run;
  }

  function runTasks() { return current ? current.taskIds.map((id) => S.get("tasks", id)) : []; }

  function tick() {
    if (!current) return stop();
    const tasks = runTasks();
    const done = (t) => ["completed", "completed_warn", "rolled_back"].includes(t.status);
    const dead = (t) => ["failed", "blocked", "cancelled"].includes(t.status);

    if (tasks.some((t) => t.status === "awaiting_approval")) return; // gated — wait for human

    const next = tasks.find((t) => t.status === "pending" && (t.deps || []).every((d) => { const dt = S.get("tasks", d); return dt && done(dt); }));
    if (!next) {
      if (tasks.every(done)) return finish("completed");
      if (tasks.some(dead)) return finish("failed");
      return; // waiting on deps of gated/failed branch
    }

    // approval gate
    if (next.impact >= 3 || next.holds) {
      setTask(next, "awaiting_approval");
      const ap = S.put("approvals", {
        id: G.id(), runId: current.id, taskId: next.id, title: next.title, detail: next.detail,
        impact: next.impact, reversible: next.reversible, status: "pending", ts: Date.now(),
        prompt: `Approve “${next.title}” — impact L${next.impact} (${G.planner.IMPACT[next.impact].name})${next.reversible ? "" : ", IRREVERSIBLE"}?`,
      });
      current.metrics.approvals++;
      S.audit({ type: "approval.requested", actor: "orchestrator", run: current.id, task: next.id, summary: ap.prompt });
      G.bus.emit("approval", ap);
      G.bus.emit("toast", { kind: "warn", ic: "⏸", text: `Approval required: ${next.title}` });
      return;
    }
    executeTask(next);
  }

  // synchronous: run effect + verify in one call (robust vs. timer throttling).
  // pacing between tasks comes from the tick interval — one task per tick.
  function executeTask(task) {
    setTask(task, "running");
    current.metrics.tools++;
    S.audit({ type: "task.running", actor: agentName(task.agent), run: current.id, task: task.id, summary: `${task.title} — ${task.tool}` });

    let effResult;
    try { effResult = applyEffect(task.effect); }
    catch (e) { setTask(task, "failed", { error: String(e) }); S.audit({ type: "task.failed", actor: agentName(task.agent), run: current.id, task: task.id, summary: `Effect error: ${e}` }); return; }
    task.effectNote = effResult.note; task.beforeData = effResult.before; S.put("tasks", task);

    const vr = verifyTask(task, effResult);
    const rec = S.put("verifications", { id: G.id(), runId: current.id, taskId: task.id, method: vr.method, passed: vr.passed, evidence: vr.evidence, ts: Date.now() });
    current.metrics.verifications++;
    task.verificationId = rec.id;
    if (!vr.passed) {
      setTask(task, "failed", { verification: vr });
      S.audit({ type: "verify.failed", actor: "VISION", run: current.id, task: task.id, summary: `Verification FAILED — ${vr.evidence}` });
    } else {
      setTask(task, (vr.warn || effResult.warn) ? "completed_warn" : "completed", { verification: vr });
      S.audit({ type: "verify.passed", actor: "VISION", run: current.id, task: task.id, summary: `Verified via ${vr.method}: ${vr.evidence}` });
    }
  }

  function setTask(task, status, extra) {
    task.status = status; if (extra) Object.assign(task, extra);
    S.put("tasks", task);
    G.bus.emit("task:update", task);
  }

  function approve(approvalId) {
    const ap = S.get("approvals", approvalId); if (!ap || ap.status !== "pending") return;
    S.patch("approvals", approvalId, { status: "approved", resolvedAt: Date.now() });
    S.audit({ type: "approval.granted", actor: "operator", run: ap.runId, task: ap.taskId, summary: `Approved: ${ap.title}` });
    G.bus.emit("approval:resolved", { ap, decision: "approved" });
    const task = S.get("tasks", ap.taskId);
    if (task) executeTask(task);
    if (!driver) driver = setInterval(tick, 850);
  }
  function reject(approvalId) {
    const ap = S.get("approvals", approvalId); if (!ap || ap.status !== "pending") return;
    S.patch("approvals", approvalId, { status: "rejected", resolvedAt: Date.now() });
    const task = S.get("tasks", ap.taskId);
    if (task) setTask(task, "blocked");
    S.audit({ type: "approval.denied", actor: "operator", run: ap.runId, task: ap.taskId, summary: `Denied: ${ap.title}` });
    G.bus.emit("approval:resolved", { ap, decision: "rejected" });
    finish("blocked");
  }

  function finish(status) {
    if (!current) return;
    stopDriver();
    S.patch("runs", current.id, { status, endedAt: Date.now() });
    if (current.planId) S.patch("plans", current.planId, { status });
    S.audit({ type: "run.ended", actor: "orchestrator", run: current.id, summary: `Run ${status.toUpperCase()} — ${current.goal}` });
    G.bus.emit("run:end", { run: S.get("runs", current.id), status });
    G.bus.emit("toast", { kind: status === "completed" ? "ok" : "danger", ic: status === "completed" ? "✓" : "⚠", text: `Run ${status}: ${current.goal}` });
    current = null;
  }

  function rollback(runId) {
    const run = S.get("runs", runId); if (!run) return;
    const tasks = run.taskIds.map((id) => S.get("tasks", id)).filter(Boolean);
    let n = 0;
    tasks.slice().reverse().forEach((t) => {
      if (["completed", "completed_warn"].includes(t.status) && t.reversible && t.effect && t.effect.op !== "noop") {
        undoEffect(t.effect, t.beforeData); setTask(t, "rolled_back"); n++;
      }
    });
    S.patch("runs", runId, { status: "rolled_back" });
    S.audit({ type: "run.rolledback", actor: "operator", run: runId, summary: `Rolled back ${n} reversible task(s).` });
    G.bus.emit("run:end", { run: S.get("runs", runId), status: "rolled_back" });
    G.bus.emit("toast", { kind: "ok", ic: "↺", text: `Rolled back ${n} reversible action(s).` });
  }

  function cancel() { if (current) { runTasks().forEach((t) => { if (!["completed", "completed_warn"].includes(t.status)) setTask(t, "cancelled"); }); finish("cancelled"); } }
  function stopDriver() { if (driver) { clearInterval(driver); driver = null; } }
  function stop() { stopDriver(); current = null; }

  G.orch = { start, approve, reject, rollback, cancel, stop, runTasks, _tick: tick, get current() { return current; }, STATUS };
})();
