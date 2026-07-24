/* NEXUS app — boot, persistence, offline catch-up, main loop */
(function () {
  const APP = (NX.app = {});
  const SAVE_KEY = "nexus_world_v1";
  let state = null;
  let tickTimer = 0;

  // ---- persistence ----------------------------------------------------
  APP.save = function () {
    if (!state || APP._noSave) return;
    state.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage full — drop oldest feed */ state.feed.length = 40; }
  };

  APP.load = function () {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (s.v !== 1) return null;
      return s;
    } catch { return null; }
  };

  APP.reset = function () {
    APP._noSave = true;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  };

  // ---- offline catch-up ----------------------------------------------
  // 8 real hours away ≈ 1 city day, capped at 7 days
  APP.catchUp = function (s) {
    const hours = (Date.now() - (s.savedAt || Date.now())) / 3.6e6;
    const days = NX.clamp(Math.floor(hours / 8), 0, 7);
    if (days < 1) return 0;
    const startDay = s.day;
    NX.sim.runTicks(s, days * NX.sim.TICKS_PER_DAY, true);
    return s.day - startDay;
  };

  // ---- boot -----------------------------------------------------------
  const BOOT_LINES = [
    "initializing residents…", "wiring 30 nervous systems…", "seeding secrets…",
    "opening businesses…", "spreading first rumors…", "the city remembers you…",
  ];

  APP.start = function () {
    const bootEl = document.getElementById("bootline");
    let bi = 0;
    const bootAnim = setInterval(() => { if (bootEl) bootEl.textContent = BOOT_LINES[bi++ % BOOT_LINES.length]; }, 350);

    const saved = APP.load();
    let daysAway = 0;
    if (saved) {
      state = saved;
      NX.R.seed((state.seed + state.counters.ticks * 7919) | 0);
      daysAway = APP.catchUp(state);
    } else {
      state = NX.newWorld();
    }
    APP.state = state;

    setTimeout(() => {
      clearInterval(bootAnim);
      document.getElementById("boot").hidden = true;
      document.getElementById("shell").hidden = false;

      NX.map.init(document.getElementById("map"));
      NX.ui.init(state);
      NX.ui.setSpeed(state.speed ?? 1);

      if (daysAway > 0) {
        const digests = state.digests.filter((d) => d.d > state.day - daysAway - 1).slice(0, daysAway).reverse();
        NX.ui.showAway(daysAway, digests.length ? digests : state.digests.slice(0, daysAway).reverse());
        NX.ui.toast(`${daysAway} city day${daysAway > 1 ? "s" : ""} passed while you were gone.`, "gold");
      } else if (!saved) {
        NX.ui.toast("Welcome to Rusthook. Nobody knows you yet. That will change.", "gold");
      }

      APP.save();
      APP.loop();
    }, saved ? 900 : 1600);
  };

  // ---- main loop ------------------------------------------------------
  APP.loop = function () {
    // render loop
    const raf = () => { NX.map.render(state); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);

    // sim loop — base interval 250ms; tick cadence depends on speed
    let acc = 0, uiCounter = 0, saveCounter = 0;
    setInterval(() => {
      if (!state || state.speed === 0) return;
      acc += 250;
      const per = state.speed === 4 ? 500 : 2000; // ms per tick
      while (acc >= per) {
        acc -= per;
        NX.sim.tick(state);
        NX.ui.renderTop();
        uiCounter++; saveCounter++;
        if (uiCounter >= 2) {
          uiCounter = 0;
          const tab = NX.ui.activeTab();
          if (["city", "news", "feed", "people"].includes(tab) && !state._showCard) NX.ui.renderTab(tab);
        }
        if (saveCounter >= 2) { saveCounter = 0; APP.save(); } // autosave each game hour
      }
    }, 250);

    window.addEventListener("beforeunload", APP.save);
    document.addEventListener("visibilitychange", () => { if (document.hidden) APP.save(); });
  };

  // ---- skip to next morning ------------------------------------------
  APP.skipDay = function () {
    const n = NX.sim.ticksUntilMorning(state);
    NX.sim.runTicks(state, n, true);
    APP.save();
    NX.ui.renderAll();
    const d = state.digests[0];
    if (d) NX.ui.toast(`DAY ${state.day} — ` + (d.lines[0] || "the city turned over in its sleep."), "gold");
  };

  window.addEventListener("DOMContentLoaded", APP.start);
})();
