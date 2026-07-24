/* NEXUS economy — daily settlement, jobs, businesses, city treasury, policy levers */
(function () {
  const E = (NX.economy = {});
  const LIVING_COST = 22; // per day baseline

  E.workforce = (state) => state.residents.filter((r) => r.alive && !r.inJail && !r.missing && r.age < 66 && !["mayor"].includes(r.job.title));

  E.unemploymentRate = function (state) {
    const wf = E.workforce(state);
    const un = wf.filter((r) => !r.employedAt && !r.wage);
    return wf.length ? un.length / wf.length : 0;
  };

  E.biz = (state, id) => state.businesses.find((b) => b.id === id);

  // ---- daily settlement (called at 00:00 rollover) --------------------
  E.daily = function (state) {
    const eco = state.economy;
    const notes = [];

    // 1) businesses trade: customers = residents with disposable income choosing venues
    for (const b of state.businesses) {
      if (!b.open || b.type === "factory") { b.revenueToday = 0; continue; }
      let customers = 0;
      for (const r of state.residents) {
        if (!r.alive || r.inJail || r.missing) continue;
        const disposable = r.money > 120 ? 1 : r.money > 40 ? 0.5 : 0.12;
        const pull = (b.baseDemand / 10) * (b.quality / 6) * disposable;
        const pref = r.social === b.building ? 1.6 : 1.0;
        if (NX.R.chance(NX.clamp(pull * pref * 0.32, 0.02, 0.85))) {
          customers++;
          const spend = Math.min(r.money * 0.15, b.price * eco.priceIndex * (0.6 + NX.R.val() * 0.8));
          r.money = Math.max(0, r.money - spend);
          b.revenueToday = (b.revenueToday || 0) + spend;
        }
      }
      b.cash += b.revenueToday || 0;
      b.customersToday = customers;
    }

    // 2) wages & taxes
    let taxes = 0;
    for (const b of state.businesses) {
      if (!b.open) continue;
      const wage = Math.max(b.wage, eco.minWage);
      for (const empId of b.employees) {
        const r = state.residents.find((x) => x.id === empId);
        if (!r || !r.alive || r.inJail || r.missing) continue;
        const gross = wage * 8;
        const tax = gross * eco.taxRate;
        b.cash -= gross;
        r.money += gross - tax;
        taxes += tax;
      }
      if (b.revenueToday > 0) { const bt = b.revenueToday * eco.taxRate * 0.5; b.cash -= bt; taxes += bt; }
      if (eco.bizSubsidy && b.cash < 800) { b.cash += 150; eco.treasury -= 150; }
    }
    // city payroll (police, mayor, clerk, misc stipends)
    for (const r of state.residents) {
      if (!r.alive || r.inJail || r.missing) continue;
      if (!r.employedAt && r.wage) { // city / informal wages
        const gross = r.wage * 8;
        r.money += gross * (1 - eco.taxRate * 0.5);
        if (["police captain", "patrol officer", "detective", "mayor", "city clerk"].includes(r.job.title)) {
          eco.treasury -= gross;
        }
      }
    }
    // player income & payroll
    if (state.player.jobBiz) {
      const pb = E.biz(state, state.player.jobBiz);
      if (pb && pb.open) {
        const gross = Math.max(pb.wage, eco.minWage) * 8;
        pb.cash -= gross;
        state.player.money += gross * (1 - eco.taxRate);
        taxes += gross * eco.taxRate;
      } else { state.player.jobBiz = null; }
    }
    for (const r of state.residents) {
      if (r.employerPlayer && r.alive && !r.inJail && !r.missing) {
        const pay = 88;
        if (state.player.money >= pay) { state.player.money -= pay; r.money += pay; }
        else {
          r.employerPlayer = false; r.wage = null; r.job = { biz: null, title: "unemployed" };
          NX.events.log(state, `${r.name} quit — you couldn't make payroll.`, "econ");
          NX.social.playerRumor(state, r, "the newcomer stiffed me on wages", 4);
        }
      }
    }
    eco.treasury += taxes;
    eco.treasury -= eco.policeBudget * 60; // police operating cost
    if (eco.ubi) {
      for (const r of state.residents) if (r.alive && !r.inJail && !r.missing) { r.money += 30; eco.treasury -= 30; }
      state.player.money += 30; eco.treasury -= 30;
    }

    // 3) cost of living + desperation
    for (const r of state.residents) {
      if (!r.alive || r.missing) continue;
      if (r.inJail) { r.inJail--; if (r.inJail <= 0) { r.inJail = 0; NX.events.log(state, `${r.name} was released from Precinct 9.`, "crime"); } continue; }
      r.money = Math.max(0, r.money - LIVING_COST * (r.home === "meridian" ? 1.6 : 1));
      const employed = !!r.employedAt || !!r.wage;
      r.mood = NX.clamp(r.mood + (employed ? 2 : -4) + (r.money < 60 ? -6 : r.money > 800 ? 2 : 0) + NX.R.int(-3, 3), -100, 100);
    }

    // 4) business failure / hiring
    for (const b of state.businesses) {
      if (!b.open || b.type === "factory" || b.type === "civic") continue;
      if (b.cash < 0) b.badDays++; else if (b.cash > 400) b.badDays = 0;
      if (b.badDays >= 2 && b.employees.length > (b.owner ? 1 : 0)) {
        const cutId = b.employees.find((id) => id !== b.owner);
        if (cutId) {
          E.fire(state, cutId, b, "couldn't make payroll");
          notes.push(`${b.name} cut staff.`);
        }
      }
      if (b.badDays >= 5) {
        E.closeBusiness(state, b, "ran out of money");
        notes.push(`${b.name} closed its doors.`);
      }
      // hiring when flush
      if (b.open && b.cash > 3200 && b.employees.length < 4 && NX.R.chance(0.35)) {
        const candidate = state.residents.find((r) => r.alive && !r.inJail && !r.missing && !r.employedAt && !r.wage && r.morality > 0.3);
        if (candidate) { E.hire(state, candidate, b); notes.push(`${b.name} hired ${candidate.name}.`); }
      }
    }

    // 5) job seeking fallback → some slide toward crime or the Knives (handled in events)
    eco.unemployment = E.unemploymentRate(state);
    eco.crimes3d.push(state.counters.crimesToday || 0);
    if (eco.crimes3d.length > 3) eco.crimes3d.shift();
    eco.crimeRate = eco.crimes3d.reduce((a, b) => a + b, 0) / Math.max(1, state.residents.length) * 10;
    state.counters.crimesToday = 0;
    eco.priceIndex = NX.clamp(eco.priceIndex + (eco.minWage > 16 ? 0.01 : 0) + (eco.ubi ? 0.008 : 0) - 0.002, 0.85, 1.6);
    eco.dailyNote = notes.join(" ");
    return notes;
  };

  E.hire = function (state, r, b) {
    r.employedAt = b.id;
    r.job = { biz: b.id, title: b.type === "food" ? "cook" : b.type === "night" ? "bar staff" : "assistant" };
    r.wage = null;
    if (!b.employees.includes(r.id)) b.employees.push(r.id);
    r.mood = NX.clamp(r.mood + 15, -100, 100);
    NX.social.remember(state, r, { text: `got hired at ${b.name}`, about: null, imp: 3, kind: "life" });
    NX.events.log(state, `${r.name} got a job at ${b.name}.`, "econ");
  };

  E.fire = function (state, rId, b, why) {
    const r = state.residents.find((x) => x.id === rId);
    b.employees = b.employees.filter((id) => id !== rId);
    if (r) {
      r.employedAt = null; r.wage = null;
      r.mood = NX.clamp(r.mood - 20, -100, 100);
      NX.social.remember(state, r, { text: `lost the job at ${b.name} (${why})`, about: null, imp: 4, kind: "life" });
      NX.events.log(state, `${r.name} lost their job at ${b.name} — ${why}.`, "econ");
    }
  };

  E.closeBusiness = function (state, b, why) {
    b.open = false; b.closedDay = state.day;
    for (const id of b.employees.slice()) E.fire(state, id, b, "the business closed");
    NX.events.log(state, `${b.name} has CLOSED — ${why}.`, "econ");
    NX.feed.post(state, "news", `${b.name} has shut down. ${why[0].toUpperCase() + why.slice(1)}.`, "news");
  };

  // ---- policy levers (God Mode) --------------------------------------
  E.applyPolicy = function (state, key, val) {
    const eco = state.economy;
    const before = eco[key];
    eco[key] = val;
    const label = { taxRate: "Tax rate", minWage: "Minimum wage", policeBudget: "Police budget", ubi: "Basic income", bizSubsidy: "Business subsidies", surveillance: "Street surveillance" }[key] || key;
    const fmt = (k, v) => (k === "taxRate" ? Math.round(v * 100) + "%" : k === "minWage" ? "$" + v + "/hr" : typeof v === "boolean" ? (v ? "ON" : "OFF") : v);
    if (before === val) return;
    NX.events.log(state, `POLICY: ${label} → ${fmt(key, val)}.`, "politics");
    NX.feed.post(state, "news", `City Hall: ${label} set to ${fmt(key, val)}. Effects to follow.`, "news");
    // immediate sentiment ripples
    for (const r of state.residents) {
      if (!r.alive) continue;
      if (key === "taxRate") r.mood += (val > before ? -3 : 3) * (r.faction === "business" ? 2 : 1);
      if (key === "minWage") r.mood += (val > before ? (r.employedAt ? 4 : 1) : -3) * (r.faction === "business" ? -1 : 1);
      if (key === "policeBudget") r.mood += r.faction === "gang" ? (val > before ? -4 : 4) : 0;
      if (key === "surveillance") r.mood += val ? (r.faction === "public" ? -2 : 0) : 2;
      if (key === "ubi" && val) r.mood += 5;
      r.mood = NX.clamp(r.mood, -100, 100);
    }
  };
})();
