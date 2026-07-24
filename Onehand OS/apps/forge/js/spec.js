// ============ THE FORGE — design spec + offline interpreter ============
// A "spec" is the single source of truth every generator consumes:
// layout, geometry, electronics, firmware, BOM, docs all derive from it.

export function defaultSpec() {
  return {
    name: "OneHand Command Deck",
    tagline: "A one-handed control deck for two computers, three monitors, voice, foot pedals and a PiKVM.",
    mode: "product",
    rev: 1,
    ability: {
      hand: "right",
      fingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
      reachMM: 90,
    },
    modules: {
      keys:      { count: 12, rows: 3, layout: "arc" },
      encoders:  { count: 3 },
      trackball: { present: true, diameter: 34 },
      oled:      { present: true },
      pedals:    { count: 3 },
      voiceButton: true,
      kvmKeys: 4,
      magnets: true,
    },
    mcu: "esp32s3",
    profiles: ["gaming", "coding", "editing", "business"],
    geometry: {                   // revision-tunable manufacturing parameters
      wallMM: 2.4,
      plateMM: 3.0,
      deckHeightMM: 22,
      dialClearanceMM: 4.0,       // gap around encoder knobs
      usbRibs: false,             // reinforcement ribs behind USB opening
      jackEdge: "rear",           // rear | side  (pedal jack placement)
      snapFit: false,             // lid snap tabs to cut screw count
    },
    derived: {},                  // filled by layout engine
    history: [],                  // findings applied per revision
  };
}

// ---------------------------------------------------------------
// Offline interpreter: one sentence -> spec (keyword parametrics).
// Used when no Claude API key is configured; also the fallback.
// ---------------------------------------------------------------
export function interpretOffline(sentence) {
  const s = (sentence || "").toLowerCase();
  const spec = defaultSpec();
  const num = (re, def) => { const m = s.match(re); return m ? parseInt(m[1], 10) : def; };
  const has = (...words) => words.some(w => s.includes(w));

  // Name synthesis
  if (has("macro pad", "macropad")) spec.name = "Forge Macro Pad";
  if (has("stream deck", "streaming")) spec.name = "Stream Command Deck";
  if (has("one hand", "one-hand", "one-handed", "single hand")) spec.name = "OneHand Command Deck";
  if (has("cnc", "shop", "workshop")) spec.name = "Shop Control Pendant";
  if (has("camera", "video switch")) spec.name = "Camera Control Deck";
  if (has("midi", "music", "daw")) spec.name = "DAW Control Surface";

  // Modules
  spec.modules.keys.count = Math.min(24, Math.max(4, num(/(\d+)\s*(keys|buttons|switches)/, 12)));
  spec.modules.encoders.count = Math.min(4, num(/(\d+)\s*(dials|knobs|encoders)/, has("dial", "knob", "encoder", "volume") ? 3 : 2));
  spec.modules.trackball.present = has("trackball", "mouse", "cursor", "pointer", "one hand", "one-hand", "one-handed");
  spec.modules.oled.present = !has("no screen", "no display", "no oled");
  spec.modules.pedals.count = has("pedal", "foot") ? Math.min(4, num(/(\d+)\s*(foot\s*)?pedals?/, 3)) : 0;
  spec.modules.voiceButton = has("voice", "dictation", "speech", "mic");
  spec.modules.kvmKeys = has("kvm", "pikvm", "two computers", "2 computers", "computer-switch", "switch computers", "multiple computers")
    ? Math.max(2, num(/(\d+)\s*computers/, 2)) + 2   // one key per machine + 2 PiKVM shortcuts
    : 0;
  spec.modules.magnets = !has("no magnet");

  if (has("left hand", "left-hand")) spec.ability.hand = "left";

  // Tagline
  spec.tagline = sentence?.trim() || spec.tagline;
  return spec;
}

// JSON Schema Claude must return when interpreting a sentence online.
export const SPEC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "tagline", "keys", "encoders", "trackball", "oled", "pedals", "voiceButton", "kvmKeys", "hand", "designNotes"],
  properties: {
    name: { type: "string", description: "Punchy product name, max 4 words" },
    tagline: { type: "string", description: "One-sentence product description" },
    keys: { type: "integer", description: "Number of programmable macro keys (4-24), excluding KVM keys and voice button" },
    encoders: { type: "integer", description: "Number of rotary dials (0-4)" },
    trackball: { type: "boolean", description: "Include a thumb-operated trackball" },
    oled: { type: "boolean", description: "Include a 128x64 OLED status screen" },
    pedals: { type: "integer", description: "Number of foot-pedal inputs (0-4)" },
    voiceButton: { type: "boolean", description: "Dedicated voice/dictation trigger key" },
    kvmKeys: { type: "integer", description: "Computer-switching + PiKVM shortcut keys (0-6). 0 if no KVM/multi-computer need." },
    hand: { type: "string", enum: ["left", "right"], description: "Which hand operates the device" },
    designNotes: { type: "array", items: { type: "string" }, description: "3-5 short engineering decisions you made and why" },
  },
};

/** Merge a Claude-produced schema object into a full spec. */
export function specFromAI(ai, sentence) {
  const spec = defaultSpec();
  spec.name = ai.name || spec.name;
  spec.tagline = ai.tagline || sentence;
  spec.modules.keys.count = clamp(ai.keys, 4, 24, 12);
  spec.modules.encoders.count = clamp(ai.encoders, 0, 4, 2);
  spec.modules.trackball.present = !!ai.trackball;
  spec.modules.oled.present = !!ai.oled;
  spec.modules.pedals.count = clamp(ai.pedals, 0, 4, 0);
  spec.modules.voiceButton = !!ai.voiceButton;
  spec.modules.kvmKeys = clamp(ai.kvmKeys, 0, 6, 0);
  spec.ability.hand = ai.hand === "left" ? "left" : "right";
  spec.aiNotes = ai.designNotes || [];
  return spec;
}

function clamp(v, lo, hi, def) {
  const n = Number.isFinite(+v) ? +v : def;
  return Math.min(hi, Math.max(lo, n));
}

// Example prompts for the command bar
export const EXAMPLES = [
  "Design a one-handed control deck that lets me operate two computers, three monitors, voice commands, foot pedals, and a PiKVM.",
  "A left-handed macro pad with 8 keys and 2 volume dials for video editing.",
  "Stream deck with 16 buttons, an OLED, and a big rotary dial.",
  "A workshop control pendant with 6 chunky buttons, 1 dial and 2 foot pedals — no screen.",
];
