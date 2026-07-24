// ============ THE FORGE — Claude API bridge ============
// Direct browser calls to api.anthropic.com (raw HTTP — no SDK in a
// zero-build page). The user's key lives only in localStorage.
// Fable 5 notes honoured here: thinking is always on (no `thinking` param),
// refusals are re-served by a server-side Opus 4.8 fallback (beta header).

const LS_KEY = "forge.settings.v1";

export function getSettings() {
  // Shared Onehand OS key (rsg.anthropic_key) takes precedence over the
  // Forge-local key so the key is pasted once; model stays Forge-local.
  const shared = localStorage.getItem("rsg.anthropic_key") || "";
  try {
    const s = { apiKey: "", model: "claude-fable-5", ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") };
    if (shared) s.apiKey = shared;
    return s;
  }
  catch { return { apiKey: shared, model: "claude-fable-5" }; }
}
export function saveSettings(s) { localStorage.setItem(LS_KEY, JSON.stringify(s)); }
export function hasKey() { return !!getSettings().apiKey; }

async function callClaude({ system, messages, schema, maxTokens = 4096, effort = "medium" }) {
  const { apiKey, model } = getSettings();
  if (!apiKey) throw new Error("no-key");

  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { effort, ...(schema ? { format: { type: "json_schema", schema } } : {}) },
  };
  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (model === "claude-fable-5") {
    // opt into server-side refusal fallback → Opus 4.8 re-serves declines
    headers["anthropic-beta"] = "server-side-fallback-2026-06-01";
    body.fallbacks = [{ model: "claude-opus-4-8" }];
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers, body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API ${res.status}`);
  }
  const msg = await res.json();
  if (msg.stop_reason === "refusal") {
    throw new Error("The model declined this request" + (msg.stop_details?.explanation ? `: ${msg.stop_details.explanation}` : "."));
  }
  const text = (msg.content || []).find(b => b.type === "text")?.text ?? "";
  return { text, msg };
}

// ---------------------------------------------------------------- spec generation
export async function generateSpecAI(sentence, schema) {
  const { text } = await callClaude({
    system:
`You are THE FORGE, an AI product engineer that turns one sentence into a real,
manufacturable input device built around an ESP32-S3, a mechanical key matrix,
EC11 rotary encoders, an optional I2C trackball (PIM447), an optional SSD1306
OLED, and 3.5mm foot-pedal jacks. Read the user's sentence, decide sensible
module counts for the physical product, and fill the schema. Be opinionated
and practical — this device will actually be printed and soldered.`,
    messages: [{ role: "user", content: sentence }],
    schema,
    effort: "medium",
  });
  return JSON.parse(text);
}

// ---------------------------------------------------------------- concepts (inventor mode)
export const CONCEPTS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["concepts"],
  properties: {
    concepts: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["name", "description", "usability", "cost", "manufacturability", "sentence"],
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "2 sentences: the physical solution and why it works" },
          usability: { type: "integer", description: "0-100" },
          cost: { type: "integer", description: "0-100 (100 = cheapest)" },
          manufacturability: { type: "integer", description: "0-100 (100 = easiest to make)" },
          sentence: { type: "string", description: "One sentence that, fed back to THE FORGE, would generate this device" },
        },
      },
    },
  },
};

export async function generateConceptsAI(problem) {
  const { text } = await callClaude({
    system:
`You are THE FORGE in Inventor Mode. The user states a physical problem.
Propose exactly 3 competing PHYSICAL solutions buildable with 3D printing +
an ESP32-S3 + mechanical switches / encoders / trackball / pedals / OLED.
Make them genuinely different architectures, score honestly, and for each
write the one-sentence Forge prompt that would generate it.`,
    messages: [{ role: "user", content: problem }],
    schema: CONCEPTS_SCHEMA,
    effort: "high",
  });
  return JSON.parse(text).concepts;
}

// ---------------------------------------------------------------- vision inspection
export const INSPECT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "findings", "recommendRevision"],
  properties: {
    summary: { type: "string", description: "One sentence overall verdict on the prototype" },
    recommendRevision: { type: "boolean" },
    findings: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["severity", "observation", "fix", "patch"],
        properties: {
          severity: { type: "string", enum: ["info", "minor", "major"] },
          observation: { type: "string", description: "What you see in the photo, with an estimated measurement where possible" },
          fix: { type: "string", description: "The concrete design change" },
          patch: {
            type: "string",
            enum: ["increase_dial_clearance", "add_usb_ribs", "move_jacks_side", "snap_fit_lid", "increase_wall", "none"],
            description: "Which parametric CAD patch implements the fix (or none)",
          },
        },
      },
    },
  },
};

export async function inspectPrototypeAI(imageB64, mediaType, spec) {
  const { text } = await callClaude({
    system:
`You are THE FORGE performing incoming inspection on a physical prototype the
user just manufactured from your CAD output. Compare the photo against the
design intent and report manufacturing/usability defects an experienced
mechanical engineer would flag: clearances, flex, warping, connector access,
assembly efficiency. Estimate dimensions from known reference features
(19.05mm key pitch, 20mm knobs, ${spec.modules.trackball?.diameter || 34}mm trackball).
Map each fix onto one of the parametric patches when possible.`,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
        {
          type: "text",
          text: `This is rev ${spec.rev} of "${spec.name}". Design data: deck ${spec.derived.deck.w.toFixed(0)}×${spec.derived.deck.d.toFixed(0)}×${spec.derived.deck.h}mm, ` +
            `${spec.derived.keyTotal} keys, ${spec.modules.encoders.count} dials (clearance ${spec.geometry.dialClearanceMM}mm), ` +
            `pedal jacks on ${spec.geometry.jackEdge} edge, wall ${spec.geometry.wallMM}mm, USB ribs: ${spec.geometry.usbRibs}. Inspect it.`,
        },
      ],
    }],
    schema: INSPECT_SCHEMA,
    maxTokens: 8192,
    effort: "high",
  });
  return JSON.parse(text);
}

// ---------------------------------------------------------------- demo (offline) inspection
export function inspectPrototypeDemo(spec) {
  const g = spec.geometry;
  const findings = [];
  if (spec.modules.pedals.count && g.jackEdge === "rear")
    findings.push({
      severity: "minor",
      observation: "Foot-pedal connector is difficult to access — rear jacks sit behind the deck body when cables are dressed.",
      fix: "Move the TRS jacks to the outboard side wall.",
      patch: "move_jacks_side",
    });
  if (!g.usbRibs)
    findings.push({
      severity: "major",
      observation: "Enclosure flex detected near the USB port — the wall deflects ≈0.8 mm under connector insertion force.",
      fix: "Add two vertical reinforcement ribs flanking the USB opening.",
      patch: "add_usb_ribs",
    });
  if (spec.modules.encoders.count && g.dialClearanceMM < 6)
    findings.push({
      severity: "major",
      observation: `Left dial clearance is approximately ${(6 - g.dialClearanceMM).toFixed(1)} mm too small — knurled knob grazes the adjacent keycap at full grip.`,
      fix: `Increase dial clearance from ${g.dialClearanceMM.toFixed(1)} mm to 6.0 mm.`,
      patch: "increase_dial_clearance",
    });
  if (!g.snapFit)
    findings.push({
      severity: "info",
      observation: `Estimated assembly time is unnecessarily high (${spec.derived.assemblyMin} min) — six plate screws dominate closing time.`,
      fix: "Replace plate screws with printed snap-fit tabs.",
      patch: "snap_fit_lid",
    });
  if (findings.length === 0)
    findings.push({
      severity: "info",
      observation: "No defects found — revision " + spec.rev + " incorporates all previous fixes.",
      fix: "Ship it.",
      patch: "none",
    });
  return {
    summary: findings.some(f => f.severity === "major")
      ? "Functional prototype with fixable mechanical issues — a revision is recommended before daily use."
      : "Prototype passes inspection.",
    recommendRevision: findings.some(f => f.patch !== "none"),
    findings,
  };
}

// ---------------------------------------------------------------- conversational editing
// Text instruction → typed edit ops. Offline regex parser always available;
// Claude produces the same op format when a key is configured.
export const EDIT_SCHEMA = {
  type: "object", additionalProperties: false, required: ["ops", "explanation"],
  properties: {
    explanation: { type: "string", description: "One sentence: what will change and the downstream effect" },
    ops: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["op", "value"],
        properties: {
          op: {
            type: "string",
            enum: ["set_wall", "set_plate", "set_height", "set_dial_clearance", "set_reach",
              "jacks_side", "jacks_rear", "snap_fit_on", "snap_fit_off", "usb_ribs_on",
              "set_keys", "set_encoders", "set_pedals", "trackball_on", "trackball_off",
              "oled_on", "oled_off", "hand_left", "hand_right", "grow_width"],
          },
          value: { type: "number", description: "mm or count; 0 when not applicable" },
        },
      },
    },
  },
};

export function parseEditOffline(text) {
  const t = (text || "").toLowerCase();
  const ops = [];
  const num = re => { const m = t.match(re); return m ? parseFloat(m[1]) : null; };
  const mm = num(/(\d+(?:\.\d+)?)\s*(?:mm|millimet)/);
  if (/wall/.test(t) && mm) ops.push({ op: "set_wall", value: mm });
  else if (/plate/.test(t) && mm) ops.push({ op: "set_plate", value: mm });
  else if (/(taller|height)/.test(t) && mm) ops.push({ op: "set_height", value: mm });
  else if (/(clearance|dial)/.test(t) && mm) ops.push({ op: "set_dial_clearance", value: mm });
  else if (/(wider|width|bigger|larger)/.test(t) && mm) ops.push({ op: "grow_width", value: mm });
  else if (/reach/.test(t) && mm) ops.push({ op: "set_reach", value: mm });
  if (/jack.*side|side.*jack/.test(t)) ops.push({ op: "jacks_side", value: 0 });
  if (/jack.*(rear|back)|rear.*jack/.test(t)) ops.push({ op: "jacks_rear", value: 0 });
  if (/snap[- ]?fit|no screws|clip.*(lid|plate)/.test(t)) ops.push({ op: "snap_fit_on", value: 0 });
  if (/\bscrews? instead|use screws/.test(t)) ops.push({ op: "snap_fit_off", value: 0 });
  if (/rib|reinforc/.test(t)) ops.push({ op: "usb_ribs_on", value: 0 });
  const keys = num(/(\d+)\s*(keys|buttons)/);
  if (keys != null) ops.push({ op: "set_keys", value: keys });
  const enc = num(/(\d+)\s*(dials?|knobs?|encoders?)/);
  if (enc != null) ops.push({ op: "set_encoders", value: enc });
  const ped = num(/(\d+)\s*(pedals?)/);
  if (ped != null) ops.push({ op: "set_pedals", value: ped });
  if (/remove.*trackball|no trackball/.test(t)) ops.push({ op: "trackball_off", value: 0 });
  else if (/add.*trackball|trackball/.test(t) && /add|with/.test(t)) ops.push({ op: "trackball_on", value: 0 });
  if (/left.hand/.test(t)) ops.push({ op: "hand_left", value: 0 });
  if (/right.hand/.test(t)) ops.push({ op: "hand_right", value: 0 });
  if (/one.hand|easier.*one/.test(t)) ops.push({ op: "set_reach", value: 80 });
  return { ops, explanation: ops.length ? "Parsed locally into " + ops.length + " parameter change(s)." : "No recognized edit — try naming a parameter and a value." };
}

export async function parseEditAI(text, spec) {
  const { text: out } = await callClaude({
    system:
`You translate natural-language CAD edit requests into typed parameter operations
for a parametric input-device generator. Current state: wall ${spec.geometry.wallMM}mm,
plate ${spec.geometry.plateMM}mm, height ${spec.geometry.deckHeightMM}mm, dial clearance
${spec.geometry.dialClearanceMM}mm, reach ${spec.ability.reachMM}mm, keys ${spec.modules.keys.count},
encoders ${spec.modules.encoders.count}, pedals ${spec.modules.pedals.count}, jacks ${spec.geometry.jackEdge},
snapFit ${spec.geometry.snapFit}. Only use the provided ops. If the request cannot be
expressed with them, return zero ops and explain what IS supported.`,
    messages: [{ role: "user", content: text }],
    schema: EDIT_SCHEMA, effort: "low",
  });
  return JSON.parse(out);
}

/** Apply ops → {applied:[...descriptions], affected:[artifacts]} */
export function applyEditOps(spec, ops) {
  const applied = [];
  const g = spec.geometry, m = spec.modules;
  const clampv = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  for (const o of ops) {
    switch (o.op) {
      case "set_wall": g.wallMM = clampv(o.value, 1.2, 5); applied.push(`Wall → ${g.wallMM} mm`); break;
      case "set_plate": g.plateMM = clampv(o.value, 2, 6); applied.push(`Plate → ${g.plateMM} mm`); break;
      case "set_height": g.deckHeightMM = clampv(o.value, 14, 45); applied.push(`Height → ${g.deckHeightMM} mm`); break;
      case "set_dial_clearance": g.dialClearanceMM = clampv(o.value, 2, 12); applied.push(`Dial clearance → ${g.dialClearanceMM} mm`); break;
      case "set_reach": spec.ability.reachMM = clampv(o.value, 55, 130); applied.push(`Reach → ${spec.ability.reachMM} mm`); break;
      case "grow_width": spec.ability.reachMM = clampv(spec.ability.reachMM + o.value / 3, 55, 130); applied.push(`Layout envelope widened (+${o.value} mm target)`); break;
      case "jacks_side": g.jackEdge = "side"; applied.push("Pedal jacks → side wall"); break;
      case "jacks_rear": g.jackEdge = "rear"; applied.push("Pedal jacks → rear wall"); break;
      case "snap_fit_on": g.snapFit = true; applied.push("Snap-fit lid (screws removed)"); break;
      case "snap_fit_off": g.snapFit = false; applied.push("Screwed lid"); break;
      case "usb_ribs_on": g.usbRibs = true; applied.push("USB reinforcement ribs added"); break;
      case "set_keys": m.keys.count = clampv(Math.round(o.value), 4, 24); applied.push(`Keys → ${m.keys.count}`); break;
      case "set_encoders": m.encoders.count = clampv(Math.round(o.value), 0, 4); applied.push(`Encoders → ${m.encoders.count}`); break;
      case "set_pedals": m.pedals.count = clampv(Math.round(o.value), 0, 4); applied.push(`Pedals → ${m.pedals.count}`); break;
      case "trackball_on": m.trackball.present = true; applied.push("Trackball added"); break;
      case "trackball_off": m.trackball.present = false; applied.push("Trackball removed"); break;
      case "oled_on": m.oled.present = true; applied.push("OLED added"); break;
      case "oled_off": m.oled.present = false; applied.push("OLED removed"); break;
      case "hand_left": spec.ability.hand = "left"; applied.push("Mirrored for left hand"); break;
      case "hand_right": spec.ability.hand = "right"; applied.push("Right-hand layout"); break;
    }
  }
  return applied;
}

// ---------------------------------------------------------------- apply patches → next rev
export function applyPatches(spec, findings) {
  const applied = [];
  for (const f of findings) {
    switch (f.patch) {
      case "increase_dial_clearance":
        spec.geometry.dialClearanceMM = 6.0; applied.push("Dial clearance → 6.0 mm"); break;
      case "add_usb_ribs":
        spec.geometry.usbRibs = true; applied.push("Added USB reinforcement ribs"); break;
      case "move_jacks_side":
        spec.geometry.jackEdge = "side"; applied.push("Pedal jacks moved to side wall"); break;
      case "snap_fit_lid":
        spec.geometry.snapFit = true; applied.push("Plate screws → snap-fit tabs"); break;
      case "increase_wall":
        spec.geometry.wallMM = Math.min(4, spec.geometry.wallMM + 0.8); applied.push(`Wall → ${spec.geometry.wallMM.toFixed(1)} mm`); break;
    }
  }
  if (applied.length) {
    spec.rev += 1;
    spec.history.push({ rev: spec.rev, date: new Date().toISOString(), changes: applied });
  }
  return applied;
}
