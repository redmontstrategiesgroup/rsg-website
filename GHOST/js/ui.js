/* ============================================================
   GHOST // ui.js — DOM panels + wiring to the engine bus
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const { h, $, clear, mount, DATA } = G;
  const refs = {};

  /* ============================================================
     BOOT SEQUENCE
     ============================================================ */
  function boot(done) {
    const el = $("#boot");
    const bar = h("i");
    const log = h("div", { class: "boot-log" });
    el.appendChild(h("div", { class: "boot-core" }, [
      h("div", { class: "boot-logo" }, [
        h("div", null, h("span", { class: "g" }, "GHOST")),
        h("div", { class: "tag" }, "Autonomous Command Center · Fable 5 core"),
      ]),
      log,
      h("div", { class: "boot-bar" }, bar),
    ]));

    const seq = [
      ["Initializing GHOST kernel", "ok"],
      ["Mounting Fable 5 vision + reasoning core", "hi"],
      ["Linking 8 machines · 2 desktops · VPS · phone · CRM", "ok"],
      ["Bridging PiKVM-01 · Pi cluster · Vault NAS", "ok"],
      ["Waking agents: ORCHESTRATOR · RECON · FORGE · KEEP", "hi"],
      ["Arming ARGUS visual-verification pipeline", "ok"],
      ["WARDEN security sentinel online — no threats", "ok"],
      ["Calibrating cameras · smart plugs · foot pedals", "ok"],
      ["All systems nominal. Standing by for mission.", "hi"],
    ];
    let i = 0;
    const iv = setInterval(() => {
      if (i < seq.length) {
        const [s, c] = seq[i];
        log.appendChild(h("div", { class: c }, "▸ " + s));
        while (log.childNodes.length > 8) log.removeChild(log.firstChild);
        bar.style.width = ((i + 1) / seq.length * 100) + "%";
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => { el.classList.add("done"); setTimeout(() => { el.remove(); done(); }, 700); }, 500);
      }
    }, 340);
  }

  /* ============================================================
     TOP BAR
     ============================================================ */
  function buildTopbar() {
    const el = $("#topbar");
    refs.cost = h("div", { class: "val" }, "$0.00");
    refs.costBar = h("i");
    refs.tok = h("div", { class: "val" }, "0");
    refs.tokBar = h("i");
    refs.rate = h("div", { class: "val amber" }, "0/s");
    refs.mode = h("span", { class: "v" }, "BUILD");
    refs.missionTitle = h("span", { class: "v", style: { maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", whiteSpace: "nowrap", verticalAlign: "bottom" } }, "—");
    refs.threat = h("div", { class: "threat" }, [h("span", { class: "dot ok" }), h("span", null, "THREAT · NOMINAL")]);
    refs.clock = h("span", { class: "v" }, "00:00:00");

    const kill = h("button", { class: "killswitch", onclick: onKill, title: "Halt all agents & power down fleet" }, [
      h("span", { class: "glyph" }), h("span", null, "Emergency Stop"),
    ]);

    mount(el, [
      h("div", { class: "brand" }, [
        h("div", { class: "mark" }, "👻"),
        h("div", null, [h("div", { class: "word" }, "GHOST"), h("div", { class: "sub" }, "COMMAND CENTER")]),
      ]),
      h("div", { class: "sep" }),
      h("div", { class: "midcol", style: { display: "flex", flexDirection: "column", gap: "2px" } }, [
        h("div", { class: "sysline" }, [h("span", { class: "k up" }, "Mode"), refs.mode]),
        h("div", { class: "sysline", style: { minWidth: "0" } }, [h("span", { class: "k up" }, "Mission"), refs.missionTitle]),
      ]),
      h("div", { class: "meters" }, [
        meter("Cost", refs.cost, refs.costBar),
        meter("Tokens", refs.tok, refs.tokBar),
        h("div", { class: "meter" }, [
          h("div", { class: "lbl up" }, [h("span", null, "Throughput"), h("span", { class: "clockk" })]),
          refs.rate,
        ]),
      ]),
      h("div", { class: "sep" }),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "2px", alignItems: "flex-end" } }, [
        h("div", { class: "sysline" }, [h("span", { class: "k up" }, "Uptime"), refs.clock]),
        refs.threat,
      ]),
      kill,
    ]);
  }
  function meter(label, valEl, barEl) {
    return h("div", { class: "meter" }, [
      h("div", { class: "lbl up" }, [h("span", null, label), h("span", null, "")]),
      valEl,
      h("div", { class: "bar" }, barEl),
    ]);
  }

  /* ============================================================
     MODE RAIL
     ============================================================ */
  function buildRail() {
    const el = $("#moderail");
    refs.modeBtns = {};
    const modeEls = DATA.modes.map((m) => {
      const b = h("button", { class: "mode" + (m.id === G.state.mode ? " active" : ""), title: m.blurb, onclick: () => G.engine.setMode(m.id) }, [
        h("span", { class: "ic" }, m.ic), h("span", { class: "nm" }, m.name),
      ]);
      refs.modeBtns[m.id] = b;
      return b;
    });
    refs.statAgents = h("div", { class: "n" }, "1");
    refs.statMachines = h("div", { class: "n" }, "8");
    refs.statAnom = h("div", { class: "n" }, "0");
    mount(el, [
      h("div", { class: "logo-lab" }, "GHOST · OS"),
      ...modeEls,
      h("button", { class: "rail-btn", title: "3D Home Lab", onclick: openHomelab }, "🧊"),
      h("div", { class: "rail-stats" }, [
        railStat(refs.statAgents, "Agents"),
        railStat(refs.statMachines, "Online"),
        railStat(refs.statAnom, "Caught"),
      ]),
    ]);
  }
  function railStat(nEl, label) { return h("div", { class: "rail-stat" }, [nEl, h("div", { class: "l" }, label)]); }

  /* ============================================================
     MACHINE GRID
     ============================================================ */
  function buildGrid() {
    const el = $("#machinegrid");
    const body = h("div", { class: "mg-body" });
    refs.tiles = {};
    DATA.machines.forEach((m) => {
      const cv = h("canvas");
      const dot = h("span", { class: "dot idle" });
      const st = h("span", { class: "st dim" }, "ONLINE");
      const task = h("div", { class: "tile-task" }, [h("span", { class: "who" }, ""), h("span", { class: "tt" }, "Standby")]);
      const prog = h("i");
      const rec = h("div", { class: "rec", style: { display: "none" } }, [h("i"), "REC"]);
      const tile = h("div", { class: "tile", data: { id: m.id }, onclick: () => selectTile(m.id) }, [
        h("div", { class: "tile-h" }, [dot, h("span", { class: "nm" }, m.name), h("span", { class: "kind" }, m.kind), st]),
        h("div", { class: "tile-screen" }, [cv, h("div", { class: "scrim" }), rec, h("div", { class: "res" }, m.res)]),
        h("div", { class: "tile-f" }, [task, h("div", { class: "tile-prog" }, prog)]),
      ]);
      refs.tiles[m.id] = { tile, dot, st, task, prog, rec, cv };
      body.appendChild(tile);
      G.viz.attachTile(cv, m.id);
    });
    mount(el, [
      panelH("Fleet · Live Screens", h("span", { class: "tick" }, "8 NODES")),
      body,
    ]);
    updateAllMachines();
  }
  function selectTile(id) {
    Object.values(refs.tiles).forEach((t) => t.tile.classList.remove("sel"));
    refs.tiles[id].tile.classList.add("sel");
    const m = G.engine.machineById(id);
    toast("ok", "🖥️", `${m.name} — ${m.kind} · ${m.res}${m.task ? " · " + m.task : ""}`);
  }
  function updateMachine(m) {
    const r = refs.tiles[m.id]; if (!r) return;
    const cls = m.status === "offline" ? "danger" : m.status === "busy" ? "busy" : m.id === "SEC" ? "ok" : "idle";
    r.dot.className = "dot " + cls;
    r.st.textContent = m.status.toUpperCase();
    r.st.className = "st " + (m.status === "busy" ? "hot" : m.status === "offline" ? "" : "dim");
    r.st.style.color = m.status === "offline" ? "var(--danger)" : "";
    r.task.querySelector(".who").textContent = m.agent ? DATA.agents[m.agent].name : "";
    r.task.querySelector(".tt").textContent = m.task || (m.status === "busy" ? "Working…" : "Standby");
    r.prog.style.width = (m.prog * 100) + "%";
    r.prog.className = m.alert ? "warn" : "";
    r.rec.style.display = m.status === "busy" ? "flex" : "none";
    r.tile.classList.toggle("alert", !!m.alert);
  }
  function updateAllMachines() { G.state.machines.forEach(updateMachine); }

  /* ============================================================
     TIMELINE
     ============================================================ */
  function buildTimeline() {
    refs.tlBody = h("div", { class: "tl-body" });
    mount($("#timeline"), [panelH("Mission Timeline", h("span", { class: "tick clockk-tl" }, "")), refs.tlBody]);
    renderTimeline();
  }
  function renderTimeline() {
    const body = refs.tlBody; clear(body);
    const mission = G.state.mission; if (!mission) return;
    mission.steps.forEach((step, i) => {
      const status = G.state.timeline[i] ? G.state.timeline[i].status : "pending";
      body.appendChild(h("div", { class: "tl-step " + status }, [
        h("div", { class: "rail" }, [
          h("div", { class: "node" }, status === "done" ? "✓" : status === "active" ? "▸" : (i + 1)),
          h("div", { class: "line" }),
        ]),
        h("div", { class: "txt" }, [
          h("div", { class: "t" }, step.title),
          h("div", { class: "m" }, step.detail),
        ]),
      ]));
    });
    // autoscroll to active
    const active = body.querySelector(".tl-step.active");
    if (active) active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  /* ============================================================
     SYSTEM MAP
     ============================================================ */
  function buildMap() {
    const cv = h("canvas");
    mount($("#systemmap"), [
      panelH("Global System Map", h("span", { class: "tick" }, "RADIAL")),
      h("div", { class: "sm-canvas-wrap" }, cv),
      h("div", { class: "sm-legend" }, [
        legend("var(--cyan)", "Active"), legend("var(--idle)", "Idle"),
        legend("var(--danger)", "Alert / Offline"),
      ]),
    ]);
    G.viz.attachMap(cv);
  }
  function legend(c, t) { return h("span", null, [h("span", { class: "dot", style: { background: c, boxShadow: "0 0 6px " + c } }), t]); }

  /* ============================================================
     AGENT FEED
     ============================================================ */
  function buildFeed() {
    refs.feedBody = h("div", { class: "af-body" });
    mount($("#agentfeed"), [panelH("Agent Comms", h("span", { class: "led" })), refs.feedBody]);
  }
  function addMessage(msg) {
    const a = msg.agent;
    const el = h("div", { class: "msg " + (msg.kind === "system" ? "system" : msg.kind === "alert" ? "alert" : "") }, [
      h("div", { class: "av", style: { background: a.color, boxShadow: "0 0 10px " + a.color + "66" } }, a.av),
      h("div", { class: "body" }, [
        h("div", { class: "meta" }, [
          h("span", { class: "name", style: { color: a.color } }, a.name),
          h("span", { class: "role" }, a.role || ""),
          h("span", { class: "time" }, G.clock(msg.time)),
        ]),
        h("div", { class: "text", html: msg.text }),
      ]),
    ]);
    refs.feedBody.appendChild(el);
    while (refs.feedBody.childNodes.length > 60) refs.feedBody.removeChild(refs.feedBody.firstChild);
    refs.feedBody.scrollTop = refs.feedBody.scrollHeight;
  }

  /* ============================================================
     ANOMALY PANEL
     ============================================================ */
  function buildAnomaly() {
    const el = $("#anomaly");
    refs.anBody = h("div", { class: "an-body" });
    mount(el, [panelH("Visual Anomaly Detected", h("span", { class: "led" })), refs.anBody]);
  }
  function showAnomaly(an) {
    const el = $("#anomaly");
    if (!an) { el.classList.remove("show"); return; }
    el.classList.add("show");
    const cv = h("canvas");
    clear(refs.anBody);
    refs.anBody.appendChild(h("div", { class: "an-title" }, "◹ " + an.title));
    refs.anBody.appendChild(row("Machine", DATA.machines.find((m) => m.id === an.machine).name));
    refs.anBody.appendChild(row("Viewport", an.viewport));
    refs.anBody.appendChild(row("Severity", an.severity));
    refs.anBody.appendChild(row("Elements", an.selector));
    refs.anBody.appendChild(h("div", { class: "an-shot" }, cv));
    refs.anBody.appendChild(h("div", { class: "an-action" }, [
      h("span", { class: "arrow" }, "↺"), h("span", null, an.action),
    ]));
    G.viz.attachAnomaly(cv);
  }
  function row(k, v) { return h("div", { class: "an-row" }, [h("span", { class: "k" }, k), h("span", { class: "v" }, v)]); }

  /* ============================================================
     CONTROLS
     ============================================================ */
  function buildControls() {
    refs.btnApprove = cbtn("approve", "✓", "Approve", () => G.engine.approveGate());
    refs.btnPause = cbtn("pause", "⏸", "Pause", () => G.engine.pause());
    refs.btnRedirect = cbtn("redirect", "↳", "Redirect", onRedirect);
    refs.btnTerminate = cbtn("terminate", "⏹", "Terminate", () => G.engine.terminate());
    refs.gateNote = h("div", { style: { padding: "0 10px 4px", fontSize: "10px", color: "var(--text-faint)", minHeight: "13px" } }, "");
    mount($("#controls"), [
      panelH("Mission Controls"),
      refs.gateNote,
      h("div", { class: "ctrl-grid" }, [refs.btnApprove, refs.btnPause, refs.btnRedirect, refs.btnTerminate]),
    ]);
    refreshControls();
  }
  function cbtn(cls, ic, label, onclick) {
    return h("button", { class: "cbtn " + cls, onclick }, [h("span", { class: "ic" }, ic), h("span", null, label)]);
  }
  function refreshControls() {
    const s = G.state;
    refs.btnApprove.disabled = !s.awaitingGate;
    refs.btnApprove.classList.toggle("pending", s.awaitingGate);
    refs.btnPause.querySelector("span:last-child").textContent = s.paused ? "Resume" : "Pause";
    refs.btnPause.disabled = !s.running && !s.awaitingGate;
    refs.btnTerminate.disabled = !s.running && !s.awaitingGate;
    refs.gateNote.textContent = s.gate ? "⏸ " + s.gate.text : (s.complete ? "✓ Mission complete." : s.paused ? "Paused." : "");
    refs.gateNote.style.color = s.gate ? "var(--warn)" : s.complete ? "var(--ok)" : "var(--text-faint)";
  }
  function onRedirect() {
    refs.cmdInput.focus();
    refs.cmdInput.placeholder = "Type a redirect for GHOST, then Enter…";
    refs.cmdInput.dataset.mode = "redirect";
    toast("ok", "↳", "Redirect mode — type an instruction in the command bar.");
  }

  /* ============================================================
     DECK — command bar + replay scrubber
     ============================================================ */
  function buildDeck() {
    // command bar
    refs.cmdInput = h("input", { class: "cmd-input", placeholder: "Give GHOST a mission…  e.g. “Launch a website & sales system for a roofing company”", onkeydown: onCmdKey });
    refs.voiceBtn = h("button", { class: "cmd-voice", onclick: onVoice }, [h("span", null, "🎙️"), h("span", null, "VOICE")]);
    const chips = h("div", { class: "cmd-suggest" }, [
      chip("🛠️ Roofing build mission", () => launchFromPrompt(DATA.missions.build.prompt, "build")),
      chip("🏢 Run RSG operations", () => G.engine.setMode("company")),
      chip("🔬 Research mission", () => G.engine.setMode("research")),
      chip("🚨 Trigger War Room", () => G.engine.setMode("warroom")),
      chip("🎙️ OneHand demo", () => G.engine.setMode("onehand")),
    ]);
    const cmd = h("div", { class: "panel cmdbar" }, [
      panelH("Command Input"),
      h("div", { class: "cmd-input-row" }, [
        h("span", { class: "cmd-prompt" }, "❯"),
        refs.cmdInput,
        h("button", { class: "cmd-go", onclick: () => submitCmd() }, [h("span", null, "DEPLOY"), h("span", null, "▸")]),
        refs.voiceBtn,
      ]),
      chips,
    ]);

    // replay
    const spark = h("canvas");
    refs.scrubFill = h("i");
    refs.scrubKnob = h("b");
    refs.scrubTime = h("div", { class: "tc" }, "00:00 / 00:00");
    refs.playBtn = h("button", { class: "pb", onclick: () => G.engine.pause() }, "⏸");
    refs.replayTag = h("span", { class: "tag" }, "REC ●");
    const track = h("div", { class: "track", onclick: () => { } }, [refs.scrubFill, refs.scrubKnob]);
    const replay = h("div", { class: "panel replay" }, [
      h("div", { class: "replay-h" }, [h("span", null, "◉ Mission Replay & Telemetry"), refs.replayTag]),
      h("div", { class: "spark" }, spark),
      h("div", { class: "scrub" }, [refs.playBtn, track, refs.scrubTime]),
    ]);
    G.viz.attachSpark(spark);

    mount($("#deck"), [cmd, replay]);
  }
  function chip(label, onclick) { return h("button", { class: "chip", onclick }, label); }
  function onCmdKey(e) { if (e.key === "Enter") submitCmd(); }
  function submitCmd() {
    const v = refs.cmdInput.value.trim();
    if (!v) return;
    if (refs.cmdInput.dataset.mode === "redirect") {
      G.engine.redirect(v);
      refs.cmdInput.value = ""; refs.cmdInput.dataset.mode = "";
      refs.cmdInput.placeholder = "Give GHOST a mission…";
      return;
    }
    const mode = classify(v);
    refs.cmdInput.value = "";
    launchFromPrompt(v, mode);
  }
  function classify(v) {
    const s = v.toLowerCase();
    if (/incident|down|failing|500|outage|broken|war ?room/.test(s)) return "warroom";
    if (/research|investigate|compare|report|study/.test(s)) return "research";
    if (/lead|proposal|client|crm|monthly|ops|operation|company/.test(s)) return "company";
    if (/voice|onehand|hands|accessib/.test(s)) return "onehand";
    return "build";
  }

  /* ============================================================
     LAUNCHER OVERLAY
     ============================================================ */
  function launchFromPrompt(prompt, mode) {
    const mission = DATA.missions[mode] || DATA.missions.build;
    const el = $("#launcher");
    el.hidden = false;
    const plan = h("div", { class: "launch-plan" });
    mission.steps.forEach((s, i) => plan.appendChild(h("div", { class: "pl", style: { animationDelay: (i * 60) + "ms" } }, [
      h("span", { class: "i" }, i + 1), h("span", null, s.title),
    ])));
    mount(el, h("div", { class: "sheet" }, [
      h("div", { class: "sheet-h" }, [h("h3", null, "Mission Briefing"), h("button", { class: "x", onclick: () => (el.hidden = true) }, "✕")]),
      h("div", { class: "launcher-body" }, [
        h("div", { class: "launch-title" }, DATA.modes.find((m) => m.id === mode).name + " Mode"),
        h("div", { class: "launch-mission" }, [
          h("div", { class: "faint up", style: { fontSize: "9px", marginBottom: "6px" } }, "Directive"),
          h("div", { class: "q" }, "“" + prompt + "”"),
        ]),
        h("div", { class: "faint up", style: { fontSize: "9px", margin: "16px 0 4px" } }, "GHOST plan · " + mission.steps.length + " phases"),
        plan,
        h("div", { class: "launch-actions" }, [
          h("button", { class: "launch-go", onclick: () => { el.hidden = true; G.engine.setMode(mode); } }, "▸ DEPLOY MISSION"),
          h("button", { class: "launch-cancel", onclick: () => (el.hidden = true) }, "Cancel"),
        ]),
      ]),
    ]));
  }

  /* ============================================================
     HOME LAB 3D
     ============================================================ */
  function openHomelab() {
    const el = $("#homelab");
    el.hidden = false;
    const scene = h("div", { class: "lab-scene" });
    scene.appendChild(h("div", { class: "lab-floor" }));
    const n = DATA.labDevices.length, R = 210;
    DATA.labDevices.forEach((d, i) => {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      const node = h("div", { class: "lab-node", style: { transform: `translate(-50%,-50%) translate3d(${x}px, ${(i % 2 ? -1 : 1) * 22}px, ${z}px) rotateY(${-a}rad)` } }, [
        h("div", { class: "n" }, [h("span", { class: "dot ok" }), d.name]),
        h("div", { class: "ico" }, d.ico),
        h("div", { class: "k" }, d.kind),
      ]);
      scene.appendChild(node);
    });
    mount(el, h("div", { class: "sheet", style: { width: "min(880px,92vw)" } }, [
      h("div", { class: "sheet-h" }, [h("h3", null, "🧊 Home Lab · Physical Fleet"), h("button", { class: "x", onclick: () => (el.hidden = true) }, "✕")]),
      h("div", { class: "sheet-body" }, [
        h("div", { class: "lab-stage" }, scene),
        h("div", { class: "lab-cap" }, "Live 3D map of connected hardware. GHOST can power-cycle any node via smart plugs, take over a frozen machine through PiKVM-01, and migrate a running mission to another workstation — resuming from the last checkpoint."),
      ]),
    ]));
  }

  /* ============================================================
     EMERGENCY + TOASTS
     ============================================================ */
  function onKill() {
    if (G.state.locked) { G.engine.restore(); document.body.classList.remove("lockdown"); return; }
    G.engine.emergencyStop();
    document.body.classList.add("lockdown");
    toast("danger", "⛔", "EMERGENCY STOP engaged. All agents halted, fleet powered down.", 0, [
      { label: "RESTORE FLEET", onclick: (tEl) => { G.engine.restore(); document.body.classList.remove("lockdown"); tEl.remove(); } },
    ]);
  }
  function toast(kind, ic, text, ttl, actions) {
    const stack = $("#toast");
    const el = h("div", { class: "toast " + (kind || "") }, [
      h("span", { class: "ic" }, ic || "•"),
      h("div", null, [
        h("div", null, text),
        actions ? h("div", { style: { marginTop: "7px", display: "flex", gap: "6px" } },
          actions.map((a) => h("button", { class: "chip", style: { borderColor: "var(--danger)", color: "var(--danger-bright)" }, onclick: () => a.onclick(el) }, a.label))) : null,
      ]),
    ]);
    stack.appendChild(el);
    if (ttl !== 0) setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 300); }, ttl || 4200);
  }

  /* ============================================================
     SMALL HELPERS + WIRING
     ============================================================ */
  function panelH(title, right) {
    return h("div", { class: "panel-h" }, [h("span", { class: "led" }), h("span", null, title), right || null]);
  }

  function onVoice() {
    if (refs.voiceBtn.classList.contains("live")) return;
    refs.voiceBtn.classList.add("live");
    toast("ok", "🎙️", "Listening… (voice input simulated for this demo)");
    setTimeout(() => {
      addMessageRaw("You", "“GHOST — wake the lab, pull last night's leads, put the roofing quote on the big screen.”");
      setTimeout(() => { refs.voiceBtn.classList.remove("live"); G.engine.setMode("onehand"); }, 900);
    }, 1600);
  }
  function addMessageRaw(name, text) {
    addMessage({ agent: { name, role: "Operator", color: "#eafffd", av: "◈" }, text, kind: "msg", time: new Date() });
  }

  function updateMeters(m) {
    refs.cost.textContent = G.money(m.cost);
    refs.tok.textContent = G.compact(m.tokens);
    refs.rate.textContent = G.compact(m.rate) + "/s";
    refs.costBar.style.width = Math.min(100, m.cost / 6 * 100) + "%";
    refs.tokBar.style.width = Math.min(100, m.tokens / 480000 * 100) + "%";
    refs.tokBar.className = "amber";
  }
  function updateTick(s) {
    const up = Math.floor((Date.now() - s.uptimeStart) / 1000);
    refs.clock.textContent = G.dur(up).length > 5 ? G.dur(up) : "00:" + G.dur(up);
    refs.clock.textContent = new Date(up * 1000).toISOString().substr(11, 8);
    refs.statAgents.textContent = s.stats.agentsActive;
    refs.statMachines.textContent = s.stats.machinesOnline;
    refs.statAnom.textContent = s.stats.anomaliesCaught;
    // scrubber
    const frac = s.totalDur ? G.clampv(s.simTime / s.totalDur, 0, 1) : 0;
    refs.scrubFill.style.width = (frac * 100) + "%";
    refs.scrubKnob.style.left = (frac * 100) + "%";
    refs.scrubTime.textContent = G.dur(s.simTime) + " / " + G.dur(s.totalDur);
    refs.playBtn.textContent = s.paused || !s.running ? "▶" : "⏸";
    refs.replayTag.textContent = s.complete ? "◉ SAVED" : s.running && !s.paused ? "REC ●" : "❚❚ PAUSED";
  }
  function updateThreat(level) {
    const map = { nominal: ["ok", "THREAT · NOMINAL", ""], elevated: ["warn", "THREAT · ELEVATED", "warn"], lockdown: ["danger", "⛔ LOCKDOWN", "danger"] };
    const [dot, label, cls] = map[level] || map.nominal;
    refs.threat.className = "threat " + cls;
    refs.threat.innerHTML = "";
    G.append(refs.threat, [h("span", { class: "dot " + dot }), h("span", null, label)]);
  }
  function updateModeUI(mode) {
    Object.entries(refs.modeBtns).forEach(([id, b]) => b.classList.toggle("active", id === mode));
    refs.mode.textContent = mode.toUpperCase();
  }

  function wire() {
    G.bus.on("feed", addMessage);
    G.bus.on("machine", updateMachine);
    G.bus.on("machine:all", updateAllMachines);
    G.bus.on("metrics", updateMeters);
    G.bus.on("tick", updateTick);
    G.bus.on("step", renderTimeline);
    G.bus.on("mission:start", (mission) => { refs.missionTitle.textContent = mission.title; refs.missionTitle.title = mission.title; renderTimeline(); refreshControls(); updateThreat(G.state.threat); });
    G.bus.on("mission:end", () => { renderTimeline(); refreshControls(); });
    G.bus.on("gate", () => refreshControls());
    G.bus.on("control", () => refreshControls());
    G.bus.on("anomaly", showAnomaly);
    G.bus.on("mode", updateModeUI);
    G.bus.on("emergency", () => { updateThreat("lockdown"); refreshControls(); });
    G.bus.on("restore", () => { updateThreat("nominal"); refreshControls(); });
    G.bus.on("toast", (t) => toast(t.kind, t.ic, t.text));
  }

  G.ui = { boot, buildAll: function () { buildTopbar(); buildRail(); buildGrid(); buildTimeline(); buildMap(); buildFeed(); buildAnomaly(); buildControls(); buildDeck(); wire(); }, toast, emergency: onKill };
})();
