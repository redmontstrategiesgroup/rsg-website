/* NEXUS social — memory, gossip, rumor distortion, reputation */
(function () {
  const S = (NX.social = {});

  // ---- memories -------------------------------------------------------
  // mem: { d(day), m(minute), text, about ('player'|residentId|topic), cred 0..1, imp 1..5, kind }
  S.remember = function (state, r, mem) {
    mem = { d: state.day, m: state.minute, cred: 1, imp: 2, kind: "event", ...mem };
    r.memories.push(mem);
    if (r.memories.length > 60) {
      // forget the least important, oldest first
      r.memories.sort((a, b) => (a.imp - b.imp) || (a.d - b.d));
      r.memories.splice(0, r.memories.length - 60);
      r.memories.sort((a, b) => (a.d - b.d) || (a.m - b.m));
    }
  };

  S.knows = (r, substr) => r.memories.some((m) => m.text.toLowerCase().includes(substr.toLowerCase()));

  S.memoriesAbout = (r, about) => r.memories.filter((m) => m.about === about);

  // ---- relationships --------------------------------------------------
  S.adjustRel = function (a, bId, delta) {
    a.relationships[bId] = NX.clamp((a.relationships[bId] || 0) + delta, -100, 100);
  };

  S.adjustPlayerRel = function (state, r, delta) {
    r.playerRel = NX.clamp(r.playerRel + delta, -100, 100);
    if (!r.metPlayer && delta !== 0) { r.metPlayer = true; state.player.knownBy++; }
  };

  // ---- faction reputation --------------------------------------------
  S.rep = function (state, faction, delta, why) {
    if (!(faction in state.player.rep)) return;
    const before = state.player.rep[faction];
    state.player.rep[faction] = NX.clamp(before + delta, -100, 100);
    if (why && Math.abs(delta) >= 4) NX.ui?.toast?.(`${faction} rep ${delta > 0 ? "+" : ""}${delta}: ${why}`, delta > 0 ? "" : "bad");
  };

  S.repWord = function (v) {
    if (v <= -50) return "hostile";
    if (v <= -20) return "suspicious";
    if (v < 10) return "unknown";
    if (v < 35) return "noted";
    if (v < 65) return "respected";
    return "trusted";
  };

  // ---- gossip ---------------------------------------------------------
  const EXAGGERATE = [
    [/stole/i, "robbed"], [/argued with/i, "threatened"], [/was seen with/i, "is working with"],
    [/asked about/i, "is investigating"], [/paid/i, "bribed"], [/talked to/i, "made a deal with"],
    [/hit/i, "beat down"], [/left/i, "fled"],
  ];

  S.distort = function (text) {
    for (const [re, rep] of EXAGGERATE) {
      if (re.test(text) && NX.R.chance(0.55)) return text.replace(re, rep).replace(/\.$/, "") + " — or so they say.";
    }
    return text + " (heard secondhand)";
  };

  // a tells b a memory; possible distortion; tracks rumor hops
  S.gossip = function (state, a, b) {
    // guarded knowledge ("secret"-kind memories) rarely gets shared — unless close friends
    const closeness = a.relationships[b.id] || 0;
    // Model-authored memories are a resident's own impression of a conversation,
    // not something the city witnessed — they spread, but reluctantly, so an
    // improvised sentence can't become common knowledge at full credence.
    const tellable = a.memories.filter((m) => m.imp >= 2 && m.cred > 0.3 &&
      (m.kind !== "secret" || NX.R.chance(closeness > 30 ? 0.12 : 0.03)) &&
      (m.kind !== "claude" || NX.R.chance(0.35)));
    if (!tellable.length) return false;
    // prefer juicy + recent
    tellable.sort((x, y) => (y.imp + y.d / 10) - (x.imp + x.d / 10));
    const mem = NX.R.pick(tellable.slice(0, 5));
    if (b.memories.some((m) => m.text === mem.text || (m.src === mem.text))) return false;

    let text = mem.text, cred = mem.cred * 0.8;
    if (NX.R.chance(0.18)) { text = S.distort(text); cred *= 0.7; }
    // guarded knowledge stays guarded when whispered on; ordinary news becomes free-spreading gossip
    S.remember(state, b, { text, about: mem.about, cred, imp: Math.max(1, mem.imp - (NX.R.chance(0.5) ? 1 : 0)), kind: mem.kind === "secret" ? "secret" : "gossip", src: mem.text });
    S.adjustRel(a, b.id, 1); S.adjustRel(b, a.id, 1);
    state.counters.gossipHops++;

    // hearing bad things about the player moves the needle
    if (mem.about === "player") {
      const bad = /threat|rob|stole|bribed|beat|attack|snitch|liar|working with the red knives/i.test(text);
      S.adjustPlayerRel(state, b, bad ? -NX.R.int(2, 6) : NX.R.int(1, 3));
    }
    return true;
  };

  // seed a rumor about the player into a resident (used by events/dialogue)
  S.playerRumor = function (state, r, text, imp = 3, cred = 1, kind = "witness") {
    S.remember(state, r, { text, about: "player", cred, imp, kind });
  };

  // witnesses at a location see an event
  S.witness = function (state, whereId, text, opts = {}) {
    const { about = null, imp = 3, exceptId = null } = opts;
    const seen = [];
    for (const r of state.residents) {
      if (!r.alive || r.inJail || r.missing || r.id === exceptId) continue;
      if (r.at === whereId && NX.R.chance(state.economy.surveillance ? 0.9 : 0.65)) {
        S.remember(state, r, { text, about, imp, kind: "witness" });
        seen.push(r);
      }
    }
    return seen;
  };
})();
