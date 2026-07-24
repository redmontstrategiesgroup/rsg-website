/* NEXUS feed — "Pulse", the district's social network */
(function () {
  const F = (NX.feed = {});

  F.post = function (state, authorId, text, kind = "chatter") {
    const author = authorId === "news"
      ? { name: "Rusthook Pulse Wire", handle: "@pulse_wire" }
      : authorId === "anon"
        ? { name: "anonymous", handle: "@burner_" + NX.R.int(100, 999) }
        : (() => { const r = state.residents.find((x) => x.id === authorId); return r ? { name: r.name, handle: NX.DATA.HANDLES[r.id] || "@" + r.id } : null; })();
    if (!author) return;
    state.feed.unshift({
      id: NX.uid(), d: state.day, m: state.minute,
      author: author.name, handle: author.handle, text, kind,
      likes: NX.R.int(0, 8), reposts: NX.R.int(0, 3),
    });
    if (state.feed.length > 200) state.feed.length = 200;
  };

  // residents post organically about their strongest recent memory / mood
  F.residentPosts = function (state) {
    const posters = state.residents.filter((r) => r.alive && !r.inJail && !r.missing && NX.R.chance(r.chattiness * 0.35));
    for (const r of posters.slice(0, 5)) {
      const recent = r.memories.filter((m) => m.d >= state.day - 1 && m.imp >= 3);
      if (recent.length && NX.R.chance(0.7)) {
        const mem = NX.R.pick(recent);
        const spin = mem.kind === "gossip" ? NX.R.pick(["Heard that ", "People are saying ", "Can't confirm but: ", "Word is "]) : NX.R.pick(["", "", "So today: "]);
        F.post(state, r.id, spin + mem.text + (mem.kind === "gossip" ? " 👀" : ""), mem.kind === "gossip" ? "rumor" : "chatter");
      } else {
        F.post(state, r.id, F.moodLine(state, r), "chatter");
      }
    }
    // engagement drift on old posts
    for (const p of state.feed.slice(0, 20)) if (NX.R.chance(0.4)) { p.likes += NX.R.int(0, 5); p.reposts += NX.R.chance(0.2) ? 1 : 0; }
  };

  F.moodLine = function (state, r) {
    const un = !r.employedAt && !r.wage;
    const pools = [];
    if (un) pools.push(
      "Day " + state.day + " and still no work. Rusthook doesn't owe me anything, apparently.",
      "Applications everywhere. Silence everywhere.",
      "Rent doesn't care that the plant closed.");
    if (r.mood < -20) pools.push(
      "This district chews people up.",
      "Tired of pretending it's fine. It is not fine.");
    if (r.mood > 30) pools.push(
      "Good day for once. Not jinxing it.",
      "Rusthook sunsets almost make you forgive the place.");
    if (r.social === "club") pools.push("Neon Palm tonight. Someone cover my shift tomorrow.");
    if (r.social === "diner") pools.push("Faith's coffee is the only civic institution that works.");
    if (r.social === "park") pools.push("Founders Park bench, best seat in the city.");
    if (r.id === "viktor") pools.push("Neon Palm: two-for-one before 11. Tell your friends. Tell your enemies.");
    if (r.id === "rosa") pools.push("Fresh produce in at Kwon's. Yes I know everything. No I won't tell you. (Ask nicely.)");
    if (r.id === "okafor") pools.push("Rusthook deserves answers about the plant. I intend to get them. #Okafor4Rusthook");
    if (r.id === "vasquez") pools.push("Proud of this district's resilience. Better days are coming. — EV");
    if (!pools.length) pools.push("Another day in Rusthook.");
    return NX.R.pick(pools);
  };

  F.daily = function (state) {
    F.residentPosts(state);
    // occasional anonymous conspiracy chatter once the closure rumor is live
    if (state.day >= 2 && NX.R.chance(0.5)) {
      F.post(state, "anon", NX.R.pick([
        "the plant didn't die. it was killed. follow the land.",
        "who benefits when 80 people lose work overnight? start there.",
        "meridian development. look it up. tell me what you find.",
        "certain detectives sure spend a lot of time at a certain bar.",
      ]), "rumor");
    }
  };
})();
