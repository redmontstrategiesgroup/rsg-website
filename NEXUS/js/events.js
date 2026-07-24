/* NEXUS events — opening scenario, emergent events, election, arrests */
(function () {
  const EV = (NX.events = {});

  EV.log = function (state, text, kind = "social") {
    state.eventLog.unshift({ d: state.day, m: state.minute, text, kind });
    if (state.eventLog.length > 300) state.eventLog.length = 300;
    NX.ui?.tick?.(text);
  };

  // ---- opening scenario: the plant closes -----------------------------
  EV.openingScenario = function (state) {
    if (state.flags.opening) return;
    state.flags.opening = true;
    const plant = NX.economy.biz(state, "plant");
    const laidOff = plant.employees.slice();
    plant.open = false; plant.closedDay = state.day;
    for (const id of laidOff) {
      const r = state.residents.find((x) => x.id === id);
      if (!r) continue;
      r.employedAt = null; r.wage = null;
      r.mood = NX.clamp(r.mood - 30, -100, 100);
      NX.social.remember(state, r, { text: "lost everything when the Halcyon plant closed with one day's notice", about: "plant", imp: 5, kind: "life" });
    }
    EV.log(state, "THE HALCYON ASSEMBLY PLANT HAS CLOSED. 9 residents lost their jobs overnight. A note on the gate reads: 'Operational restructuring.'", "econ");
    NX.feed.post(state, "news", "BREAKING: Halcyon Assembly Plant closed overnight. No warning, no severance schedule announced. District unemployment set to spike.", "news");
    NX.feed.post(state, "dequan", "They locked the gates. LOCKED THE GATES. Fifteen years and a padlock is my severance. Somebody knew about this.", "chatter");
    NX.feed.post(state, "anon", "funny how meridian development filed paperwork on that exact lot last month. probably nothing.", "rumor");
    NX.feed.post(state, "okafor", "If the closure was planned while City Hall smiled at us, Rusthook deserves to know. I'm asking questions. #Okafor4Rusthook", "chatter");
    // seed the truth-holders' knowledge as memories
    const seed = (id, text) => {
      const r = state.residents.find((x) => x.id === id);
      if (r) NX.social.remember(state, r, { text, about: "plant", imp: 5, kind: "secret", cred: 1 });
    };
    seed("greta", "the plant's own ledgers showed a profit the quarter it closed — the 'restructuring' story is a lie");
    seed("lena", "a memo crossed my desk: the plant land was being sold to Meridian Development before the closure was announced");
    seed("hale", "the land-transfer file shows the plant lot sold to Meridian Development for a fraction of its value");
    seed("june", "the night before the closure I delivered a fat envelope from City Hall to the Blackline Bar");
    seed("teddy", "Meridian Development is the same shell outfit that gutted the cannery in '98 — different name, same signature");
  };

  // ---- per-tick random events ----------------------------------------
  EV.tick = function (state) {
    const eco = state.economy;
    const hour = Math.floor(state.minute / 60);

    // desperation crime
    if (NX.R.chance(0.05 + eco.unemployment * 0.12)) {
      const desperate = state.residents.filter((r) => r.alive && !r.inJail && !r.missing && !r.employedAt && !r.wage && r.money < 130 && r.morality < 0.6);
      if (desperate.length) {
        const thief = NX.R.pick(desperate);
        const targets = state.businesses.filter((b) => b.open && b.cash > 200 && b.type !== "civic");
        if (targets.length && NX.R.chance(0.7)) {
          const b = NX.R.pick(targets);
          const take = NX.R.int(40, 160);
          b.cash -= take; thief.money += take;
          state.counters.crimes++; state.counters.crimesToday = (state.counters.crimesToday || 0) + 1;
          thief.morality = Math.max(0, thief.morality - 0.05);
          NX.social.remember(state, thief, { text: `stole ${NX.money(take)} from ${b.name}`, about: null, imp: 4, kind: "crime" });
          const seen = NX.social.witness(state, b.building, `${thief.name} stole from ${b.name}`, { about: thief.id, imp: 4, exceptId: thief.id });
          EV.log(state, `Theft at ${b.name} — ${NX.money(take)} missing.${seen.length ? "" : " No witnesses."}`, "crime");
          if (seen.length && NX.R.chance(0.4)) NX.feed.post(state, seen[0].id, `Just watched somebody walk out of ${b.name} with the till short. This district, man.`, "rumor");
          if (seen.length && NX.R.chance(0.25 + eco.policeBudget * 0.04)) EV.arrest(state, thief, `the theft at ${b.name}`);
        }
      }
    }

    // gang recruitment of the desperate (evenings at the Blackline)
    if (hour >= 19 && NX.R.chance(0.06 + eco.unemployment * 0.1)) {
      const marks = state.residents.filter((r) => r.alive && !r.inJail && !r.missing && !r.employedAt && !r.wage && r.money < 150 && r.faction !== "gang" && r.faction !== "police" && r.morality < 0.7);
      if (marks.length) {
        const m = NX.R.pick(marks);
        if (NX.R.chance(1 - m.morality)) {
          m.faction = "gang"; m.wage = 14; m.job = { biz: null, title: "…odd jobs" };
          m.social = "blackline";
          NX.social.remember(state, m, { text: "took work from the Red Knives — it pays, and questions don't", about: null, imp: 5, kind: "life" });
          EV.log(state, `${m.name} has started running with the Red Knives.`, "crime");
          if (!state.flags.recruitDrive) { state.flags.recruitDrive = true; NX.feed.post(state, "anon", "the knives are hiring out of the blackline. they always are when the city stops.", "rumor"); }
        } else {
          NX.social.remember(state, m, { text: "turned down an offer from the Red Knives at the Blackline", about: null, imp: 4, kind: "life" });
        }
      }
    }

    // protest formation (day 2+, angry unemployed reach critical mass)
    if (!state.flags.protestFormed && state.day >= 2) {
      const angry = state.residents.filter((r) => r.alive && !r.employedAt && !r.wage && r.mood < -15);
      if (angry.length >= 3 && NX.R.chance(0.12)) {
        state.flags.protestFormed = true;
        const names = angry.slice(0, 3).map((r) => r.name);
        for (const r of angry) { r.social = "cityhall"; NX.social.remember(state, r, { text: "joined the plant-closure protest outside City Hall", about: "protest", imp: 4, kind: "life" }); }
        EV.log(state, `A protest group formed outside City Hall, led by ${names[0]}. They want answers about the plant.`, "politics");
        NX.feed.post(state, "news", `Former Halcyon workers have begun a standing protest at City Hall. "${names[0]}" says they won't move until someone explains the closure.`, "news");
        NX.social.rep(state, "workers", 0);
      }
    }

    // social friction / romance sparks at shared venues
    if (NX.R.chance(0.15)) {
      const here = {};
      for (const r of state.residents) {
        if (!r.alive || r.inJail || r.missing) continue;
        (here[r.at] = here[r.at] || []).push(r);
      }
      for (const [loc, group] of Object.entries(here)) {
        if (group.length < 2 || !NX.R.chance(0.3)) continue;
        const [a, b] = NX.R.shuffle(group);
        const rel = a.relationships[b.id] || 0;
        if (rel < -15 && NX.R.chance(0.3 + a.temper * 0.3)) {
          NX.social.adjustRel(a, b.id, -5);
          const bld = state.buildings.find((x) => x.id === loc);
          EV.log(state, `${a.name} and ${b.name} argued loudly at ${bld ? bld.name : loc}.`, "social");
          NX.social.witness(state, loc, `${a.name} argued with ${b.name}`, { about: a.id, imp: 2 });
        } else if (rel > 25 && !a.partner && !b.partner && Math.abs(a.age - b.age) < 12 && NX.R.chance(0.1)) {
          a.partner = b.id; b.partner = a.id;
          NX.social.adjustRel(a, b.id, 20); NX.social.adjustRel(b, a.id, 20);
          EV.log(state, `${a.name} and ${b.name} are seeing each other now. The district noticed immediately.`, "social");
          NX.feed.post(state, "rosa", `Not saying who, but two regulars of mine are suddenly buying groceries together. Lovely.`, "chatter");
        }
      }
    }

    // Malley tips the Knives / Sato watches (flavor thread)
    if (state.day >= 3 && hour === 21 && NX.R.chance(0.15)) {
      const sato = state.residents.find((r) => r.id === "sato");
      if (sato) NX.social.remember(state, sato, { text: "watched Det. Malley slip into the Blackline again after dark", about: "malley", imp: 4, kind: "witness" });
    }
  };

  // ---- arrest ---------------------------------------------------------
  EV.arrest = function (state, r, why) {
    r.inJail = NX.R.int(2, 4); // days
    r.arrests++;
    state.counters.arrests++;
    if (r.employedAt) {
      const b = NX.economy.biz(state, r.employedAt);
      if (b && NX.R.chance(0.5)) NX.economy.fire(state, r.id, b, "arrested");
    }
    EV.log(state, `${r.name} was ARRESTED for ${why}. Held at Precinct 9.`, "crime");
    NX.feed.post(state, "news", `Precinct 9 confirms an arrest in connection with ${why}.`, "news");
    NX.social.witness(state, r.at, `${r.name} got arrested (${why})`, { about: r.id, imp: 4, exceptId: r.id });
  };

  // ---- election -------------------------------------------------------
  EV.electionSupport = function (state) {
    let vas = 0, oka = 0, und = 0;
    for (const r of state.residents) {
      if (!r.alive || r.missing) continue;
      let lean = r.lean;
      // dynamic drift: unemployment & closure anger pushes to Okafor; stability & business pushes Vasquez
      const jobless = !r.employedAt && !r.wage;
      let score = (lean === "vasquez" ? 2 : lean === "okafor" ? -2 : 0);
      score += r.faction === "business" ? 1.5 : 0;
      score += r.faction === "gang" ? 1 : 0;
      score -= jobless ? 2 : 0;
      score -= state.flags.truthOut ? 2.5 : 0;
      score -= (r.mood < -20 ? 1 : 0);
      if (score > 0.8) vas++; else if (score < -0.8) oka++; else und++;
    }
    return { vasquez: vas, okafor: oka, undecided: und };
  };

  EV.electionDaily = function (state) {
    if (state.election.done) return;
    const p = EV.electionSupport(state);
    state.election.polls.push({ d: state.day, ...p });
    if (state.day === state.election.day) {
      const winner = p.okafor > p.vasquez ? "okafor" : "vasquez";
      state.election.done = true; state.election.winner = winner;
      const wname = winner === "okafor" ? "Ray Okafor" : "Elena Vasquez";
      EV.log(state, `ELECTION DAY: ${wname} wins the mayoralty of Rusthook, ${Math.max(p.okafor, p.vasquez)} votes to ${Math.min(p.okafor, p.vasquez)} (${p.undecided} stayed home).`, "politics");
      NX.feed.post(state, "news", `ELECTION RESULT: ${wname} wins. ${winner === "okafor" ? "An upset built on plant-closure anger." : "The incumbent survives the storm."}`, "news");
      if (winner === "okafor") {
        state.economy.policeBudget = Math.max(3, state.economy.policeBudget - 1);
        for (const r of state.residents) if (r.faction === "workers") r.mood = NX.clamp(r.mood + 15, -100, 100);
      } else {
        for (const r of state.residents) if (r.faction === "workers") r.mood = NX.clamp(r.mood - 10, -100, 100);
      }
    }
  };

  // ---- truth revelation check ----------------------------------------
  // if enough evidence spreads (3 distinct evidence memories held by 6+ people), the scandal breaks
  EV.truthCheck = function (state) {
    if (state.flags.truthOut) return;
    const KEYS = ["meridian development", "profit the quarter", "fraction of its value", "envelope from city hall", "cannery in '98"];
    let holders = 0, distinct = new Set();
    for (const r of state.residents) {
      if (!r.alive) continue;
      let has = false;
      for (const k of KEYS) if (NX.social.knows(r, k)) { distinct.add(k); has = true; }
      if (has) holders++;
    }
    if (holders >= 10 && distinct.size >= 3) {
      state.flags.truthOut = true;
      EV.log(state, "SCANDAL: Evidence is everywhere — the Halcyon closure was engineered. The land was quietly sold to Meridian Development, and City Hall's fingerprints are on the paperwork.", "politics");
      NX.feed.post(state, "news", "PULSE INVESTIGATES: Documents and witnesses now link the Halcyon closure to a below-market land sale to Meridian Development — with City Hall's knowledge. Mayor Vasquez's office declined to comment.", "news");
      const v = state.residents.find((r) => r.id === "vasquez");
      if (v) v.mood = NX.clamp(v.mood - 30, -100, 100);
      NX.social.rep(state, "workers", 8, "the truth about the plant is out");
      NX.social.rep(state, "government", -10, "City Hall is embarrassed");
    }
  };

  // ---- daily hook -----------------------------------------------------
  EV.daily = function (state) {
    EV.electionDaily(state);
    EV.truthCheck(state);
    // Marcus custody thread: if his rep tanks or he's arrested, log stakes
    const marcus = state.residents.find((r) => r.id === "marcus");
    if (marcus && marcus.inJail === 3) EV.log(state, "With Marcus Vale in a cell, his custody hearing is as good as lost. The garage sits dark.", "social");
  };

  // ---- digest ---------------------------------------------------------
  EV.digest = function (state, notes) {
    const eco = state.economy;
    const p = EV.electionSupport(state);
    const lines = [];
    const dayEvents = state.eventLog.filter((e) => e.d === state.day - 1 || (e.d === state.day && e.m < 10));
    for (const e of dayEvents.slice(0, 6)) lines.push(e.text);
    for (const n of notes || []) lines.push(n);
    lines.push(`Unemployment: ${(eco.unemployment * 100).toFixed(1)}% · Crime index: ${eco.crimeRate.toFixed(1)} · Treasury: ${NX.money(eco.treasury)}`);
    if (!state.election.done) lines.push(`Poll: Vasquez ${p.vasquez} — Okafor ${p.okafor} (${p.undecided} undecided). Election day ${state.election.day}.`);
    const digest = { d: state.day, lines };
    state.digests.unshift(digest);
    if (state.digests.length > 20) state.digests.length = 20;
    return digest;
  };
})();
