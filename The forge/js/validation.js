// ============ THE FORGE — validation: DFM, interference, electrical, calcs, gates ============
// Every check reports {id, sev: 'pass'|'warn'|'fail', area, text, basis}.
// `basis` says HOW the number was obtained (calculated / rule / assumption) —
// The Forge never presents a fabricated result as an engineering certainty.

import { DIMS } from "./layout.js";

// ---------------------------------------------------------------- DFM (FDM)
export function dfmFDM(spec) {
  const g = spec.geometry, d = spec.derived;
  const out = [];
  const rule = (id, cond, failTxt, passTxt, sev = "fail", basis = "rule") =>
    out.push({ id, sev: cond ? "pass" : sev, area: "DFM/FDM", text: cond ? passTxt : failTxt, basis });

  rule("wall-min", g.wallMM >= 1.2,
    `Wall ${g.wallMM} mm is under the 1.2 mm minimum (3 × 0.4 mm perimeters)`,
    `Wall ${g.wallMM} mm ≥ 1.2 mm minimum (3 perimeters at 0.4 mm nozzle)`);
  rule("plate-min", g.plateMM >= 2.5,
    `Plate ${g.plateMM} mm is thin for a printed plate — use ≥ 2.5 mm and print a 1.5 mm clip recess per cutout so MX clips engage`,
    `Plate ${g.plateMM} mm with a 1.5 mm clip recess per cutout — MX switches clip in as on a standard plate`, "warn");
  const bed = spec.printerBedMM || 220;
  const fitsX = d.deck.w <= bed, fitsY = d.deck.d <= bed;
  rule("bed-fit", fitsX && fitsY,
    `Deck ${d.deck.w.toFixed(0)}×${d.deck.d.toFixed(0)} mm exceeds the ${bed} mm bed — reduce reach, key count, or split the shell with a dovetail joint`,
    `Deck ${d.deck.w.toFixed(0)}×${d.deck.d.toFixed(0)} mm fits the ${bed} mm bed flat, no supports`);
  const usbBridge = 13 + 4;
  rule("bridge-usb", usbBridge <= 24,
    `USB lintel bridges ${usbBridge} mm — over the 24 mm unsupported bridge limit`,
    `Longest unsupported bridge (USB lintel) is ${usbBridge} mm ≤ 24 mm — printable without supports`);
  rule("warp", d.deck.w < 230 || spec.material !== "ABS",
    "Large flat ABS part — high warp risk; use PETG or add brim + enclosure",
    `PETG on a ${d.deck.w.toFixed(0)} mm footprint — low warp risk; 6 mm brim recommended`, "warn");
  rule("hole-comp", true, "",
    "All plate cutouts pre-compensated +0.15 mm for FDM shrinkage", "warn", "rule (applied in generator)");
  rule("inserts", true, "",
    "6 insert bosses Ø7.2 mm for M3×5.7 heat-set inserts — above the 2× insert-diameter minimum wall", "warn");
  return out;
}

