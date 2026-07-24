/* NEXUS dialogue — local NPC conversation engine (no API needed).
   Produces the same {reply, effects} shape as the Claude backend. */
(function () {
  const D = (NX.dialogue = {});

  // keyword groups that "hit" a resident's secret: text must match one word from EACH group
  const SECRET_KEYS = {
    marcus: [["knives", "gang", "red knives", "criminal"], ["car", "repair", "fix", "vehicle", "paint", "chop"]],
    tomas: [["debt", "owe", "gambling", "money"], ["knives", "duke", "gang", "blackline"]],
    greta: [["ledger", "profit", "books", "profitable", "numbers"], ["plant", "halcyon", "factory", "closure"]],
    lena: [["memo", "sale", "land", "meridian"], ["plant", "halcyon", "factory", "closure"]],
    sadie: [["informant", "snitch", "inform", "tell", "pass", "overhear"], ["knives", "duke", "gang"]],
    viktor: [["launder", "wash", "dirty money", "books", "ledger"], ["knives", "gang", "club", "palm"]],
    nikki: [["ledger", "photos", "drive", "copies", "books"], ["viktor", "palm", "club"]],
    oz: [["lieutenant", "counting", "knives", "gang boss"], ["blackline", "bar", "knives", "duke"]],
    malley: [["payroll", "tip", "tips off", "warn", "leak", "dirty"], ["knives", "gang", "raid", "duke"]],
    vasquez: [["donation", "meridian", "bribe", "paid"], ["plant", "land", "closure", "campaign"]],
    hale: [["paperwork", "file", "transfer", "records", "deed"], ["land", "plant", "meridian"]],
    duke: [["run", "boss", "lead"], ["knives", "gang"]],
    echo: [["skim", "getaway", "leaving", "out"], ["knives", "duke", "gang"]],
    bram: [["protection", "collect", "shake"], ["money", "friday", "knives"]],
    amara: [["stitch", "patch", "treat", "off the record"], ["knives", "gang", "wound", "duke"]],
    denny: [["ticket", "leaving", "bus", "out of the city"], ["drawer", "hidden", "rosa", "mother", "secret"]],
    faith: [["evidence", "bury", "file", "force", "cop"], ["past", "police", "left", "quit"]],
    sato: [["malley", "leak", "dirty cop"], ["suspect", "knives", "raid", "watch"]],
    teddy: [["meridian", "cannery", "98", "shell"], ["remember", "before", "same", "trick"]],
    june: [["envelope", "delivered", "package"], ["city hall", "blackline", "night"]],
  };

  const EVIDENCE = [
    { rx: /meridian/i, text: "the plant land was sold to Meridian Development before the closure", imp: 5 },
    { rx: /profit|ledger.*plant|plant.*ledger/i, text: "the plant was profitable the quarter it closed", imp: 5 },
    { rx: /fraction|below.market|cheap.*land|land.*cheap/i, text: "the plant lot sold for a fraction of its value", imp: 5 },
    { rx: /envelope.*(hall|blackline)|(hall|blackline).*envelope/i, text: "an envelope went from City Hall to the Blackline the night before the closure", imp: 5 },
    { rx: /cannery|'?98/i, text: "Meridian is the same shell company that gutted the cannery in '98", imp: 4 },
  ];

  // ---- intent detection ----------------------------------------------
  D.detect = function (state, r, raw) {
    const t = raw.toLowerCase().trim();
    const money = t.match(/\$?\s?(\d{2,6})\b/);
    const amount = money ? parseInt(money[1], 10) : 0;

    const mentions = (rx) => rx.test(t);
    const personHit = state.residents.find((x) => x.id !== r.id &&
      (t.includes(x.name.toLowerCase()) || t.includes(x.name.split(" ")[0].toLowerCase()) || t.includes(x.id)));

    // secret accusation?
    const keys = SECRET_KEYS[r.id];
    let secretHit = false;
    if (keys && r.secret) {
      secretHit = keys.every((group) => group.some((w) => t.includes(w)));
    }
    // player spreading evidence?
    const evid = EVIDENCE.find((e) => e.rx.test(t));

    if (secretHit && mentions(/know|heard|aware|i see|caught|seen|you|admit|true/)) return { intent: "accuse", amount, evid };
    if (secretHit) return { intent: "accuse", amount, evid };
    if (mentions(/^(hi|hey|hello|yo|good (morning|evening|afternoon)|sup)\b/)) return { intent: "greet" };
    if (mentions(/who are you|your name|what do you do|tell me about yourself/)) return { intent: "whoami" };
    if (mentions(/how are you|how's it going|you (ok|okay|good|holding)/)) return { intent: "howare" };
    if (amount >= 20 && mentions(/pay|bribe|give you|yours if|take this|offer|for your trouble|keep quiet|silence/)) return { intent: "bribe", amount };
    if (amount >= 10 && mentions(/here|take|have|help you out|gift/)) return { intent: "give", amount };
    if (mentions(/\bor else\b|threat|hurt you|regret|make you|watch your back|come after|burn (it|you)|expose you|tell everyone|tell the police|turn you in/)) return { intent: "threaten", evid };
    if (mentions(/\bjob\b|\bwork\b|\bhire\b|\bhiring\b|employment|need work|work for you/) && !mentions(/work for me/)) return { intent: "askjob" };
    if (mentions(/work for me|join me|i('ll| will) pay you|be my|help me with|i'm hiring/)) return { intent: "recruit", amount };
    if (mentions(/vote|election|okafor|vasquez|mayor race|candidate/)) return { intent: "election", personHit };
    if (mentions(/red knives|the knives|gang|duke/)) return { intent: "topic_gang", evid };
    if (mentions(/plant|factory|halcyon|closure|laid off|jobs/)) return { intent: "topic_plant", evid };
    if (mentions(/rumor|gossip|news|what('s| is) (going on|new|happening)|heard anything/)) return { intent: "rumors" };
    if (personHit && mentions(/about|know|think of|trust|who is|what.*(do|think)/)) return { intent: "askperson", personHit };
    if (mentions(/beautiful|gorgeous|drink sometime|date|dinner with me|cute/)) return { intent: "flirt" };
    if (mentions(/idiot|stupid|pathetic|loser|coward|trash|shut up/)) return { intent: "insult" };
    if (mentions(/help you|anything you need|i can help|on your side|got your back/)) return { intent: "helpoffer" };
    if (mentions(/\bbye\b|goodbye|see you|later|gotta go/)) return { intent: "bye" };
    if (evid) return { intent: "spread_evidence", evid };
    if (personHit) return { intent: "askperson", personHit };
    return { intent: "unknown" };
  };

  // ---- disposition ----------------------------------------------------
  D.disposition = function (state, r) {
    let rel = r.playerRel;
    if (r.faction === "gang") rel += state.player.rep.gang * 0.4;
    if (r.faction === "police") rel += state.player.rep.police * 0.4;
    if (r.faction === "business") rel += state.player.rep.business * 0.3;
    if (r.faction === "workers") rel += state.player.rep.workers * 0.3;
    if (rel <= -25) return "hostile";
    if (rel < 0 || !r.metPlayer) return "wary";
    if (rel < 20) return "neutral";
    if (rel < 50) return "warm";
    return "close";
  };

  const OPENERS = {
    hostile: ["What.", "You've got nerve showing up here.", "Make it quick before I lose patience."],
    wary: ["...Do I know you?", "You're the new face everyone's mentioning.", "Careful who you talk to around here."],
    neutral: ["Yeah?", "What can I do for you?", "Go ahead, I'm listening."],
    warm: ["Hey, good to see you.", "There you are. What's up?", "Was hoping you'd come by."],
    close: ["You I always have time for.", "Talk to me, friend.", "Whatever you need."],
  };

  const SIGNATURES = {
    marcus: "Wipes engine grease off his hands without looking up.",
    rosa: "She's already restocking a shelf while she talks.",
    duke: "He smiles the way a knife catches light.",
    teddy: "He pats the bench beside him.",
    vasquez: "A campaign smile snaps into place.",
    okafor: "His voice carries like he's already mid-speech.",
    reeves: "She studies you like a report she hasn't filed yet.",
    oz: "He keeps polishing the same glass.",
  };

  // ---- main responder -------------------------------------------------
  D.respond = function (state, r, raw) {
    const det = D.detect(state, r, raw);
    const disp = D.disposition(state, r);
    const fx = { rel: 0, mood: 0, remember: null, action: "none", rep: null };
    const name = r.name.split(" ")[0];
    const jobless = !r.employedAt && !r.wage;
    let reply = "";

    const sig = !r.metPlayer && SIGNATURES[r.id] ? SIGNATURES[r.id] + " " : "";

    switch (det.intent) {
      case "greet":
        reply = sig + NX.R.pick(OPENERS[disp]);
        fx.rel = disp === "hostile" ? 0 : 1;
        break;

      case "whoami":
        reply = `${name}. ${r.job.title[0].toUpperCase() + r.job.title.slice(1)}` +
          (r.employedAt ? ` at ${NX.economy.biz(state, r.employedAt)?.name}.` : jobless ? " — was, until the plant locked its gates." : ".");
        if (disp === "warm" || disp === "close") reply += ` Between us, what I really want is to ${r.goal}.`;
        fx.rel = 1;
        break;

      case "howare":
        reply = r.mood < -25
          ? NX.R.pick([`Honestly? Bad. ${jobless ? "No work, and the money's going fast." : "This district is grinding me down."}`, "Been better. Been a lot better."])
          : r.mood > 30
            ? NX.R.pick(["Can't complain today.", "Good, actually. Suspiciously good."])
            : NX.R.pick(["Getting by.", "One day at a time.", "Same as this district. Standing, barely."]);
        fx.rel = 2;
        break;

      case "rumors": {
        if (disp === "hostile") { reply = "I don't trade talk with you."; break; }
        const tellable = r.memories.filter((m) => m.imp >= 3).slice(-6);
        if (tellable.length && (disp !== "wary" || NX.R.chance(r.chattiness))) {
          const mem = NX.R.pick(tellable);
          reply = NX.R.pick(["Word going around: ", "You didn't hear it from me — ", "Since you asked… "]) + mem.text + ".";
          fx.rel = 1;
        } else {
          reply = NX.R.pick(["Nothing I'd repeat.", "Ask Rosa at the market — she keeps the district's ledger of sins.", "Quiet lately. Which usually means something's coming."]);
        }
        break;
      }

      case "askperson": {
        const p = det.personHit;
        if (!p) { reply = "Who now?"; break; }
        if (disp === "hostile") { reply = `I'm not discussing ${p.name.split(" ")[0]} with you.`; break; }
        const rel = r.relationships[p.id] || 0;
        const mems = NX.social.memoriesAbout(r, p.id);
        let bit = "";
        if (mems.length && (disp === "warm" || disp === "close" || NX.R.chance(0.5))) bit = " " + NX.R.pick(mems).text + ".";
        reply = rel > 25 ? `${p.name}? Good people. I'd vouch for them.${bit}`
          : rel < -15 ? `${p.name} is trouble. Keep your distance.${bit}`
          : `${p.name}… ${p.job.title}. ${NX.R.pick(["Keeps to themselves mostly.", "We're civil.", "Everyone's got a story here."])}${bit}`;
        fx.rel = 1;
        break;
      }

      case "topic_plant": {
        const mems = r.memories.filter((m) => m.about === "plant");
        if (det.evid) return D.handleEvidence(state, r, det, disp, fx);
        if (mems.length && disp !== "hostile") {
          const secretMem = mems.find((m) => m.kind === "secret");
          if (secretMem && (disp === "warm" || disp === "close") && NX.R.chance(0.7)) {
            reply = `Keep this close: ${secretMem.text}. I haven't told many people that.`;
            fx.rel = 3; fx.remember = "trusted the newcomer with what I know about the plant";
          } else if (secretMem && disp === "neutral" && NX.R.chance(0.25)) {
            reply = `There's more to that closure than the sign on the gate. Earn my trust and maybe I'll say more.`;
          } else {
            reply = NX.R.pick(mems).text + ". " + NX.R.pick(["That's what I know.", "Make of it what you will.", "And nobody official has said a word."]);
          }
        } else {
          reply = jobless
            ? "The plant? I worked there. One day's notice and a padlock. 'Restructuring.' Somebody made money on that closure — bet on it."
            : "Nine people I know lost work overnight. The district's holding its breath.";
        }
        fx.rel = 1;
        break;
      }

      case "topic_gang": {
        if (det.evid) return D.handleEvidence(state, r, det, disp, fx);
        if (r.faction === "gang") {
          reply = disp === "hostile" ? "Asking about the Knives is how people go missing. Walk away."
            : NX.R.pick(["The Knives keep order the city won't pay for. That's all you need.", "You want work or you want trouble? Those are the two conversations."]);
          fx.rel = disp === "hostile" ? -2 : 0;
        } else if (r.faction === "police") {
          reply = NX.R.pick(["The Red Knives run out of the Blackline. Everyone knows, nobody testifies.", "Got something on the Knives? Bring it to me and I'll listen."]);
          fx.rel = 1;
        } else {
          reply = NX.R.pick(["Lower your voice. The Blackline has ears everywhere.", "The Knives collect 'insurance' from half the shops here. You didn't hear that from me.", "Stay out of their way and they mostly stay out of yours. Mostly."]);
        }
        break;
      }

      case "election": {
        if (state.election.done) {
          reply = `It's decided — ${state.election.winner === "okafor" ? "Okafor took it. New broom, old dust." : "Vasquez held on. Same hands on the wheel."}`;
          break;
        }
        const lean = r.lean;
        reply = lean === "okafor" ? "Okafor. He's loud, but he's ours. Vasquez smiled while the plant died."
          : lean === "vasquez" ? "Vasquez keeps things stable. Okafor would set the district on fire to warm it."
          : "Haven't decided. Convince me — what's your case?";
        // persuasion attempt
        const forOka = /okafor/i.test(raw) && !/against okafor|not okafor/i.test(raw);
        const forVas = /vasquez/i.test(raw) && !/against vasquez|not vasquez/i.test(raw);
        if ((forOka || forVas) && lean === "undecided" && r.playerRel > 10 && NX.R.chance(0.5 + r.playerRel / 100)) {
          r.lean = forOka ? "okafor" : "vasquez";
          reply += ` …You know what? You've been straight with me. ${forOka ? "Okafor" : "Vasquez"} it is.`;
          fx.remember = `the newcomer talked me into voting ${r.lean}`;
          fx.rel = 2;
        }
        break;
      }

      case "accuse": {
        // the big one: player names the secret
        const s = r.secret;
        if (!s) { reply = "I genuinely don't know what you're talking about."; fx.rel = -2; break; }
        const scared = r.traits.includes("timid") || r.morality > 0.8;
        const violent = r.traits.includes("violent") || (r.faction === "gang" && r.temper > 0.6);
        const rich = r.money > 2500 || r.traits.includes("greedy");
        fx.remember = "the newcomer KNOWS my secret — " + s.text;
        fx.mood = -15;
        if (violent && NX.R.chance(0.6)) {
          reply = `Say that again — slower — and think hard about how many friends you have in this district. Accidents happen to people who talk.`;
          fx.rel = -20; fx.action = r.faction === "gang" ? "warn_associates" : "none";
        } else if (rich && NX.R.chance(0.5)) {
          const offer = NX.R.int(150, 500);
          reply = `…Okay. Okay. Let's be adults. ${NX.money(offer)} says this conversation never happened. Nod, take it, and we're both happier.`;
          fx.rel = -10; fx.action = "offer_bribe"; fx.bribeAmount = offer;
        } else if (scared && NX.R.chance(0.65)) {
          reply = `How did you— …Please. If this gets out, ${r.fear} stops being a fear and starts being my life. What do you want from me?`;
          fx.rel = -5; fx.action = "confess";
        } else {
          reply = NX.R.pick([
            "That's a dangerous little story. Repeat it to anyone and we'll see whose word this district takes.",
            "No idea what you think you saw. And I'd be careful repeating it.",
          ]);
          fx.rel = -12;
        }
        break;
      }

      case "threaten": {
        fx.remember = "the newcomer threatened me";
        fx.rel = -18; fx.mood = -10;
        if (r.traits.includes("violent") || r.temper > 0.75) {
          reply = "Wrong door. People who threaten me end up explaining themselves to Bram in the alley. Last warning.";
          if (r.faction === "gang") { fx.action = "warn_associates"; }
        } else if (r.traits.includes("timid")) {
          reply = "Okay— okay. There's no need for that. I hear you. Just… keep your voice down.";
          fx.action = NX.R.chance(0.4) ? "comply" : "none";
        } else {
          reply = "Threats. Bold, for someone nobody in this district would miss. We're done talking.";
          if (r.faction === "police") { fx.action = "call_police"; }
          else if (NX.R.chance(0.3)) fx.action = "call_police";
        }
        NX.social.rep(state, "public", -2);
        break;
      }

      case "bribe": {
        const amt = det.amount;
        if (state.player.money < amt) { reply = "You're flashing money you don't have. Embarrassing for us both."; fx.rel = -4; break; }
        const takes = r.morality < 0.6 || (amt > 200 && r.money < 500);
        if (takes) {
          state.player.money -= amt; r.money += amt;
          reply = NX.R.pick([`${NX.money(amt)} buys a very specific kind of silence. Done.`, "Quietly. …Pleasure doing business."]);
          fx.rel = 8; fx.remember = `took ${NX.money(amt)} from the newcomer to keep quiet`;
          NX.social.rep(state, "gang", 2); NX.social.rep(state, "police", -2);
        } else {
          reply = NX.R.pick(["Put it away. I'm not for sale, and now I know you think everyone is.", "Wrong person. And I'll remember you tried."]);
          fx.rel = -15; fx.remember = "the newcomer tried to bribe me";
          if (r.faction === "police" && NX.R.chance(0.5)) fx.action = "call_police";
        }
        break;
      }

      case "give": {
        const amt = det.amount;
        if (amt <= 0 || state.player.money < amt) { reply = "Generous of you. With money you don't have."; break; }
        state.player.money -= amt; r.money += amt;
        reply = r.money < 300 ? `…You don't know what this covers right now. I won't forget it.` : `That's kind. Unnecessary, but kind.`;
        fx.rel = NX.clamp(Math.round(amt / 15), 3, 25);
        fx.remember = `the newcomer gave me ${NX.money(amt)} when I needed it`;
        fx.mood = 10;
        NX.social.rep(state, r.faction === "gang" ? "gang" : "public", 2);
        break;
      }

      case "askjob": {
        const owned = state.businesses.find((b) => b.owner === r.id && b.open);
        if (owned && owned.cash > 1200 && r.playerRel >= 10) {
          reply = `Actually… I could use hands at ${owned.name}. ${NX.money(Math.max(owned.wage, state.economy.minWage) * 8)} a day, start tomorrow. In?`;
          fx.action = "offer_player_job"; fx.jobBiz = owned.id;
        } else if (owned) {
          reply = `Money's tight at ${owned.name}. Prove you're useful around the district and ask me again.`;
        } else if (jobless) {
          reply = "You and half of Rusthook. If you find anyone hiring, tell them I asked first.";
        } else {
          reply = NX.R.pick(["Try Rosa at the market or Faith at the diner — they hire when they can.", "The Blackline is always 'hiring'. I'd think twice about that."]);
        }
        break;
      }

      case "recruit": {
        if (jobless && (r.playerRel > 15 || det.amount >= 80)) {
          reply = "Steady pay? Then yes. I'm not proud, I'm broke. When do I start?";
          fx.action = "join_player"; fx.rel = 10;
          fx.remember = "the newcomer gave me work when nobody else would";
        } else if (jobless) {
          reply = "Work for a stranger with no history in this district? Show me the money first — or make a name for yourself.";
        } else {
          reply = `I've got a living, thanks. Try the Halcyon folks — they're the ones drowning.`;
        }
        break;
      }

      case "flirt": {
        if (r.partner) { reply = `Flattering, but I'm spoken for. ${NX.R.chance(0.5) ? "Try that charm on the election, it needs it." : ""}`; fx.rel = 1; }
        else if (disp === "hostile" || disp === "wary") { reply = "That's not going to work on me. Yet. Or ever. We'll see."; fx.rel = 1; }
        else { reply = NX.R.pick(["Buy me a coffee at the Anchor first, then we'll negotiate.", "Smooth. Rusthook rusts that out of people — enjoy it while it lasts."]); fx.rel = 4; }
        break;
      }

      case "insult":
        reply = r.temper > 0.6 ? "Say it once more and you'll be wearing your teeth as a necklace." : "Charming. This conversation's over.";
        fx.rel = -12; fx.mood = -5; fx.remember = "the newcomer insulted me to my face";
        break;

      case "helpoffer":
        if (disp === "hostile") { reply = "Your help is the last thing I'd trust."; break; }
        reply = jobless ? `Then find out who killed the plant. That's the only help that matters to me.` :
          NX.R.pick([`Careful — offers like that get collected on, in Rusthook.`, `I'll remember that. ${name} pays debts, both kinds.`]);
        fx.rel = 3;
        break;

      case "spread_evidence":
        return D.handleEvidence(state, r, det, disp, fx);

      case "bye":
        reply = NX.R.pick(["Watch yourself out there.", "Yeah. Stay off the Knives' radar.", "Come back around."]);
        fx.rel = 1;
        break;

      default:
        reply = NX.R.pick([
          "Not sure what you're getting at. Try me plainly.",
          `Hm. ${jobless ? "Unless it's about work or the plant, I've got little to say." : "I've got work to get back to."}`,
          "You'll have to be more direct — Rusthook beat the subtlety out of me.",
        ]);
    }

    return { reply, effects: fx };
  };

  // player tells NPC a piece of evidence — this is how the scandal spreads by hand
  D.handleEvidence = function (state, r, det, disp, fx) {
    const e = det.evid;
    let reply;
    if (disp === "hostile") {
      reply = "Take your conspiracy somewhere else.";
    } else {
      const already = NX.social.knows(r, e.text.slice(0, 20));
      if (already) reply = NX.R.pick(["I've heard the same. It's getting hard to ignore.", "So it's not just me hearing that."]);
      else {
        NX.social.remember(state, r, { text: e.text, about: "plant", cred: 0.7, imp: e.imp, kind: "gossip" });
        reply = NX.R.pick([
          "…If that's true, this district was robbed in broad daylight. I'll be repeating that.",
          "You're sure? That changes things. That changes the election.",
          "Careful who else you tell. But — thank you. People should know.",
        ]);
        fx.rel = 3;
        if (r.chattiness > 0.6) fx.remember = null; // memory already added
      }
    }
    NX.events.truthCheck(state);
    return { reply, effects: fx };
  };

  // ---- effect application (shared by local + Claude backends) ---------
  D.applyEffects = function (state, r, fx) {
    if (!fx) return;
    if (fx.rel) NX.social.adjustPlayerRel(state, r, fx.rel);
    else if (!r.metPlayer) NX.social.adjustPlayerRel(state, r, 0.01); // mark met
    if (fx.mood) r.mood = NX.clamp(r.mood + fx.mood, -100, 100);
    if (fx.remember) NX.social.playerRumor(state, r, fx.remember, 4);

    switch (fx.action) {
      case "warn_associates": {
        for (const id of ["duke", "oz", "bram"]) {
          const g = state.residents.find((x) => x.id === id);
          if (g && g.id !== r.id) NX.social.playerRumor(state, g, "the newcomer is poking into Red Knives business — watch them", 4);
        }
        NX.social.rep(state, "gang", -10, "the Knives were warned about you");
        NX.events.log(state, "Somewhere in the Blackline, your name just came up.", "crime");
        break;
      }
      case "call_police": {
        state.player.wanted = NX.clamp(state.player.wanted + 1, 0, 5);
        const cop = state.residents.find((x) => x.id === "reeves");
        if (cop) NX.social.playerRumor(state, cop, `${r.name} filed a complaint about the newcomer`, 3);
        NX.social.rep(state, "police", -6, `${r.name} reported you`);
        break;
      }
      case "confess": {
        NX.events.log(state, `${r.name} cracked. You know their secret is real now.`, "social");
        if (r.id === "vasquez" || r.id === "hale") NX.events.truthCheck(state);
        break;
      }
      case "offer_bribe": {
        state._pendingBribe = { from: r.id, amount: fx.bribeAmount || 200 };
        break;
      }
      case "offer_player_job": {
        state._pendingJob = { biz: fx.jobBiz };
        break;
      }
      case "join_player": {
        r.wage = 11; r.job = { biz: null, title: "works for you" }; r.employerPlayer = true; r.employedAt = null;
        NX.events.log(state, `${r.name} now works for you. ($88/day comes out of your pocket.)`, "econ");
        NX.social.rep(state, "workers", 4, `you hired ${r.name}`);
        break;
      }
    }
  };
})();
