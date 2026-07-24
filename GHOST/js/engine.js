/* ============================================================
   GHOST // engine.js — simulation core: clock, missions, metrics
   Single source of truth: G.state (mutated in place).
   Broadcasts via G.bus so the UI + viz update incrementally.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const { DATA } = G;

  const TICK_MS = 100;         // logic tick
  const STEP_BASE = 10.5;      // seconds per step (before per-step tweaks)

  function freshMachines() {
    return DATA.machines.map((m) => Object.assign({}, m));
  }

  const state = (G.state = {
    booted: false,
    mode: "build",
    mission: null,
    running: false,
    paused: false,
    complete: false,
    locked: false,           // emergency lockdown
    simTime: 0,
    totalDur: 0,
    stepIndex: -1,
    stepStart: 0,
    stepProgress: 0,
    timeline: [],            // [{status}]
    machines: freshMachines(),
    feed: [],
    metrics: { cost: 0, tokens: 0, rate: 0, series: [] },
    anomaly: null,
    gate: null,
    awaitingGate: false,
    threat: "nominal",
    uptimeStart: Date.now(),
    stats: { agentsActive: 1, machinesOnline: 0, missions: 0, anomaliesCaught: 0 },
  });

  /* ---------- helpers ---------- */
  function stepDur(step) {
    let d = STEP_BASE;
    if (step.anomaly) d += 3;
    if (step.clearsAnomaly) d += 3;
    if (step.lines) d += step.lines.length * 0.6;
    return d;
  }
  function machineById(id) { return state.machines.find((m) => m.id === id); }

  function pushFeed(agentId, text, kind) {
    const a = DATA.agents[agentId] || { name: agentId, color: "#8fa3bd", av: "?" };
    const msg = { id: G.id(), agent: a, text, kind: kind || "msg", time: new Date() };
    state.feed.push(msg);
    if (state.feed.length > 120) state.feed.shift();
    G.bus.emit("feed", msg);
    return msg;
  }

  function setMachine(id, patch) {
    const m = machineById(id);
    if (!m) return;
    Object.assign(m, patch);
    G.bus.emit("machine", m);
  }

  function resetMachinesIdle() {
    state.machines.forEach((m) => {
      if (m.id === "SEC") { m.scene = "security"; m.task = "No threats detected"; m.status = "online"; m.agent = "SECOPS"; m.prog = 0; }
      else { m.status = "online"; m.agent = null; m.task = ""; m.prog = 0; if (state.locked) m.status = "offline"; }
      G.bus.emit("machine", m);
    });
  }

  /* ---------- mission lifecycle ---------- */
  function start(missionId) {
    const mode = missionId || state.mode;
    const mission = DATA.missions[mode];
    if (!mission) return;
    state.mode = mode;
    state.mission = mission;
    state.running = true;
    state.paused = false;
    state.complete = false;
    state.simTime = 0;
    state.stepIndex = -1;
    state.stepStart = 0;
    state.stepProgress = 0;
    state.anomaly = null;
    state.gate = null;
    state.awaitingGate = false;
    state.threat = mode === "warroom" ? "elevated" : "nominal";
    state.metrics = { cost: 0, tokens: 0, rate: 0, series: [] };
    state.timeline = mission.steps.map(() => ({ status: "pending" }));
    state.totalDur = mission.steps.reduce((s, st) => s + stepDur(st), 0);
    state.machines = freshMachines();

    state.feed = [];
    G.bus.emit("mission:start", mission);
    pushFeed("ORCH", `Mission received — <b>${mission.title}</b>`, "system");
    enterStep(0);
    G.bus.emit("tick", state);
  }

  function enterStep(i) {
    const step = state.mission.steps[i];
    if (!step) return;
    state.stepIndex = i;
    state.stepStart = state.simTime;
    state.stepProgress = 0;
    step._emitted = new Set();
    state.timeline.forEach((t, k) => { t.status = k < i ? "done" : k === i ? "active" : "pending"; });

    // machines not in this step revert to idle (keep last scene lingering)
    const involved = new Set((step.assign || []).map((a) => a.m));
    state.machines.forEach((m) => {
      if (m.id === "SEC") return;
      if (!involved.has(m.id)) { m.status = "online"; m.task = ""; m.agent = null; }
    });
    (step.assign || []).forEach((a) => {
      setMachine(a.m, { scene: a.scene, task: a.task, agent: a.agent, status: "busy", prog: 0, alert: false });
    });

    // active agents this step
    const agentsThisStep = new Set(["ORCH"]);
    (step.assign || []).forEach((a) => a.agent && agentsThisStep.add(a.agent));
    state.stats.agentsActive = agentsThisStep.size;

    G.bus.emit("step", { index: i, step });
    G.bus.emit("machine:all");
  }

  function advance() {
    const i = state.stepIndex;
    const step = state.mission.steps[i];

    // resolve anomaly if this step clears it
    if (step.clearsAnomaly && state.anomaly) {
      state.anomaly = null;
      G.bus.emit("anomaly", null);
    }
    if (state.timeline[i]) state.timeline[i].status = "done";

    if (i + 1 < state.mission.steps.length) {
      enterStep(i + 1);
    } else {
      finish();
    }
  }

  function finish() {
    state.running = false;
    state.complete = true;
    state.stats.missions += 1;
    state.stepProgress = 1;
    state.timeline.forEach((t) => (t.status = "done"));
    state.machines.forEach((m) => { if (m.id !== "SEC") { m.status = "online"; m.prog = 1; } });
    state.threat = "nominal";
    G.bus.emit("machine:all");
    G.bus.emit("mission:end", state.mission);
  }

  /* ---------- controls ---------- */
  function pause() { if (state.running && !state.complete) { state.paused = !state.paused; G.bus.emit("control", { paused: state.paused }); pushFeed("ORCH", state.paused ? "Mission <b>paused</b> by operator." : "Resuming mission.", "system"); } }
  function approveGate() {
    if (!state.awaitingGate) return;
    const step = state.mission.steps[state.stepIndex];
    pushFeed("ORCH", "Operator <b>approved</b>. Proceeding.", "system");
    state.awaitingGate = false;
    state.gate = null;
    G.bus.emit("gate", null);
    advance();
  }
  function redirect(text) {
    if (!text) return;
    pushFeed("ORCH", `Redirect received: “${text}”. Re-planning next phase.`, "system");
    G.bus.emit("redirect", text);
  }
  function terminate() {
    if (!state.running && !state.awaitingGate) return;
    state.running = false;
    state.awaitingGate = false;
    state.gate = null;
    state.anomaly = null;
    G.bus.emit("gate", null);
    G.bus.emit("anomaly", null);
    pushFeed("ORCH", "Mission <b>terminated</b> by operator. Machines returned to standby.", "system");
    resetMachinesIdle();
    G.bus.emit("mission:end", state.mission);
  }

  function emergencyStop() {
    state.locked = true;
    state.running = false;
    state.paused = true;
    state.awaitingGate = false;
    state.gate = null;
    state.threat = "lockdown";
    state.machines.forEach((m) => { m.status = "offline"; m.task = "— powered down —"; m.agent = null; });
    G.bus.emit("machine:all");
    pushFeed("SECOPS", "⛔ <b>EMERGENCY STOP</b> — all agents halted, machines powered down, network isolated.", "alert");
    G.bus.emit("emergency");
  }
  function restore() {
    state.locked = false;
    state.threat = "nominal";
    resetMachinesIdle();
    pushFeed("SECOPS", "Systems restored. Fleet back online. Standing by.", "system");
    G.bus.emit("restore");
    G.bus.emit("machine:all");
  }

  function setMode(mode) {
    if (state.locked) restore();
    state.mode = mode;
    G.bus.emit("mode", mode);
    start(mode);
  }

  /* ---------- tick ---------- */
  function tick() {
    const now = Date.now();
    state.stats.machinesOnline = state.machines.filter((m) => m.status !== "offline").length;

    if (!state.running || state.paused || state.awaitingGate || state.locked) {
      // still emit a light tick for clocks/uptime
      G.bus.emit("tick", state);
      G.bus.emit("metrics", state.metrics);
      return;
    }

    const dt = TICK_MS / 1000;
    state.simTime += dt;
    const step = state.mission.steps[state.stepIndex];
    if (!step) return;
    const d = stepDur(step);
    state.stepProgress = G.clampv((state.simTime - state.stepStart) / d, 0, 1);

    // progress bars on busy machines
    (step.assign || []).forEach((a) => {
      const m = machineById(a.m);
      if (m && m.status === "busy") { m.prog = state.stepProgress; }
    });

    // stream feed lines
    (step.lines || []).forEach((ln, idx) => {
      const keyId = idx;
      if (!step._emitted.has(keyId) && state.stepProgress >= ln.at) {
        step._emitted.add(keyId);
        pushFeed(ln.agent, ln.text, ln.agent === "VISION" && /anomaly|⚠/.test(ln.text) ? "alert" : "msg");
      }
    });

    // fire anomaly midway through its step
    if (step.anomaly && !state.anomaly && state.stepProgress >= 0.62) {
      const an = Object.assign({ id: G.id(), at: new Date() }, step.anomaly);
      state.anomaly = an;
      state.stats.anomaliesCaught += 1;
      const m = machineById(an.machine);
      if (m) { m.scene = "error"; m.alert = true; G.bus.emit("machine", m); }
      G.bus.emit("anomaly", an);
      G.bus.emit("toast", { kind: "danger", ic: "⚠", text: `Visual anomaly on ${m ? m.name : an.machine}: ${an.title}` });
    }

    // metrics accrual
    const busy = state.machines.filter((m) => m.status === "busy").length;
    const rate = 900 + busy * 1400 + Math.sin(state.simTime * 2.3) * 350;
    state.metrics.rate = Math.max(0, rate);
    state.metrics.tokens += (state.metrics.rate * dt);
    state.metrics.cost = (state.metrics.tokens / 1000) * 0.0125;
    // per ~0.5s push to series
    if (!state._lastSeries || state.simTime - state._lastSeries >= 0.4) {
      state._lastSeries = state.simTime;
      state.metrics.series.push(state.metrics.rate);
      if (state.metrics.series.length > 160) state.metrics.series.shift();
    }
    G.bus.emit("metrics", state.metrics);

    // step boundary
    if (state.stepProgress >= 1) {
      if (step.gate && !state.awaitingGate) {
        state.awaitingGate = true;
        state.gate = { text: step.gate, stepKey: step.key };
        pushFeed("ORCH", `⏸ Holding for approval — <b>${step.gate}</b>`, "system");
        G.bus.emit("gate", state.gate);
        G.bus.emit("toast", { kind: "warn", ic: "⏸", text: "Approval required to proceed." });
      } else if (!step.gate) {
        advance();
      }
    }

    G.bus.emit("tick", state);
  }

  let timer = null;
  function run() { if (!timer) timer = setInterval(tick, TICK_MS); }
  function stopLoop() { if (timer) { clearInterval(timer); timer = null; } }

  G.engine = {
    state, start, setMode, pause, approveGate, redirect, terminate,
    emergencyStop, restore, run, stopLoop, resetMachinesIdle, pushFeed,
    machineById, stepDur,
  };
})();