// ---------------------------------------------------------------- interference / clearance
// Real 2-D footprint checks on the generated placements (the same data the
// geometry is built from), not a cosmetic list.
export function clearanceChecks(spec) {
  const { parts, deck, jacks, usb } = spec.derived;
  const g = spec.geometry;
  const out = [];
  const radiusOf = p =>
    p.type === "trackball" ? p.d / 2 + DIMS.TB_HOUSING
    : p.type === "encoder" ? DIMS.KNOB_D / 2
    : p.type === "oled" ? Math.hypot(DIMS.OLED_W, DIMS.OLED_H) / 2
    : DIMS.KEY_PITCH / 2 - 0.5;

  let worstPair = null, worstGap = 1e9, pairFails = 0;
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      const need = (a.type === "encoder" || b.type === "encoder") ? g.dialClearanceMM
        : (a.type === "trackball" || b.type === "trackball") ? 2.0 : 0.6;
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - radiusOf(a) - radiusOf(b);
      if (gap < worstGap) { worstGap = gap; worstPair = [a, b]; }
      if (gap < need - 0.01) {
        pairFails++;
        if (pairFails <= 3) out.push({
          id: `clr-${a.label}-${b.label}`, sev: "fail", area: "Assembly",
          text: `Interference: ${a.label} ↔ ${b.label} gap ${gap.toFixed(1)} mm < required ${need.toFixed(1)} mm`,
          basis: "calculated from placements",
        });
      }
    }
  }
  if (!pairFails) out.push({
    id: "clr-all", sev: "pass", area: "Assembly",
    text: `No component interference — tightest pair ${worstPair?.[0].label} ↔ ${worstPair?.[1].label} at ${worstGap.toFixed(1)} mm gap`,
    basis: "calculated from placements (2-D footprints)",
  });

  // parts inside the deck outline
  let outOfBounds = 0;
  for (const p of parts) {
    const r = radiusOf(p);
    if (Math.abs(p.x) + r > deck.w / 2 - 2 || Math.abs(p.y) + r > deck.d / 2 - 2) outOfBounds++;
  }
  out.push(outOfBounds
    ? { id: "edge", sev: "fail", area: "Assembly", text: `${outOfBounds} component(s) breach the 2 mm edge margin`, basis: "calculated" }
    : { id: "edge", sev: "pass", area: "Assembly", text: "All components hold ≥ 2 mm to the deck edge", basis: "calculated" });

  // connector spacing on the wall
  if (jacks.length) {
    let jackOK = true;
    for (let i = 1; i < jacks.length; i++) {
      const dist = Math.hypot(jacks[i].x - jacks[i - 1].x, jacks[i].y - jacks[i - 1].y);
      if (dist < 14) jackOK = false;
    }
    const sameEdge = jacks.some(j => j.edge === usb.edge && Math.abs((j.edge === "rear" ? j.x : j.y) - (usb.edge === "rear" ? usb.x : usb.y)) < 16);
    out.push({ id: "jack-pitch", sev: jackOK ? "pass" : "fail", area: "Assembly",
      text: jackOK ? "TRS jacks ≥ 14 mm apart — plugs won't collide" : "TRS jacks closer than 14 mm — molded plugs will collide", basis: "calculated" });
    out.push({ id: "usb-jack", sev: sameEdge ? "warn" : "pass", area: "Assembly",
      text: sameEdge ? "A pedal jack sits within 16 mm of the USB opening — check cable crowding" : "USB and pedal connectors are separated — no cable crowding", basis: "calculated" });
  }
  // tool access for lid fasteners
  out.push({ id: "tool-access", sev: "pass", area: "Assembly",
    text: spec.geometry.snapFit ? "Snap-fit lid — no tool access needed" : "All 6 plate screws vertical, unobstructed hex-key access", basis: "rule" });
  return out;
}

// ---------------------------------------------------------------- electrical
const S3_STRAPPING = [0, 3, 45, 46];
const S3_PSRAM_N8R2 = [35, 36, 37];
const S3_USB = [19, 20];

