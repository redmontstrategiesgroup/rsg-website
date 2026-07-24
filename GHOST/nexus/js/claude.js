/* NEXUS claude — optional Claude-API NPC brain (browser fetch, key stored locally).
   Falls back to NX.dialogue when no key / on error. */
(function () {
  const C = (NX.claude = {});
  const LS_KEY = "nexus_api_key";
  const LS_MODEL = "nexus_npc_model";

  C.getKey = () => localStorage.getItem(LS_KEY) || "";
  C.setKey = (k) => (k ? localStorage.setItem(LS_KEY, k.trim()) : localStorage.removeItem(LS_KEY));
  C.getModel = () => localStorage.getItem(LS_MODEL) || "claude-haiku-4-5";
  C.setModel = (m) => localStorage.setItem(LS_MODEL, m);
  C.enabled = () => !!C.getKey();
  C.lastError = null;

  const SCHEMA = {
    type: "object",
    properties: {
      reply: { type: "string", description: "The character's spoken reply, 1-3 sentences, fully in character. No narration of internal secrets unless the character chooses to reveal them." },
      relationship_delta: { type: "integer", description: "How this exchange changed the character's feeling toward the player, -20 to 20." },
      mood_delta: { type: "integer", description: "Change to the character's overall mood, -20 to 20." },
      remember: { type: ["string", "null"], description: "One short third-person sentence this character will permanently remember about the player from this exchange, or null if nothing memorable." },
      action: {
        type: "string",
        enum: ["none", "warn_associates", "call_police", "confess", "offer_bribe", "offer_player_job", "join_player"],
        description: "A concrete consequence the character takes beyond talking. Use sparingly and only when dramatically earned.",
      },
    },
    required: ["reply", "relationship_delta", "mood_delta", "remember", "action"],
    additionalProperties: false,
  };

  C.buildSystem = function (state, r) {
    const disp = NX.dialogue.disposition(state, r);
    const biz = r.employedAt ? NX.economy.biz(state, r.employedAt) : null;
    const rels = Object.entries(r.relationships)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 6)
      .map(([id, v]) => {
        const o = state.residents.find((x) => x.id === id);
        return o ? `${o.name}: ${NX.relWord(v)}` : null;
      }).filter(Boolean).join("; ");
    const mems = r.memories.slice(-14).map((m) => `- (day ${m.d}${m.kind === "gossip" ? ", secondhand" : ""}) ${m.text}`).join("\n") || "- nothing notable yet";
    const eco = state.economy;

    return `You are role-playing ${r.name}, a resident of Rusthook, a struggling neon-lit district in the city of NEXUS. Stay completely in character. You are NOT an assistant.

CHARACTER SHEET
Name: ${r.name} (${r.age})
Occupation: ${r.job.title}${biz ? ` at ${biz.name}` : r.employedAt === null && !r.wage ? " (currently UNEMPLOYED — the Halcyon plant closed)" : ""}
Money: ${NX.money(r.money)} (${r.money < 100 ? "desperate" : r.money < 600 ? "tight" : "comfortable"})
Personality traits: ${r.traits.join(", ")}. Temper ${Math.round(r.temper * 10)}/10, honesty leaning ${Math.round(r.morality * 10)}/10.
Goal: ${r.goal}
Deep fear: ${r.fear}
${r.secret ? `SECRET (guard it): ${r.secret.text}. Deny, deflect, threaten, bargain, or — only if cornered by someone you trust or fear — confess. Choose based on your personality.` : "You have no dark secret."}
Mood right now: ${NX.moodWord(r.mood)}${r.inJail ? " (IN JAIL at Precinct 9)" : ""}
Faction: ${r.faction}. Key relationships: ${rels || "none of note"}.

WHAT YOU REMEMBER (including rumors — secondhand items may be distorted or false):
${mems}

THE PLAYER ("the newcomer")
Your feeling toward them: ${NX.relWord(r.playerRel)} (${disp}). ${r.metPlayer ? "You have spoken before." : "You have NEVER met them — react accordingly."}
Their street reputation — police: ${NX.social.repWord(state.player.rep.police)}, Red Knives: ${NX.social.repWord(state.player.rep.gang)}, workers: ${NX.social.repWord(state.player.rep.workers)}, business owners: ${NX.social.repWord(state.player.rep.business)}.

THE WORLD RIGHT NOW (day ${state.day}, ${NX.fmtTime(state.minute)})
The Halcyon Assembly Plant closed on day 1 with no warning; 9 residents lost their jobs. Unemployment ${(eco.unemployment * 100).toFixed(0)}%, crime index ${eco.crimeRate.toFixed(1)}. ${state.flags.protestFormed ? "A protest camps outside City Hall. " : ""}${state.flags.truthOut ? "It is now PUBLIC that the closure was engineered via a crooked land sale to Meridian Development. " : "Rumors say the closure was intentional — a land deal with 'Meridian Development' — but nothing is proven. "}Mayor Vasquez faces Ray Okafor in an election on day ${state.election.day}${state.election.done ? ` (already decided: ${state.election.winner} won)` : ""}. The Red Knives gang runs out of the Blackline Bar.

RULES
- Speak as ${r.name} in 1–3 sentences. Grounded, specific, no theatrical monologues.
- What you say must follow from your memories, personality, and what the player actually says. If they claim something you have no memory of, be skeptical.
- If they offer money, threaten you, or hit on your secret, react in character — and reflect real consequences via the action field.
- Never break character, never mention being an AI, never use lists or markdown.`;
  };

  C.respond = async function (state, r, text, history) {
    const key = C.getKey();
    const messages = [];
    for (const turn of (history || []).slice(-12)) {
      messages.push({ role: turn.who === "you" ? "user" : "assistant", content: turn.text });
    }
    messages.push({ role: "user", content: text });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: C.getModel(),
        max_tokens: 600,
        system: C.buildSystem(state, r),
        messages,
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();
    if (data.stop_reason === "refusal") throw new Error("model declined");
    const textBlock = (data.content || []).find((b) => b.type === "text");
    if (!textBlock) throw new Error("empty response");
    const out = JSON.parse(textBlock.text);

    const fx = {
      rel: NX.clamp(out.relationship_delta | 0, -20, 20),
      mood: NX.clamp(out.mood_delta | 0, -20, 20),
      remember: out.remember || null,
      action: out.action || "none",
    };
    if (fx.action === "offer_bribe") fx.bribeAmount = NX.R.int(150, 500);
    if (fx.action === "offer_player_job") {
      const owned = state.businesses.find((b) => b.owner === r.id && b.open);
      fx.jobBiz = owned ? owned.id : null;
      if (!fx.jobBiz) fx.action = "none";
    }
    return { reply: out.reply, effects: fx };
  };
})();
