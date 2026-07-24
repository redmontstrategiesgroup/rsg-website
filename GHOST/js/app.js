/* ============================================================
   GHOST // app.js — bootstrap + router glue
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;

  function init() {
    // ambient visuals run immediately (during boot)
    G.viz.starfield();
    G.viz.startLoop();

    G.ui.boot(function () {
      // 1) seed the persistent world model (first run only)
      G.world.seed();

      // 2) reveal the app frame
      document.getElementById("app").hidden = false;

      // 3) build the Live-Ops command center + the operational views
      G.ui.buildAll();
      G.shell.build();

      // 4) start the live-ops simulation loop + flagship mission
      G.engine.run();
      setTimeout(function () { G.engine.start("build"); }, 500);

      // 5) restore prior view + OneHand state
      const view = G.store.setting("activeView") || "ops";
      G.shell.nav(view);
      const oh = G.store.setting("onehand");
      if (oh) G.onehand.activate(oh);
    });

    // keyboard: Esc closes overlays; Ctrl+K focuses the global command bar
    document.addEventListener("keydown", function (e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); G.bus.emit("oh:action", { type: "focus-command" }); return; }
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Escape") { ["homelab", "launcher"].forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; }); }
      if (e.code === "Space") { e.preventDefault(); G.engine.pause(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