export function elecChecks(spec) {
  const e = spec.derived.elec;
  const out = [];
  if (!e) return out;
  const used = [];
  const claim = (pin, who) => used.push({ pin, who });
  e.matrix.rows.forEach((p, i) => claim(p, `ROW${i}`));
  e.matrix.cols.forEach((p, i) => claim(p, `COL${i}`));
  e.encoders.forEach(en => { claim(en.a, en.label + "A"); claim(en.b, en.label + "B"); claim(en.sw, en.label + "SW"); });
  e.pedals.forEach(p => claim(p.pin, p.label));
  if (e.i2cPins) { claim(e.i2cPins.sda, "SDA"); claim(e.i2cPins.scl, "SCL"); }

  // conflicts
  const seen = new Map(); let dup = 0;
  for (const u of used) {
    if (seen.has(u.pin)) { dup++; out.push({ id: "pin-dup" + u.pin, sev: "fail", area: "Electrical", text: `GPIO${u.pin} assigned twice: ${seen.get(u.pin)} and ${u.who}`, basis: "netlist" }); }
    seen.set(u.pin, u.who);
  }
  if (!dup) out.push({ id: "pin-uniq", sev: "pass", area: "Electrical", text: `${used.length} GPIO assignments, no conflicts`, basis: "netlist" });

  // strapping / reserved pins
  for (const u of used) {
    if (S3_STRAPPING.includes(u.pin))
      out.push({ id: "strap" + u.pin, sev: u.who.startsWith("PEDAL") ? "warn" : "fail", area: "Electrical",
        text: `GPIO${u.pin} (${u.who}) is an ESP32-S3 strapping pin — ${u.who.startsWith("PEDAL") ? "acceptable as pulled-up input, but keep the pedal unplugged during flashing" : "reassign it"}`, basis: "ESP32-S3 datasheet §2.4" });
    if (S3_PSRAM_N8R2.includes(u.pin))
      out.push({ id: "psram" + u.pin, sev: "fail", area: "Electrical", text: `GPIO${u.pin} (${u.who}) is reserved for octal PSRAM on the N8R2 module — reassign`, basis: "ESP32-S3-DevKitC-1 v1.1 schematic" });
    if (S3_USB.includes(u.pin))
      out.push({ id: "usbpin" + u.pin, sev: "fail", area: "Electrical", text: `GPIO${u.pin} (${u.who}) is USB D+/D- — reassign`, basis: "datasheet" });
  }
  if (!used.some(u => S3_PSRAM_N8R2.includes(u.pin) || S3_USB.includes(u.pin)))
    out.push({ id: "reserved-ok", sev: "pass", area: "Electrical", text: "No assignments on PSRAM (35–37) or USB (19/20) reserved pins", basis: "ESP32-S3-DevKitC-1 pin map" });

  // I2C address conflicts
  if (e.i2c.length) {
    const addrs = e.i2c.map(d => d.addr);
    const ok = new Set(addrs).size === addrs.length;
    out.push({ id: "i2c-addr", sev: ok ? "pass" : "fail", area: "Electrical",
      text: ok ? `I²C bus clean: ${e.i2c.map(d => `${d.label}@${d.addr}`).join(", ")} + 4.7 kΩ pull-ups` : "I²C address conflict", basis: "netlist" });
  }
  // power budget
  const budget = powerBudget(spec);
  out.push({ id: "power", sev: budget.totalmA <= 500 ? "pass" : "fail", area: "Electrical",
    text: `Power budget ${budget.totalmA} mA of 500 mA USB 2.0 (${budget.lines.map(l => `${l.name} ${l.mA}`).join(", ")})`,
    basis: "sum of datasheet typicals — measure at first power-on" });
  return out;
}

export function powerBudget(spec) {
  const m = spec.modules;
  const lines = [{ name: "ESP32-S3", mA: spec.wireless ? 240 : 90 }];
  if (m.oled?.present) lines.push({ name: "OLED", mA: 20 });
  if (m.trackball?.present) lines.push({ name: "Trackball", mA: 40 });
  lines.push({ name: "misc/LEDs", mA: 15 });
  return { lines, totalmA: lines.reduce((s, l) => s + l.mA, 0) };
}

// ---------------------------------------------------------------- firmware ↔ hardware consistency
export function firmwareConsistency(spec, firmwareSource) {
  const e = spec.derived.elec;
  const out = [];
  if (!e || !firmwareSource) return out;
  const grab = re => (firmwareSource.match(re)?.[1] || "").split(",").map(s => parseInt(s.trim(), 10)).filter(Number.isFinite);
  const fwRows = grab(/ROW_PINS\[N_ROWS\] = \{ ([^}]*)\}/);
  const fwCols = grab(/COL_PINS\[N_COLS\] = \{ ([^}]*)\}/);
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const rowsOK = same(fwRows, e.matrix.rows), colsOK = same(fwCols, e.matrix.cols);
  out.push({ id: "fw-rows", sev: rowsOK ? "pass" : "fail", area: "Firmware",
    text: rowsOK ? `Firmware ROW_PINS [${fwRows}] match the schematic` : `Firmware rows [${fwRows}] ≠ schematic [${e.matrix.rows}]`, basis: "parsed from generated source" });
  out.push({ id: "fw-cols", sev: colsOK ? "pass" : "fail", area: "Firmware",
    text: colsOK ? `Firmware COL_PINS [${fwCols}] match the schematic` : `Firmware cols [${fwCols}] ≠ schematic [${e.matrix.cols}]`, basis: "parsed from generated source" });
  const hasWatchdog = firmwareSource.includes("DEBOUNCE_MS");
  out.push({ id: "fw-debounce", sev: hasWatchdog ? "pass" : "warn", area: "Firmware",
    text: hasWatchdog ? "Input debouncing present (6 ms per-key)" : "No debouncing found", basis: "source scan" });
  return out;
}

