// ============ THE FORGE — requirements engine ============
// One sentence is the starting point, not the spec. This module derives
// categorized requirements with an explicit status (confirmed / assumption /
// unknown), generates a short high-value interview for the unknowns, and
// turns requirements into acceptance tests. Gate 1 blocks while critical
// unknowns remain.

let _id = 0;
const R = (cat, text, status, extra = {}) => ({
  id: "req" + (++_id), cat, text, status, critical: false, ...extra,
});

export const CATEGORIES = [
  "Functional", "Physical", "Interface", "Manufacturing", "Material",
  "Electrical", "Environmental", "Accessibility", "Cost", "Safety", "Testing", "Appearance",
];

/** Build the requirement set for a deck-class spec (product/electronics/access). */
export function deriveRequirements(spec, sentence) {
  _id = 0;
  const m = spec.modules;
  const reqs = [];
  const s = (sentence || "").toLowerCase();

  // ---- Functional (from the sentence → confirmed) ----
  if (m.kvmKeys) reqs.push(R("Functional", `Switch control between ${Math.max(2, m.kvmKeys - 2)} computers via KVM/PiKVM hotkeys`, "confirmed"));
  reqs.push(R("Functional", `${m.keys.count} programmable macro keys across ${spec.profiles.length} profiles`, "confirmed"));
  if (m.trackball.present) reqs.push(R("Functional", "Full cursor control from the deck (thumb trackball, press-to-click)", "confirmed"));
  if (m.encoders.count) reqs.push(R("Functional", `${m.encoders.count} rotary dials for volume / scroll / jog`, "confirmed"));
  if (m.voiceButton) reqs.push(R("Functional", "Dedicated voice/dictation trigger key", "confirmed"));
  if (m.pedals.count) reqs.push(R("Functional", `${m.pedals.count} foot-pedal inputs for modifiers`, "confirmed"));
  if (s.includes("ghost")) reqs.push(R("Functional", "Trigger GHOST workflows (exposed as HID F13–F24 + documented macro slots)", "confirmed"));

  // ---- Physical ----
  reqs.push(R("Physical", `Operable entirely with the ${spec.ability.hand} hand`, "confirmed"));
  reqs.push(R("Physical", `All controls inside a ${spec.ability.reachMM} mm comfortable-reach envelope`, "confirmed"));
  reqs.push(R("Physical", "Desktop footprint under 260 × 220 mm", "assumption"));
  reqs.push(R("Physical", "Device must not slide under normal keypress force", "assumption", { test: "Push test: 10 N lateral at plate level — no movement on laminate desk" }));

  // ---- Interface ----
  reqs.push(R("Interface", "USB-C to host, standard HID keyboard + mouse + consumer control (no drivers)", "confirmed"));
  if (m.pedals.count) reqs.push(R("Interface", "3.5 mm TRS jacks for pedals (tip = signal, sleeve = GND)", "confirmed"));
  reqs.push(R("Interface", "Optional wireless (BLE) link", "unknown", {
    critical: false,
    question: "Should it also work wirelessly over Bluetooth?",
    options: ["USB only", "USB + BLE"],
    apply: (spec2, a) => { spec2.wireless = a === "USB + BLE"; },
  }));

  // ---- Manufacturing (critical unknown: printer bed) ----
  reqs.push(R("Manufacturing", "Enclosure printable on the user's FDM printer without supports", "unknown", {
    critical: true,
    question: "What is your 3D printer's bed size?",
    options: ["180×180 mm", "220×220 mm", "300×300 mm"],
    apply: (spec2, a) => { spec2.printerBedMM = parseInt(a, 10); },
  }));
  reqs.push(R("Manufacturing", "2-layer PCB from a standard prototype service (JLCPCB/PCBWay class)", "assumption"));
  reqs.push(R("Manufacturing", "Hand-solderable: through-hole switches and 0.1\" headers only", "assumption"));

  // ---- Material ----
  reqs.push(R("Material", "Enclosure: PETG (stiffness at the USB wall, low warp) — see material study", "assumption"));

  // ---- Electrical ----
  reqs.push(R("Electrical", "Bus-powered: total draw ≤ 500 mA at 5 V (USB 2.0 budget)", "confirmed", { test: "Measure supply current during trackball + OLED + radio worst case; must be ≤ 500 mA" }));
  reqs.push(R("Electrical", "Low-voltage only — no mains, no custom battery charging circuitry", "confirmed"));

  // ---- Environmental ----
  reqs.push(R("Environmental", "Indoor desktop use, 15–35 °C, non-condensing", "assumption"));

  // ---- Accessibility ----
  if (spec.access || spec.ability) {
    reqs.push(R("Accessibility", "Key actuation force ≤ 0.45 N (45 g) — light linear switches", "confirmed", {
      test: "Force-gauge each key class; every reading ≤ 0.45 N",
    }));
    reqs.push(R("Accessibility", "Layout regenerates from the physical-ability profile (fingers / reach)", "confirmed"));
    reqs.push(R("Accessibility", "No action requires two simultaneous distant presses", "assumption", { test: "Walk every documented function using one hand only" }));
  }

  // ---- Cost (unknown: budget) ----
  reqs.push(R("Cost", "Prototype parts budget", "unknown", {
    critical: true,
    question: "What is your target parts budget for the prototype?",
    options: ["Under $80", "Under $120", "Flexible"],
    apply: (spec2, a) => { spec2.budgetUSD = a.includes("80") ? 80 : a.includes("120") ? 120 : 0; },
  }));

  // ---- Safety ----
  reqs.push(R("Safety", "Must never emit keystrokes while a key is stuck or bouncing (debounce + matrix diodes)", "confirmed", { test: "30-min soak: zero ghost/repeat events in a key logger" }));
  reqs.push(R("Safety", "No exposed conductors; all circuits behind the enclosure wall", "confirmed"));

  // ---- Testing ----
  reqs.push(R("Testing", "Every key, dial, pedal and the pointer verified by the scripted test procedure", "confirmed"));

  // ---- Appearance ----
  reqs.push(R("Appearance", "Visual style preference", "unknown", {
    critical: false,
    question: "Any appearance preference?",
    options: ["Dark industrial", "Light minimal", "Don't care"],
    apply: (spec2, a) => { spec2.appearance = a; },
  }));

  return reqs;
}

