/* NEXUS sim — the tick engine: time, schedules, movement, encounters, day rollover */
(function () {
  const SIM = (NX.sim = {});
  const TICK_MIN = 30;          // one tick = 30 game minutes
  SIM.TICKS_PER_DAY = (24 * 60) / TICK_MIN;

  // where should r be right now?
  SIM.targetFor = function (state, r) {
    const h = Math.floor(state.minute / 60);
    if (r.inJail || r.missing || !r.alive) return "precinct";
    // sleep
    if (h >= 23 || h < 7) return r.home;
    // work
    const employed = r.employedAt && NX.economy.biz(state, r.employedAt)?.open;
    if (employed) {
      const b = NX.economy.biz(state, r.employedAt);
      const isNight = b.type === "night";
      if (!isNight && h >= 9 && h < 17) return b.building;
      if (isNight && (h >= 17 || h < 1)) return b.building;
    }
    // civic / informal jobs
    if (!r.employedAt && r.wage) {
      if (["police captain", "patrol officer", "detective"].includes(r.job.title) && h >= 8 && h < 18) return "precinct";
      if (["mayor", "city clerk"].includes(r.job.title) && h >= 9 && h < 17) return "cityhall";
      if (r.job.title === "bike courier" && h >= 9 && h < 18) return NX.R.pick(["market", "diner", "cityhall", "garage"]);
      if (r.faction === "gang" && h >= 12) return "blackline";
    }
    // unemployed daytime: job hunting / moping / protest
    if (!r.employedAt && !r.wage && h >= 9 && h < 17) {
      if (state.flags.protestFormed && r.mood < -10 && NX.R.chance(0.6)) return "cityhall";
      return NX.R.chance(0.5) ? NX.R.pick(["market", "diner", "garage", "park"]) : r.home;
    }
    // evening social
    if (h >= 17 && h < 23) {
      const spot = { market: "market", diner: "diner", club: "club", blackline: "blackline", park: "park", cityhall: "cityhall" }[r.social] || "park";
      return NX.R.chance(0.75) ? spot : r.home;
    }
    return r.home;
  };

  SIM.moveToward = function (state, ent, targetBid, speed) {
    const b = state.buildings.find((x) => x.id === targetBid);
    if (!b) return;
    if (!ent._dest || ent._destB !== targetBid) {
      ent._dest = { x: b.gx + 0.3 + NX.R.val() * (b.gw - 0.6), y: b.gy + 0.3 + NX.R.val() * (b.gh - 0.6) };
      ent._destB = targetBid;
    }
    const dx = ent._dest.x - ent.pos.x, dy = ent._dest.y - ent.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.15) { ent.at = targetBid; return; }
    ent.at = "street";
    ent.pos.x += (dx / d) * Math.min(speed, d);
    ent.pos.y += (dy / d) * Math.min(speed, d);
  };

  // ---- one tick -------------------------------------------------------
  SIM.tick = function (state, opts = {}) {
    const fast = !!opts.fast; // offline catch-up: skip cosmetic work
    state.counters.ticks++;
    state.minute += TICK_MIN;

    const rolled = state.minute >= 24 * 60;
    if (rolled) {
      state.minute = 0;
      state.day++;
      SIM.newDay(state);
    }

    // opening scenario fires at 08:00 on day 1
    if (state.day === 1 && state.minute === 8 * 60) NX.events.openingScenario(state);

    // residents decide + move (2 movement substeps per tick for smoothness)
    for (const r of state.residents) {
      if (!r.alive || r.missing) continue;
      if (r.inJail) { r.at = "precinct"; continue; }
      const tgt = SIM.targetFor(state, r);
      const spd = fast ? 99 : 0.65; // catch-up teleports
      SIM.moveToward(state, r, tgt, spd);
      // mood/energy drift
      const h = Math.floor(state.minute / 60);
      r.energy = NX.clamp(r.energy + ((h >= 23 || h < 7) ? 6 : -1.5), 0, 100);
      if (r.energy < 15) r.mood = NX.clamp(r.mood - 1, -100, 100);
    }

    // co-located gossip: sample a few pairs
    const byLoc = {};
    for (const r of state.residents) {
      if (!r.alive || r.inJail || r.missing || r.at === "street") continue;
      (byLoc[r.at] = byLoc[r.at] || []).push(r);
    }
    for (const group of Object.values(byLoc)) {
      if (group.length < 2) continue;
      const tries = Math.min(2, Math.floor(group.length / 2));
      for (let i = 0; i < tries; i++) {
        const [a, b] = NX.R.shuffle(group);
        if (a !== b && NX.R.chance(0.25 + a.chattiness * 0.35)) NX.social.gossip(state, a, b);
      }
    }

    // random events
    NX.events.tick(state);

    return rolled;
  };

  // ---- day rollover ---------------------------------------------------
  SIM.newDay = function (state) {
    const notes = NX.economy.daily(state);
    NX.events.daily(state);
    NX.feed.daily(state);
    NX.events.digest(state, notes);
  };

  // ---- batch runner (skip-day / offline catch-up) ---------------------
  SIM.runTicks = function (state, n, fast = true) {
    for (let i = 0; i < n; i++) SIM.tick(state, { fast });
  };

  SIM.ticksUntilMorning = function (state) {
    const nowTick = Math.floor(state.minute / TICK_MIN);
    const morningTick = Math.floor((7 * 60) / TICK_MIN);
    const perDay = SIM.TICKS_PER_DAY;
    return nowTick < morningTick ? morningTick - nowTick : perDay - nowTick + morningTick;
  };
})();