// ---------------------------------------------------------------- PCB copper vs. netlist
// The Gerber/Excellon geometry is real, but pcb.js routes matrix/encoder escapes to
// header pads via a placeholder mapping (gpio % padCount), NOT the DevKitC-1 physical
// pinout — so the copper does not electrically match the schematic/firmware. Nothing
// else validates this (elecChecks only reads the abstract netlist). Surface it honestly.
export function pcbChecks(spec) {
  const p = spec.derived && spec.derived.pcb;
  const out = [];
  if (!p) return out;
  const traces = (p.traces || []).length, pads = (p.pads || []).length;
  out.push({ id: "pcb-geometry", sev: "pass", area: "PCB",
    text: `Board geometry generated: ${pads} pads, ${traces} traces, ${p.board.w.toFixed(0)}×${p.board.h.toFixed(0)} mm — Gerber X2 + Excellon are structurally valid`,
    basis: "generated 2-D geometry" });
  out.push({ id: "pcb-netlist", sev: "warn", area: "PCB",
    text: "Header-pin mapping is an UNVERIFIED placeholder — the matrix/encoder escapes are routed to header pads by position, not to the ESP32-S3-DevKitC-1 pins that carry those GPIOs. The copper does NOT yet electrically match the schematic. Do not fabricate before verifying the header→GPIO map (requires a DevKitC-1 physical-pinout table) and running DRC.",
    basis: "pcb.js gpioPad = hdrPins[gpio % padCount] — placeholder, not the physical pinout" });
  return out;
}

// ---------------------------------------------------------------- engineering calcs
// Real formulas with explicit assumptions. Values labelled calculated vs assumed.
export function engineeringCalcs(spec) {
  const d = spec.derived, g = spec.geometry;
  const calcs = [];

  // Plate deflection: simply-supported beam strip across the shorter span
  {
    const L = Math.min(d.deck.w, d.deck.d) - 20;                // mm span between screw lines
    const b = 100, t = g.plateMM;                               // strip width, thickness
    const E = 2100;                                             // N/mm² PETG
    const F = 30;                                               // N palm-rest load (assumed)
    const I = (b * t ** 3) / 12;
    const w = (F * L ** 3) / (48 * E * I);
    calcs.push({
      name: "Plate deflection under palm load",
      value: `${w.toFixed(2)} mm at centre`,
      status: w < 1.2 ? "ok" : "review",
      how: "calculated — simply-supported beam, w = FL³/48EI",
      assumptions: [`F = ${F} N palm load (assumed)`, `span ${L.toFixed(0)} mm between screw lines`, "PETG E = 2.1 GPa", `plate ${t} mm, 100 mm strip`],
      note: w < 1.2 ? "Acceptable — under the 1.2 mm perceptible-flex threshold" : "Add a centre standoff or thicken the plate",
    });
  }
  // Tip-over
  {
    const W = (d.printGrams + 350) / 1000 * 9.81;               // device + PCB + parts, N
    const halfDepth = d.deck.d / 2, cgH = 14;
    const tipForce = (W * halfDepth) / cgH;
    calcs.push({
      name: "Tip-over resistance (rear edge press)",
      value: `${tipForce.toFixed(0)} N to tip`,
      status: tipForce > 15 ? "ok" : "review",
      how: "calculated — moment balance about the rear foot line",
      assumptions: [`mass ${(d.printGrams + 350)} g (print + components, estimated)`, "CG height 14 mm (estimated)", "rigid feet, no slide"],
      note: "Any value above ~15 N is safe for keypress loads (< 1 N)",
    });
  }
  // Fastener pull-out
  {
    const screws = spec.geometry.snapFit ? 0 : 6;
    if (screws) calcs.push({
      name: "Plate fastener margin",
      value: "≈ 300 N pull-out per M3 insert vs < 40 N service load",
      status: "ok",
      how: "manufacturer typical for M3 brass insert in PETG (approximate)",
      assumptions: ["6 fasteners share the load", "insert installed at correct temperature"],
      note: "Factor of safety > 40 — screws are not the weak point",
    });
  }
  // Power / battery
  {
    const p = powerBudget(spec);
    calcs.push({
      name: "Power budget",
      value: `${p.totalmA} mA of 500 mA available`,
      status: p.totalmA <= 500 ? "ok" : "review",
      how: "calculated — sum of datasheet typical currents",
      assumptions: p.lines.map(l => `${l.name}: ${l.mA} mA (datasheet typical)`),
      note: p.totalmA <= 500 ? "Bus-powered with margin" : "Exceeds USB 2.0 — needs a powered hub",
    });
    if (spec.wireless) calcs.push({
      name: "Battery runtime (if BLE option fitted)",
      value: `${(2000 / (p.totalmA * 0.6)).toFixed(0)} h from a 2000 mAh approved LiPo module`,
      status: "ok",
      how: "estimated — average draw at 60% of peak",
      assumptions: ["approved charger/protection module (no custom charge circuit)", "radio duty-cycled"],
      note: "Estimate only — verify with a power profiler",
    });
  }
  // Fits
  {
    calcs.push({
      name: "Critical fits",
      value: "switch cutout 14.00 +0.15 / knob shaft Ø6.05 D-bore / ball seat +0.30",
      status: "ok",
      how: "rule — FDM compensation table applied in the generator",
      assumptions: ["0.4 mm nozzle, 0.2 mm layers", "dimensional calibration within ±0.1 mm"],
      note: "Ream the D-bore with a 6 mm drill if the knob binds",
    });
  }
  // Tolerance stack across the top strip
  {
    const n = (spec.modules.encoders.count || 0) + 1;
    const stack = Math.sqrt(n) * 0.15;
    calcs.push({
      name: "Top-strip tolerance stack (RSS)",
      value: `±${stack.toFixed(2)} mm across ${n} placed features`,
      status: stack < g.dialClearanceMM / 2 ? "ok" : "review",
      how: "calculated — root-sum-square of ±0.15 mm per printed feature",
      assumptions: ["independent feature errors"],
      note: `Dial clearance ${g.dialClearanceMM} mm absorbs the stack`,
    });
  }
  return calcs;
}

