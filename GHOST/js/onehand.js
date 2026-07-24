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

  function defaultProfile() {
    return { hand: "right", thumbReach: "limited", fingers: 2, grip: "weak", fatigue: "low", inputs: ["voice", "foot"], targetScale: 1.5 };
  }

  // the command palette PHANTOM HAND can surface — most-used, low-effort
  const ACTIONS = [
    { act: "ask", ico: "❯", label: "Ask GHOST" },
    { act: "map", ico: "🗺️", label: "System Map" },
    { act: "ops", ico: "📡", label: "Live Ops" },
    { act: "approvals", ico: "✓", label: "Approvals" },
    { act: "audit", ico: "🧾", label: "Audit" },
    { act: "workspace", ico: "🖥️", label: "Start Workspace" },
    { act: "voice", ico: "🎙️", label: "Voice" },
    { act: "stop", ico: "⛔", label: "Pause All", danger: true },
  ];

  // build a reach-optimized, fatigue-aware layout from the profile
  function generateLayout(profile) {
    profile = profile || active || defaultProfile();
    let items = ACTIONS.slice();
    // fatigue-high → fewer, larger targets (reduce cognitive + motor load)
    const max = profile.fatigue === "high" ? 5 : profile.fingers <= 1 ? 6 : 8;
    items = items.slice(0, max);
    const targetPx = Math.round(56 * (profile.targetScale || 1.4) * (profile.fatigue === "high" ? 1.15 : 1));
    const reach = profile.hand === "left" ? "lower-left" : "lower-right";
    // arc of comfortable reach for the chosen hand (degrees)
    const arc = profile.hand === "left" ? [150, 270] : [270, 390];
    return {
      items, targetPx, reach, arc,
      stickyMods: profile.grip === "weak" || profile.fingers <= 2,
      voice: profile.inputs.includes("voice"),
      foot: profile.inputs.includes("foot"),
      radius: Math.min(150, 96 + items.length * 6),
    };
  }

  function dispatch(item) {
    if (item.danger && !item._armed) { item._armed = true; flashArm(item); return; } // 2-step guard
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
  function flashArm(item) {
    const el = dock && dock.querySelector(`[data-act="${item.act}"]`);
    if (el) { el.classList.add("armed"); setTimeout(() => { item._armed = false; el.classList.remove("armed"); }, 2200); }
  }

  function renderDock() {
    if (dock) dock.remove();
    const L = generateLayout(active);
    dock = h("div", { class: "oh-dock " + L.reach, id: "oh-dock" });
    document.body.appendChild(dock);

    // status header
    dock.appendChild(h("div", { class: "oh-head" }, [
      h("span", { class: "oh-badge" }, "✋ PHANTOM HAND"),
      h("span", { class: "oh-sub" }, `${active.hand} hand · ${L.stickyMods ? "sticky mods" : "direct"} · reach-opt`),
      h("button", { class: "oh-x", title: "Exit OneHand", onclick: () => G.onehand.deactivate() }, "✕"),
    ]));

    // radial menu in the reach arc
    const ring = h("div", { class: "oh-ring", style: { width: L.radius * 2 + "px", height: L.radius * 2 + "px" } });
    const [a0, a1] = L.arc;
    L.items.forEach((item, i) => {
      const frac = L.items.length === 1 ? 0.5 : i / (L.items.length - 1);
      const ang = (a0 + (a1 - a0) * frac) * Math.PI / 180;
      const x = L.radius + Math.cos(ang) * L.radius - L.targetPx / 2;
      const y = L.radius + Math.sin(ang) * L.radius - L.targetPx / 2;
      const btn = h("button", {
        class: "oh-item" + (item.danger ? " danger" : ""), data: { act: item.act },
        style: { width: L.targetPx + "px", height: L.targetPx + "px", left: x + "px", top: y + "px" },
        title: item.label + "  (press " + (i + 1) + ")",
        onclick: () => dispatch(item),
      }, [h("span", { class: "oh-ic" }, item.ico), h("span", { class: "oh-lbl" }, item.label), h("span", { class: "oh-key" }, i + 1)]);
      ring.appendChild(btn);
    });
    // center hub
    ring.appendChild(h("div", { class: "oh-hub", style: { left: L.radius - 30 + "px", top: L.radius - 30 + "px" } }, "👻"));
    dock.appendChild(ring);

    // capability quick-adjust + input aids
    dock.appendChild(h("div", { class: "oh-foot" }, [
      L.voice ? h("span", { class: "oh-aid" }, "🎙️ voice") : null,
      L.foot ? h("span", { class: "oh-aid" }, "🦶 foot-pedal = confirm") : null,
      h("span", { class: "oh-aid" }, "⌨︎ keys 1–" + L.items.length),
      h("button", { class: "oh-swap", onclick: () => { active.hand = active.hand === "right" ? "left" : "right"; renderDock(); } }, "⇄ swap hand"),
    ]));
  }

  function onKey(e) {
    if (!active) return;
    const n = parseInt(e.key, 10);
    const L = generateLayout(active);
    if (n >= 1 && n <= L.items.length) { e.preventDefault(); dispatch(L.items[n - 1]); }
  }

  function activate(profile) {
    active = profile || active || defaultProfile();
    document.body.classList.add("onehand");
    document.documentElement.style.setProperty("--oh-scale", String(active.targetScale || 1.4));
    G.store && G.store.setting("onehand", active);
    renderDock();
    document.addEventListener("keydown", onKey);
    G.bus.emit("onehand", { active: true, profile: active });
  }
  function deactivate() {
    document.body.classList.remove("onehand");
    document.documentElement.style.removeProperty("--oh-scale");
    if (dock) { dock.remove(); dock = null; }
    document.removeEventListener("keydown", onKey);
    G.store && G.store.setting("onehand", null);
    G.bus.emit("onehand", { active: false });
    active = null;
  }
  function isActive() { return !!active; }

  G.onehand = { defaultProfile, generateLayout, activate, deactivate, isActive, renderDock, get profile() { return active; } };
})();
