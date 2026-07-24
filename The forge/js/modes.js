// ============ THE FORGE — woodworking / repair / inventor engines ============
import { WOOD, money } from "./catalog.js";

// ---------------------------------------------------------------- woodworking
export function woodPlan(cfg) {
  // cfg: {type, l, w, t, species}
  const sp = WOOD[cfg.species];
  const IN = 25.4;
  const bfOf = (l, w, t) => (l / IN) * (w / IN) * (t / IN) / 144;

  const cuts = [];
  const cut = (name, qty, l, w, t, mat = sp.name, note = "") => cuts.push({ name, qty, l, w, t, mat, note });

  let name, joinery, hours;
  if (cfg.type === "desk") {
    name = `Live-edge ${sp.name.toLowerCase()} desk`;
    cut("Slab top (trim + flatten)", 1, cfg.l, cfg.w, cfg.t, sp.name, "Router-sled flatten both faces, keep live edge on back");
    cut("Steel A-leg frame", 2, 720, 60, 8, "Mild steel", "Powder-coat black; or laminated wood trestle");
    cut("Stretcher", 1, Math.round(cfg.l * 0.62), 90, 20, sp.name, "Rip from offcut");
    cut("C-channel batten", 2, Math.round(cfg.w * 0.6), 40, 6, "Steel", "Anti-cup, slotted screw holes");
    joinery = [
      "Slab → legs: 8× M8 threaded inserts + 25 mm lag pads (allows seasonal movement in slotted holes)",
      "Stretcher → legs: through-bolted M8, black button head",
      "Battens: routed 4 mm recess across grain, slotted holes outboard",
      "Finish: 2 coats Osmo Polyx or Rubio Monocoat, 320-grit between",
    ];
    hours = 14;
  } else if (cfg.type === "table") {
    name = `${sp.name} coffee table`;
    cut("Slab top", 1, Math.min(cfg.l, 1200), cfg.w, cfg.t);
    cut("Leg blank", 4, 420, 70, 70, sp.name, "Taper two inside faces");
    cut("Apron", 4, 700, 80, 22);
    joinery = ["Aprons → legs: 8×40 mm dominos or M&T", "Top: figure-8 fasteners (movement)", "Finish: hardwax oil"];
    hours = 10;
  } else if (cfg.type === "shelf") {
    name = `${sp.name} wall shelf unit`;
    cut("Shelf board", 3, Math.round(cfg.l * 0.6), Math.round(cfg.w * 0.4), Math.min(cfg.t, 32));
    cut("Steel bracket", 6, 90, 30, 5, "Steel", "Waterjet or off-the-shelf heavy duty");
    joinery = ["Brackets → studs: 2× #12×75 mm per bracket into framing", "Boards: countersunk from below", "Finish: matte poly, 3 coats"];
    hours = 5;
  } else if (cfg.type === "jig") {
    name = "Repeatable drilling jig";
    cut("Jig base", 1, Math.min(cfg.l, 450), Math.min(cfg.w, 220), 18, "Baltic birch ply", "4× Ø12 guide holes, drill on the drill press with the fence set once");
    cut("Fence", 1, Math.min(cfg.l, 450), 40, 18, "Baltic birch ply", "Glue + screw square to the base — check with a machinist square");
    cut("Clamp riser block", 2, 50, 40, 30, "Baltic birch ply", "Under each toggle clamp");
    joinery = [
      "Fence → base: glue + 4× countersunk #8×32 mm, squared before cure",
      "Toggle clamps: 2× 100 lb hold-down clamps on riser blocks, M5 machine screws + T-nuts from below",
      "Guide holes: drill Ø12 then press in Ø12→Ø8 steel drill bushings for long service life",
      "Wax the base and fence faces — workpieces slide in, clamp, drill, done",
    ];
    hours = 2;
  } else {
    name = `${sp.name} entry bench`;
    cut("Seat slab", 1, Math.min(cfg.l, 1300), cfg.w, cfg.t);
    cut("Leg slab", 2, 430, cfg.w * 0.8, cfg.t);
    cut("Center stretcher", 1, Math.round(cfg.l * 0.7), 90, Math.round(cfg.t * 0.7));
    joinery = ["Legs → seat: through wedged tenons (2 per leg)", "Stretcher: tusk tenon, walnut wedge", "Finish: oil + wax"];
    hours = 8;
  }

  const bf = cuts.filter(c => c.mat === sp.name).reduce((s, c) => s + bfOf(c.l, c.w, c.t) * c.qty, 0);
  const bfBuy = bf * 1.35;                              // waste factor
  const matWood = bfBuy * sp.bf;
  const matOther = cuts.some(c => c.mat.includes("Steel")) ? 85 : 20;
  const finish = 28;
  const materials = matWood + matOther + finish;
  const shopRate = 65;
  const price = Math.round((materials * 1.15 + hours * shopRate) / 10) * 10;

  return {
    name, species: sp, cuts, joinery, hours,
    bf: bf.toFixed(1), bfBuy: bfBuy.toFixed(1),
    matWood, matOther, finish, materials,
    price, priceStr: money(price),
    weightKg: Math.round((bf * 2360 * sp.density) / 1e6),  // bf→cm3 ≈ 2360
    cncNote: cfg.type === "jig"
      ? "Machine guidance (no toolpath file is exported): drill-press the guide holes with the fence registered; The Forge does not generate G-code."
      : "Machine guidance (no toolpath file is exported): flatten the slab with a router sled — Ø50 surfacing bit, 4 mm DOC, 18k RPM, ~40 % stepover. The Forge does not generate G-code.",
  };
}

