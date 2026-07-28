/* ============================================================
   GHOST // onehand.js — PHANTOM HAND accessibility subsystem
   A first-class operating mode: builds an adaptive one-handed
   control layout from a capability profile and materially
   reduces reach, precision, and key-combination effort.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const { h } = G;

  let active = null;   // active profile
  let dock = null;
  let input = null;    // RSGInput manager — real device state, never a checkbox

  /* Hardware is wired here, but it is never the only path: every action is
     registered with its on-screen dock button and its number key as fallbacks
     BEFORE anything is bound to a device. RSGInput refuses the bind otherwise. */
  function ensureInput() {
    if (input || !window.RSGInput) return input;
    /* gamepad-class (no prompt) + WebHID (prompt, covers pedals and switches
       that don't emulate a keyboard) */
    input = window.RSGInput.createManager({
      source: window.RSGInput.defaultSource(),
      storageKey: "ghost.input.mappings.v1"
    });
    ACTIONS.forEach((a, i) => {
      input.registerAction(a.act, a.label, ["on-screen", "keyboard:" + (i + 1)]);
    });
    input.on("action", (e) => {
      const item = ACTIONS.filter(a => a.act === e.actionId)[0];
      if (item) dispatch(item);
    });
    input.on("status", () => paintDeviceStatus());
    input.on("devicechange", () => paintDeviceStatus());
    return input;
  }

  /* The requirements are stated BEFORE the chooser opens, not in an error
     afterwards — "pair it in system settings first" is useless as a failure
     message. requestDevice() is called synchronously from this click so the
     browser still sees a user gesture. */
  function connectDevice() {
    if (!input) return;
    const el = dock && dock.querySelector("#oh-dev");
    if (el) { el.textContent = "… " + input.connectRequirements(); el.className = "oh-aid"; }
    input.requestDevice().then((res) => {
      if (!res.ok && el) {
        el.className = "oh-aid oh-alert";
        el.textContent = "⚠ " + (res.message || input.status().message);
      }
      paintDeviceStatus();
    });
  }

  /* Status is specific and honest — connected/none/disconnected/denied — and
     the disconnect notice is on-screen, so dismissing it never needs the
     device that just went away. */
  function paintDeviceStatus() {
    const el = dock && dock.querySelector("#oh-dev");
    if (!el || !input) return;
    const s = input.status();
    const ico = { "connected": "🎮", "disconnected": "⚠", "denied": "⚠", "no-device": "○", "unsupported": "○" }[s.state];
    el.textContent = ico + " " + (s.state === "connected"
      ? "device connected · " + s.capabilities.buttons + " button" + (s.capabilities.buttons === 1 ? "" : "s")
      : s.message);
    el.className = "oh-aid" + (s.state === "disconnected" || s.state === "denied" ? " oh-alert" : "");
  }

  // Shared Onehand OS profile (rsg.ability.v1) → GHOST's count-based shape.
  // Returns null when the shell hasn't written one.
  function sharedProfile() {
    try {
      const p = JSON.parse(localStorage.getItem("rsg.ability.v1") || "null");
      if (!p || p.v !== 1) return null;
      const count = ["thumb", "index", "middle", "ring", "pinky"]
        .filter(f => p.fingers && p.fingers[f]).length;
      return {
        hand: p.hand === "left" ? "left" : "right",
        thumbReach: (typeof p.reachMM === "number" ? p.reachMM : 95) < 80 ? "limited" : "full",
        fingers: count || 1,
        grip: p.grip || "moderate",
        fatigue: p.fatigue || "low",
        // passed through untouched — absent means the resolver marks them
        // unresolved rather than quietly assuming a middle value
        precision: p.precision,
        permanence: p.permanence,
        inputs: Array.isArray(p.inputs) ? p.inputs : [],
        targetScale: typeof p.targetScale === "number" ? p.targetScale : 1.4,
      };
    } catch (e) { return null; }
  }

  function defaultProfile() {
    return sharedProfile() ||
      { hand: "right", thumbReach: "limited", fingers: 2, grip: "weak", fatigue: "low", inputs: ["voice", "foot"], targetScale: 1.5 };
  }

  // the command palette PHANTOM HAND can surface — most-used, low-effort
  // freq drives which actions survive a fatigue cap and how early they appear
  // in switch-scanning order — least frequent is deferred first, never whatever
  // happens to be declared last.
  const ACTIONS = [
    { act: "ask", ico: "❯", label: "Ask GHOST", freq: "high" },
    { act: "map", ico: "🗺️", label: "System Map", freq: "high" },
    { act: "ops", ico: "📡", label: "Live Ops", freq: "medium" },
    { act: "approvals", ico: "✓", label: "Approvals", freq: "high" },
    { act: "audit", ico: "🧾", label: "Audit", freq: "low" },
    { act: "workspace", ico: "🖥️", label: "Start Workspace", freq: "low" },
    { act: "voice", ico: "🎙️", label: "Voice", freq: "medium" },
    { act: "stop", ico: "⛔", label: "Pause All", freq: "low", danger: true },
  ];

  const GAP = 12;   // minimum clear space between neighbouring targets (fallback path)

  // GHOST's control requirements, as the shared resolver consumes them. This is
  // the *application* half of the contract; the person's capability profile is
  // the other half and travels with them across apps.
  function appProfile() {
    const avail = Math.min(340, (window.innerWidth || 360) - 44);
    return {
      id: "ghost",
      surface: { width: avail, height: window.innerHeight || 720 },
      actions: ACTIONS.map(a => ({
        id: a.act, label: a.label,
        frequency: a.freq || "medium",
        destructive: !!a.danger,
        gesture: "tap",
      })),
    };
  }

  // build a reach-optimized, fatigue-aware layout from the profile.
  // Delegates to the shared resolver (window.RSGAbility) so the capability →
  // layout mapping lives in one tested place; the inline path below is the
  // standalone fallback for when the shared library isn't served.
  function generateLayout(profile) {
    profile = profile || active || defaultProfile();

    if (window.RSGAbility) {
      const app = appProfile();
      const spec = window.RSGAbility.resolve(toCapability(profile), app);
      const shown = spec.placements.map(p => p.actionId);
      return {
        items: ACTIONS.filter(a => shown.indexOf(a.act) >= 0),
        targetPx: spec.target.minPx,
        gapPx: spec.target.gapPx,
        reach: spec.zones.anchor.corner === "bottom-left" ? "lower-left" : "lower-right",
        cols: Math.max(1, Math.min(3, spec.columns)),
        voice: spec.voice.enabled,
        foot: (profile.inputs || []).includes("foot"),
        spec,   // full specification, for anything that wants the reasoning
      };
    }

    // ---- fallback: no shared resolver available ----
    let items = ACTIONS.slice();
    const max = profile.fatigue === "high" ? 5 : profile.fingers <= 1 ? 6 : 8;
    items = items.slice(0, max);
    const targetPx = Math.round(56 * (profile.targetScale || 1.4) * (profile.fatigue === "high" ? 1.15 : 1));
    const reach = profile.hand === "left" ? "lower-left" : "lower-right";
    const avail = Math.min(340, (window.innerWidth || 360) - 44) - 24;
    const cols = Math.max(1, Math.min(3, Math.floor((avail + GAP) / (targetPx + GAP))));
    return {
      items, targetPx, reach, cols, gapPx: GAP,
      voice: profile.inputs.includes("voice"),
      foot: profile.inputs.includes("foot"),
    };
  }

  // GHOST's count-based shape → the resolver's capability vocabulary.
  function toCapability(p) {
    const n = p.fingers || 1;
    const order = ["thumb", "index", "middle", "ring", "pinky"];
    const fingers = {};
    order.forEach((f, i) => { fingers[f] = i < n; });
    return {
      hand: p.hand, fingers,
      reachMM: p.thumbReach === "limited" ? 70 : 100,
      grip: p.grip, fatigue: p.fatigue,
      precision: p.precision, permanence: p.permanence,
      inputs: p.inputs || [],
    };
  }

  function dispatch(item) {
    disarmAll(item);
    // 2-step guard on destructive actions. Deliberately NOT on a timer: a
    // confirm window that expires punishes exactly the slower, less predictable
    // movement this mode exists to support. The armed state waits indefinitely
    // and any other action cancels it.
    if (item.danger && !item._armed) { item._armed = true; armUI(item, true); return; }
    if (item.danger) { item._armed = false; armUI(item, false); }
    switch (item.act) {
      case "ask": G.bus.emit("oh:action", { type: "focus-command" }); break;
      case "map": G.bus.emit("oh:action", { type: "nav", view: "world" }); break;
      case "ops": G.bus.emit("oh:action", { type: "nav", view: "ops" }); break;
      case "approvals": G.bus.emit("oh:action", { type: "nav", view: "approvals" }); break;
      case "audit": G.bus.emit("oh:action", { type: "nav", view: "audit" }); break;
      case "workspace": G.bus.emit("oh:action", { type: "command", text: "Start my development workspace across both computers with one-handed controls" }); break;
      case "voice": G.bus.emit("oh:action", { type: "voice" }); break;
      case "stop": G.bus.emit("oh:action", { type: "emergency" }); break;
    }
  }
  function armUI(item, on) {
    const el = dock && dock.querySelector(`[data-act="${item.act}"]`);
    if (!el) return;
    el.classList.toggle("armed", on);
    const lbl = el.querySelector(".oh-lbl");
    if (lbl) lbl.textContent = on ? "Tap again to confirm" : item.label;
    el.setAttribute("aria-label", on ? item.label + " — tap again to confirm" : item.label);
  }
  function disarmAll(except) {
    ACTIONS.forEach(a => { if (a !== except && a._armed) { a._armed = false; armUI(a, false); } });
  }

  function renderDock() {
    if (dock) dock.remove();
    const L = generateLayout(active);
    dock = h("div", { class: "oh-dock " + L.reach, id: "oh-dock", role: "region", "aria-label": "Phantom Hand controls" });
    document.body.appendChild(dock);

    // status header — describes what this layout actually is, nothing more
    dock.appendChild(h("div", { class: "oh-head" }, [
      h("span", { class: "oh-badge" }, "✋ PHANTOM HAND"),
      h("span", { class: "oh-sub" }, `${active.hand} hand · ${L.items.length} actions · ${L.targetPx}px targets`),
      h("button", { class: "oh-x", title: "Exit OneHand", "aria-label": "Exit OneHand mode", onclick: () => G.onehand.deactivate() }, "✕"),
    ]));

    // reach grid — visual order matches DOM order, so tab and switch-scanning
    // walk the actions in the same sequence the eye does
    const grid = h("div", {
      class: "oh-grid",
      style: {
        gridTemplateColumns: `repeat(${L.cols}, minmax(0, 1fr))`,
        gap: (L.gapPx || 12) + "px",   // spacing is an ability output, not a constant
      },
    });
    L.items.forEach((item, i) => {
      const btn = h("button", {
        class: "oh-item" + (item.danger ? " danger" : ""), data: { act: item.act },
        style: { minHeight: L.targetPx + "px" },
        title: item.label + "  (press " + (i + 1) + ")",
        "aria-label": item.label,
        onclick: () => dispatch(item),
      }, [h("span", { class: "oh-ic" }, item.ico), h("span", { class: "oh-lbl" }, item.label), h("span", { class: "oh-key" }, i + 1)]);
      grid.appendChild(btn);
    });
    dock.appendChild(grid);

    // capability quick-adjust + input aids
    /* Aids listed here are the ones that actually exist right now. The pedal
       line reports the real device state rather than the profile checkbox —
       it previously said "🦶 foot-pedal = confirm" whether or not any pedal
       had ever been connected. */
    dock.appendChild(h("div", { class: "oh-foot" }, [
      L.voice ? h("span", { class: "oh-aid" }, "🎙️ voice") : null,
      h("span", { class: "oh-aid" }, "⌨︎ keys 1–" + L.items.length),
      h("span", { class: "oh-aid", id: "oh-dev" }, "○ checking for devices…"),
      /* Only offered when this browser can actually prompt, and the click
         itself is the user gesture WebHID requires. */
      (input && input.canRequestDevice())
        ? h("button", { class: "oh-swap", id: "oh-connect", onclick: connectDevice }, "＋ connect device")
        : null,
      h("button", { class: "oh-swap", onclick: () => { active.hand = active.hand === "right" ? "left" : "right"; renderDock(); } }, "⇄ swap hand"),
    ]));
    paintDeviceStatus();
  }

  function onKey(e) {
    if (!active) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Never swallow digits meant for a text field — the dock's own "Ask GHOST"
    // action focuses the command bar, so stealing them broke typing outright.
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    const n = parseInt(e.key, 10);
    const L = generateLayout(active);
    if (n >= 1 && n <= L.items.length) { e.preventDefault(); dispatch(L.items[n - 1]); }
  }

  // The shell is the sole writer of rsg.ability.v1; when it changes hand or
  // target scale, follow it live instead of waiting for a reload.
  window.addEventListener("storage", (e) => {
    if (e.key !== "rsg.ability.v1" || !active) return;
    const p = sharedProfile();
    if (!p) return;
    active = p;
    document.documentElement.style.setProperty("--oh-scale", String(active.targetScale || 1.4));
    renderDock();
  });

  function activate(profile) {
    active = profile || active || defaultProfile();
    document.body.classList.add("onehand");
    document.documentElement.style.setProperty("--oh-scale", String(active.targetScale || 1.4));
    G.store && G.store.setting("onehand", active);
    ensureInput();
    input && input.start();
    renderDock();
    document.addEventListener("keydown", onKey);
    G.bus.emit("onehand", { active: true, profile: active });
  }
  function deactivate() {
    document.body.classList.remove("onehand");
    document.documentElement.style.removeProperty("--oh-scale");
    if (dock) { dock.remove(); dock = null; }
    input && input.stop();
    document.removeEventListener("keydown", onKey);
    G.store && G.store.setting("onehand", null);
    G.bus.emit("onehand", { active: false });
    active = null;
  }
  function isActive() { return !!active; }

  G.onehand = { defaultProfile, generateLayout, activate, deactivate, isActive, renderDock,
    get profile() { return active; },
    get input() { return input; } };   // device status/mapping, for diagnostics
})();