/** Simpler requirement sets for single-part / enclosure / wood flows. */
export function deriveSimpleRequirements(kind, cfg) {
  _id = 0;
  const reqs = [];
  if (kind === "enclosure") {
    reqs.push(R("Functional", `House ${cfg.board === "none" ? "user hardware" : cfg.board} with ${cfg.vents ? "ventilation" : "a sealed body"}`, "confirmed"));
    reqs.push(R("Physical", `Internal clear volume ${cfg.w}×${cfg.d}×${cfg.h} mm`, "confirmed"));
    if (cfg.wallMount) reqs.push(R("Interface", "Wall-mountable via keyhole tabs (2× #8 screws)", "confirmed", { test: "Hang loaded enclosure; verify no pull-out at 3× weight" }));
    if (cfg.gland) reqs.push(R("Environmental", "Cable entry through an M12 gland; splash-resistant when vents face down", "confirmed"));
    reqs.push(R("Manufacturing", "Printable without supports (lid + base, flat orientation)", "confirmed"));
    reqs.push(R("Testing", "All ports accessible with cables installed", "confirmed", { test: "Insert every mating connector with the lid closed" }));
  } else if (kind === "part") {
    reqs.push(R("Functional", `${cfg.typeName} regenerated from ${Object.keys(cfg.params).length} parameters`, "confirmed"));
    reqs.push(R("Physical", "All driving dimensions explicit — nothing scaled from images", "confirmed"));
    reqs.push(R("Manufacturing", `${cfg.process} within standard capability`, "confirmed"));
    reqs.push(R("Testing", "Test-fit against the mating part before final material", "confirmed", { test: "Dry-fit; re-run with adjusted clearance if binding" }));
  } else if (kind === "wood") {
    reqs.push(R("Functional", `${cfg.typeName} sized to the supplied stock`, "confirmed"));
    reqs.push(R("Material", `${cfg.speciesName}, movement allowance included in joinery`, "confirmed"));
    reqs.push(R("Manufacturing", "Buildable with the listed shop tools; cut list within board dimensions", "confirmed"));
    reqs.push(R("Safety", "No structural member relies on end-grain screws alone", "confirmed"));
  }
  return reqs;
}

export function unknowns(reqs) { return reqs.filter(r => r.status === "unknown"); }
export function criticalUnknowns(reqs) { return reqs.filter(r => r.status === "unknown" && r.critical); }
export function conflicts(reqs, spec) {
  const out = [];
  if (spec.budgetUSD && spec.derived?.bomTotal && spec.derived.bomTotal > spec.budgetUSD)
    out.push(`Cost conflict: BOM $${spec.derived.bomTotal.toFixed(0)} exceeds the $${spec.budgetUSD} budget — run a cost optimization or raise the budget.`);
  if (spec.printerBedMM && spec.derived?.deck && (spec.derived.deck.w > spec.printerBedMM || spec.derived.deck.d > spec.printerBedMM))
    out.push(`Manufacturing conflict: deck ${spec.derived.deck.w.toFixed(0)}×${spec.derived.deck.d.toFixed(0)} mm exceeds the ${spec.printerBedMM} mm bed — reduce reach/keys or split the shell.`);
  return out;
}

/** Acceptance tests come from the requirements — not invented separately. */
export function acceptanceTests(reqs) {
  return reqs.filter(r => r.test).map(r => ({ req: r.text, cat: r.cat, test: r.test }));
}