// ---------------------------------------------------------------- repair
export const REPAIR_TYPES = {
  knob:   { name: "Appliance knob", ref: "outside diameter", material: "PETG", note: "D-shaft bore 6.05 mm printed undersize — ream to fit. Print face-down, 6 walls." },
  gear:   { name: "Gear / sprocket", ref: "outside diameter", material: "Nylon (PA12) or PETG", note: "Module approximated from tooth count — verify mesh before final print. 100% infill." },
  bracket:{ name: "L-bracket / mount", ref: "leg length", material: "PETG or ABS", note: "Print flat on its back for layer orientation across the bend. 5 walls, 40% infill." },
  hinge:  { name: "Hinge pin / barrel", ref: "pin length", material: "PETG", note: "Print pin vertically at 0.12 mm layers; barrel horizontally. Add 0.15 mm clearance." },
  clip:   { name: "Snap clip / clamp", ref: "inner diameter", material: "PETG (flexible walls)", note: "2 walls + gyroid 25% for spring action. Orient the opening upward." },
};

export function repairPlan(type, refMM) {
  const t = REPAIR_TYPES[type];
  const vol = { knob: 0.35, gear: 0.18, bracket: 0.9, hinge: 0.25, clip: 0.3 }[type] * Math.pow(refMM / 30, 2.4) * 12;
  return {
    ...t, type, refMM,
    grams: Math.max(2, Math.round(vol)),
    minutes: Math.max(8, Math.round(vol * 4.2)),
    cost: Math.max(0.05, vol * 0.023),
    steps: [
      `Measured reference: ${t.ref} = ${refMM.toFixed(1)} mm — all other features scaled from library proportions.`,
      "Compare the on-screen silhouette against the broken part; adjust the reference dimension until they match.",
      `Print in ${t.material}. ${t.note}`,
      "Test-fit before removing support (if any); a 2nd iteration at ±0.2 mm is normal.",
    ],
  };
}

// ---------------------------------------------------------------- inventor
export function conceptsOffline(problem) {
  const p = (problem || "").toLowerCase();
  const oneHand = p.includes("one hand") || p.includes("one-hand") || p.includes("single hand") || p.includes("keyboard");
  const base = oneHand ? [
    {
      name: "Radial Chord Deck",
      description: "A fanned 12-key arc where letters are typed as 2-key chords under each finger's natural arc, with a thumb trackball for pointing. One hand covers the full alphabet without travel.",
      usability: 78, cost: 88, manufacturability: 90,
      sentence: "A one-handed chording keypad with 12 arc keys, a thumb trackball and an OLED showing the active chord layer.",
    },
    {
      name: "Roller-Bar Glidepad",
      description: "A palm-length rotary bar selects columns while five keys pick rows — typing becomes roll-and-tap. Very low finger force; great for limited dexterity.",
      usability: 66, cost: 74, manufacturability: 62,
      sentence: "A one-handed input device with a large roller bar, 5 low-force keys, 1 dial and 2 foot pedals.",
    },
    {
      name: "Pedal-Shifted Half Board",
      description: "A standard half-QWERTY layout where foot pedals mirror the missing hand's side (space = mirror shift). Fastest to learn — muscle memory transfers from two-handed typing.",
      usability: 84, cost: 70, manufacturability: 85,
      sentence: "A one-handed half keyboard with 15 keys, 3 foot pedals for mirroring and modifiers, a voice button and an OLED.",
    },
  ] : [
    {
      name: "Dedicated Macro Deck",
      description: "A printed deck of mechanical keys and dials mapped to the exact workflow, with an OLED for state. The direct, robust answer.",
      usability: 82, cost: 80, manufacturability: 92,
      sentence: `A macro deck purpose-built for: ${problem}`,
    },
    {
      name: "Foot + Voice Rig",
      description: "Moves the whole interaction to three foot pedals and a push-to-talk voice key — hands never leave the primary task.",
      usability: 64, cost: 90, manufacturability: 88,
      sentence: "A pedal control hub with 3 foot pedals, a voice command button, 1 dial and no screen.",
    },
    {
      name: "Modular Magnet Tiles",
      description: "Magnetic 2-key tiles that snap around a core module, so the device is re-arranged physically per task. Highest flexibility, most parts.",
      usability: 75, cost: 55, manufacturability: 58,
      sentence: "A modular magnetic macro system with 12 keys in snap-on tiles, 2 dials and an OLED core.",
    },
  ];
  return base;
}

export function scoreConcepts(concepts, weights) {
  const wSum = Math.max(1, weights.use + weights.cost + weights.mfg);
  for (const c of concepts) {
    c.total = Math.round(
      (c.usability * weights.use + c.cost * weights.cost + c.manufacturability * weights.mfg) / wSum
    );
  }
  concepts.sort((a, b) => b.total - a.total);
  return concepts;
}
