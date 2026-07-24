// ============ THE FORGE — Claude API bridge ============
// Direct browser calls to api.anthropic.com (raw HTTP — no SDK in a
// zero-build page). The user's key lives only in localStorage.
// Fable 5 notes honoured here: thinking is always on (no `thinking` param),
// refusals are re-served by a server-side Opus 4.8 fallback (beta header).

const LS_KEY = "forge.settings.v1";

export function getSettings() {
  try { return { apiKey: "", model: "claude-fable-5", ...JSON.parse(localStorage.getItem(LS_KEY) || "{}") }; }
  catch { return { apiKey: "", model: "claude-fable-5" }; }
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
