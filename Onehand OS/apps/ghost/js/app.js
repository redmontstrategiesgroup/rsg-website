/* ============================================================
   GHOST // app.js — bootstrap
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;

  function init() {
    // ambient visuals run immediately (during boot)
    G.viz.starfield();
    G.viz.startLoop();

    G.ui.boot(function () {
      document.getElementById("shell").hidden = false;
      G.ui.buildAll();
      G.engine.run();
      // auto-launch the flagship Build mission so the room comes alive
      setTimeout(function () { G.engine.start("build"); }, 700);
    });

    // keyboard: space = pause/resume, Esc closes overlays
    document.addEventListener("keydown", function (e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.code === "Space") { e.preventDefault(); G.engine.pause(); }
      if (e.key === "Escape") { ["homelab", "launcher"].forEach((id) => { const el = document.getElementById(id); if (el) el.hidden = true; }); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