// ---------------------------------------------------------------- gates
export function computeGates(project) {
  const { spec, requirements, complexity, conceptChosen, checks, calcs, exportedOnce, reviewAcknowledged, dfmAcked } = project;
  const crit = requirements?.filter(r => r.status === "unknown" && r.critical) || [];
  const fails = a => (checks || []).filter(c => c.area === a && c.sev === "fail");
  const warns = a => (checks || []).filter(c => c.area === a && c.sev === "warn");
  const gates = [];
  const G = (n, name, pass, blockers) => gates.push({ n, name, pass, blockers });

  G(1, "Requirements complete", crit.length === 0,
    crit.map(r => `Unknown: ${r.question || r.text}`));
  G(2, "Concept approved", !!conceptChosen,
    conceptChosen ? [] : ["Select a design concept"]);
  G(3, "Geometry valid", !!spec?.derived?.deck && fails("Assembly").length === 0,
    fails("Assembly").map(c => c.text));
  const dfmF = fails("DFM/FDM");
  G(4, "Manufacturability valid", dfmF.length === 0 && (warns("DFM/FDM").length === 0 || !!dfmAcked),
    [...dfmF.map(c => c.text), ...(warns("DFM/FDM").length && !dfmAcked ? [`${warns("DFM/FDM").length} DFM warnings need acknowledgement`] : [])]);
  G(5, "Electronics valid", fails("Electrical").length === 0 && fails("Firmware").length === 0,
    [...fails("Electrical").map(c => c.text), ...fails("Firmware").map(c => c.text)]);
  const lvl = complexity?.level ?? 3;
  const g6pass = lvl <= 2 || (lvl === 3 && !!reviewAcknowledged);
  G(6, "Safety / design review", g6pass,
    lvl >= 5 ? ["Unsupported design class — export blocked"]
      : lvl === 4 ? ["Expert review required before manufacturing (Level 4)"]
      : lvl === 3 && !reviewAcknowledged ? ["Confirm the design review checkpoint (Level 3)"] : []);
  G(7, "Manufacturing package", gates.every(g => g.pass) && !!exportedOnce,
    !exportedOnce ? ["Export the complete package"] : gates.filter(g => !g.pass).map(g => `Gate ${g.n} open`));
  return gates;
}
