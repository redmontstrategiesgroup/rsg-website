// ============ THE FORGE — bounded complexity + safety policy ============
// Every project gets a Design Complexity Rating (L1–L5) computed from real
// spec-derived factors, shown with its reasons BEFORE detailed generation.
// L5 requests are refused (a safe requirements outline is offered instead).

export const LEVELS = {
  1: { name: "Single Part",        policy: "Fully automated generation.", color: "#6fce7c" },
  2: { name: "Simple Assembly",    policy: "Fully automated generation with validation.", color: "#9fce6f" },
  3: { name: "Moderate Product",   policy: "Automated generation — formal design review required before manufacturing export.", color: "#ffcc4d" },
  4: { name: "Expert-Assisted",    policy: "Preliminary design only. Expert review required before manufacturing.", color: "#ff9f4d" },
  5: { name: "Unsupported",        policy: "Manufacturing-ready files are not generated for this class of design.", color: "#ff6b5e" },
};

// Prohibited / safety-critical (Level 5). Word-boundary matched, lowercased.
const L5_PATTERNS = [
  { re: /\b(gun|firearm|rifle|pistol|silencer|suppressor|trigger group|receiver|weapon)\b/, why: "weapon or weapon component" },
  { re: /\b(explosive|detonator|bomb|grenade|pyrotechnic charge)\b/, why: "explosive device" },
  { re: /\b(crossbow|launcher|projectile weapon|cannon)\b/, why: "dangerous launch mechanism" },
  { re: /\b(brake caliper|steering knuckle|suspension arm|airbag|seat ?belt)\b/, why: "safety-critical automotive component" },
  { re: /\b(flight control|wing spar|propeller hub|rotor blade|avionics)\b/, why: "aircraft flight component" },
  { re: /\b(implant|pacemaker|stent|prosthetic joint|surgical)\b/, why: "medical implant / clinical device" },
  { re: /\b(ventilator|life support|dialysis|defibrillator)\b/, why: "life-support equipment" },
  { re: /\b(pressure vessel|compressed air tank|boiler|hydraulic accumulator)\b/, why: "high-pressure vessel" },
  { re: /\b(mains|110v|120v|230v|240v|line voltage|high voltage)\b/, why: "mains / high-voltage equipment without certified design" },
  { re: /\b(climbing (harness|anchor)|scaffold|balcony rail|ladder rung|lifting hook|winch mount|tow hitch)\b/, why: "structural failure could seriously injure someone" },
  { re: /\b(hidden camera|covert (mic|microphone|recorder)|gps tracker for)\b/, why: "covert surveillance hardware" },
  { re: /\b(defeat|bypass) (the )?(interlock|safety|guard)\b/, why: "bypasses a safety protection" },
];

/** Screen a raw request BEFORE generation. Returns null if clear. */
export function screenRequest(sentence) {
  const s = (sentence || "").toLowerCase();
  for (const p of L5_PATTERNS) {
    const m = s.match(p.re);
    if (m) return { blocked: true, match: m[0], why: p.why };
  }
  return null;
}

/** A safe, non-manufacturing response for blocked requests. */
export function refusalDocument(sentence, hit) {
  return {
    title: "Request outside supported scope (Level 5)",
    body:
`The Forge does not generate manufacturing-ready files for this class of design
(${hit.why} — matched "${hit.match}").

What The Forge can offer instead:
• A high-level requirements outline you can take to a qualified engineer
• Design of non-critical adjacent parts (organizers, covers, labels, cases)
• Referral guidance: this class of design requires certified engineering review,
  applicable standards analysis, and physical testing that no generative tool
  should shortcut.

Nothing has been generated for this request.`,
  };
}

/**
 * Score a built spec. factors are real values pulled from the design.
 * Returns {level, name, policy, color, reasons[], factors{}}
 */
export function rateSpec(spec) {
  const m = spec.modules || {};
  const d = spec.derived || {};
  const f = {
    customParts: countCustomParts(spec),
    purchasedParts: d.keyTotal ? d.keyTotal + 10 : 4,
    movingSubsystems: (m.encoders?.count ? 1 : 0) + (m.trackball?.present ? 1 : 0), // rotary DOF only
    complexMotion: 0,                              // no hinges/linkages in current library
    electronics: !!(spec.mcu || m.oled?.present || (m.keys?.count > 0)),
    pcbs: spec.mcu ? 1 : 0,
    voltage: spec.mcu ? 5 : 0,
    peakCurrentA: spec.mcu ? 0.5 : 0,
    storedEnergy: spec.wireless ? "small LiPo (approved module)" : "none",
    loads: spec.loadClass || "desktop static",
    tolerances: "FDM standard (±0.2 mm)",
    thermal: "ambient indoor",
    environment: spec.environment || "indoor desktop",
    safetyImpact: "low — low-voltage, non-structural",
    processes: spec.processes || ["FDM printing", "PCB fab", "hand assembly"],
  };

  const reasons = [];
  let level = 1;
  const raise = (to, why) => { if (to > level) level = to; reasons.push(`L${to}: ${why}`); };

  if (f.customParts <= 1 && !f.electronics) reasons.push("L1: single custom part, no electronics");
  if (f.customParts > 1) raise(2, `${f.customParts} custom parts form an assembly`);
  if (f.electronics && f.customParts <= 5) raise(2, "low-voltage electronics (USB 5 V, approved modules only)");
  if (f.customParts > 5) raise(3, `${f.customParts} custom parts exceeds the L2 limit of 5`);
  if (f.pcbs >= 1 && f.movingSubsystems >= 1) raise(3, "custom PCB combined with rotary inputs");
  if ((m.keys?.count || 0) + (m.kvmKeys || 0) >= 8) raise(3, "full input-matrix product with firmware");
  if (f.customParts > 15) raise(4, `${f.customParts} custom parts exceeds the L3 limit of 15`);
  if (f.movingSubsystems > 2 || f.complexMotion) raise(4, "multiple moving subsystems");
  if (spec.environment === "outdoor") raise(4, "outdoor / harsh-environment exposure");
  if (spec.mainsPower) raise(5, "mains power is not supported");

  const L = LEVELS[level];
  return { level, ...L, reasons, factors: f };
}

function countCustomParts(spec) {
  // custom = things The Forge itself designs (not purchased)
  let n = 0;
  if (spec.derived?.deck) n += 2;                 // shell + plate
  if (spec.mcu) n += 1;                           // custom PCB
  if (spec.singlePart) n = 1;
  if (spec.partCountOverride) n = spec.partCountOverride;
  return Math.max(1, n);
}

/** Human summary of what the level means for exports. */
export function exportPolicy(level) {
  if (level <= 2) return { allowed: true, review: false, note: "Automated export permitted." };
  if (level === 3) return { allowed: true, review: true, note: "Design review checkpoint required before the manufacturing package export (Gate 6)." };
  if (level === 4) return { allowed: true, review: true, expert: true, note: "Files are PRELIMINARY. Expert review required before manufacturing." };
  return { allowed: false, review: false, note: "Export blocked — unsupported design class." };
}
