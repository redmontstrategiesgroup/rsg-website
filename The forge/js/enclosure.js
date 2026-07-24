// ============ THE FORGE — parametric enclosure generator ============
// Enclosure Mode: ventilated project boxes, Pi control nodes, sensor
// housings, button panels. Base + lid, port cutouts, vents, fan mount,
// wall-mount keyholes, board standoffs, bottom cable gland.

import * as THREE from "three";
import { M, roundedRectPath, wallSegments, extrudeUp, box, cyl, tag, circleHole, rectHole } from "./geometry.js";

export const BOARDS = {
  none:  { name: "No board (empty)", w: 0, d: 0, holes: [] },
  pi4:   { name: "Raspberry Pi 4B", w: 85, d: 56, holes: [[3.5, 3.5], [61.5, 3.5], [3.5, 52.5], [61.5, 52.5]], insert: "M2.5", ports: ["usbc", "hdmi", "rj45", "usba"] },
  pizero:{ name: "Raspberry Pi Zero 2 W", w: 65, d: 30, holes: [[3.5, 3.5], [61.5, 3.5], [3.5, 26.5], [61.5, 26.5]], insert: "M2.5", ports: ["usbc"] },
  esp32: { name: "ESP32-S3 DevKitC", w: 25.5, d: 68, holes: [], insert: "slot", ports: ["usbc"] },
  sensor:{ name: "BME280/SHT4x sensor module", w: 16, d: 12, holes: [[2, 2], [14, 2]], insert: "M2", ports: [] },
};

export const ENCLOSURE_PRESETS = {
  pinode: {
    label: "Raspberry Pi control node (wall-mount, ventilated, fan)",
    cfg: { w: 105, d: 76, h: 40, wall: 2.4, board: "pi4", vents: true, fan: 40, wallMount: true, gland: false,
      ports: [{ type: "rj45", edge: "right", at: 0 }, { type: "usbc", edge: "rear", at: -28 }, { type: "usba", edge: "rear", at: 8 }] },
    name: "Pi Control Node Enclosure",
  },
  sensorbox: {
    label: "Weather-resistant sensor housing (gland, downward vents)",
    cfg: { w: 60, d: 48, h: 32, wall: 2.8, board: "sensor", vents: true, fan: 0, wallMount: true, gland: true, ports: [] },
    name: "Low-Voltage Sensor Housing",
  },
  panel: {
    label: "Desktop button panel shell",
    cfg: { w: 120, d: 80, h: 30, wall: 2.4, board: "esp32", vents: false, fan: 0, wallMount: false, gland: false,
      ports: [{ type: "usbc", edge: "rear", at: 0 }] },
    name: "Button Panel Enclosure",
  },
};

const PORT_SIZES = { usbc: { w: 10.5, h: 8 }, usba: { w: 14.5, h: 8 }, hdmi: { w: 16.5, h: 8 }, rj45: { w: 17, h: 14.5 }, circle: { w: 9, h: 9 } };

export function buildEnclosure(cfg) {
  const W = cfg.w + 2 * cfg.wall, D = cfg.d + 2 * cfg.wall, H = cfg.h + 3;
  const r = 4;
  const root = new THREE.Group();
  root.name = "enclosure";
  const shellMat = M.shell(), lidMat = M.plate();

  // ---------- base: floor + walls with port gaps ----------
  const gaps = (cfg.ports || []).map(p => {
    const sz = PORT_SIZES[p.type] || PORT_SIZES.circle;
    return { edge: p.edge, at: p.at, width: sz.w + 1.2, h: sz.h };
  });
  const base = new THREE.Group();
  const floorShape = roundedRectPath(null, W - 1, D - 1, r);
  if (cfg.gland) floorShape.holes.push(circleHole(0, 0, 6.3));          // M12 gland → 12.5 mm hole
  base.add(extrudeUp(floorShape, 3, shellMat));
  for (const s of wallSegments(W, D, r, cfg.wall, gaps)) base.add(extrudeUp(s, H, shellMat));
  for (const g of gaps) {                                              // lintels above ports
    const lh = H - (3 + g.h + 1);
    if (lh <= 0) continue;
    if (g.edge === "rear") base.add(box(g.width + 4, lh, cfg.wall, shellMat, g.at, 3 + g.h + 1 + lh / 2, -(D / 2 - cfg.wall / 2)));
    else {
      const sx = g.edge === "right" ? W / 2 - cfg.wall / 2 : -(W / 2 - cfg.wall / 2);
      base.add(box(cfg.wall, lh, g.width + 4, shellMat, sx, 3 + g.h + 1 + lh / 2, -g.at));
    }
  }
  // lid screw bosses
  const bx = W / 2 - 5.6, bz = D / 2 - 5.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const boss = cyl(3.6, 3.6, H - 3, shellMat, sx * bx, 3 + (H - 3) / 2, sz * bz, 24);
    base.add(boss);
  }
  // board standoffs
  const board = BOARDS[cfg.board || "none"];
  if (board?.holes?.length) {
    for (const [hx, hy] of board.holes) {
      const px = hx - board.w / 2, pz = -(hy - board.d / 2);
      base.add(cyl(3, 3.4, 6, shellMat, px, 3 + 3, pz, 20));
    }
  } else if (cfg.board === "esp32") {
    base.add(box(30, 4, 6, shellMat, 0, 5, -cfg.d / 2 + 8));
    base.add(box(30, 4, 6, shellMat, 0, 5, -cfg.d / 2 + 8 + 55));
  }
  // wall-mount keyhole tabs
  if (cfg.wallMount) {
    for (const sx of [-1, 1]) {
      const t = new THREE.Group();
      const tab = box(16, 3, 14, shellMat, 0, 1.5, 0);
      t.add(tab);
      t.position.set(sx * (W / 2 + 8), 0, 0);
      t.userData.excludeFromFit = false;
      tag(t, "Wall-mount tab (printed)", sx * 18, 0, 0);
      base.add(t);
    }
  }
  tag(base, "Enclosure base (printed)", 0, -26, 0);
  root.add(base);

  // ---------- lid: vents, fan, screws ----------
  const lidShape = roundedRectPath(null, W, D, r);
  if (cfg.vents) {
    const cols = Math.max(2, Math.floor((W - 30) / 10));
    const len = Math.min(D * 0.45, 26);
    for (let i = 0; i < cols; i++) {
      const x = -((cols - 1) * 10) / 2 + i * 10;
      if (cfg.fan && Math.abs(x) < cfg.fan / 2 + 6) continue;
      lidShape.holes.push(rectHole(x, D * 0.18, 3.2, len));
    }
  }
  if (cfg.fan) {
    lidShape.holes.push(circleHole(0, -D * 0.12, cfg.fan / 2 - 1));
    const fh = cfg.fan === 40 ? 16 : 12;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
      lidShape.holes.push(circleHole(sx * fh, -D * 0.12 + sz * fh, 1.6));
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lidShape.holes.push(circleHole(sx * bx, sz * bz, 1.7));
  const lid = new THREE.Group();
  lid.add(extrudeUp(lidShape, 2.6, lidMat, H));
  tag(lid, "Enclosure lid (printed)", 0, 30, 0);
  root.add(lid);

  // ---------- board visual ----------
  if (board?.w) {
    const b = new THREE.Group();
    b.add(box(board.w, 1.6, board.d, M.pcb(), 0, 9.8, 0));
    if (cfg.board === "pi4") {
      b.add(box(15, 2.4, 15, M.steel(), -20, 11.6, 8));
      b.add(box(21, 13, 16, M.steel(), 30, 17, -14));
    }
    tag(b, board.name, 0, 14, 0);
    root.add(b);
  }
  // fan visual
  if (cfg.fan) {
    const f = new THREE.Group();
    f.add(box(cfg.fan, 10, cfg.fan, M.switch(), 0, H - 8, D * 0.12));
    f.add(cyl(cfg.fan / 2 - 2, cfg.fan / 2 - 2, 10.5, M.pcbDark(), 0, H - 8, D * 0.12, 24));
    tag(f, `${cfg.fan} mm fan`, 0, 48, 0);
    root.add(f);
  }
  if (cfg.gland) {
    const gl = new THREE.Group();
    gl.add(cyl(7.5, 7.5, 8, M.switch(), 0, -4, 0, 24));
    gl.add(cyl(5, 5, 6, M.switch(), 0, -10, 0, 12));
    tag(gl, "M12 cable gland", 0, -22, 0);
    root.add(gl);
  }
  root.userData.enclosureDims = { W, D, H: H + 2.6 };
  return root;
}

/** Drawing plan + DXF entities for the lid (flat, laser-cuttable). */
export function enclosurePlan(cfg) {
  const W = cfg.w + 2 * cfg.wall, D = cfg.d + 2 * cfg.wall, H = cfg.h + 3 + 2.6;
  const holes = [];
  const bx = W / 2 - 5.6, bz = D / 2 - 5.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) holes.push({ x: W / 2 + sx * bx, y: D / 2 + sz * bz, r: 1.7 });
  if (cfg.fan) holes.push({ x: W / 2, y: D / 2 - (-D * 0.12), r: cfg.fan / 2 - 1 });
  if (cfg.gland) holes.push({ x: W / 2, y: D / 2, r: 6.3 });
  return {
    w: W, d: D, h: H, holes,
    notes: [
      `Base + lid, PETG, ${cfg.wall} mm walls, no supports`,
      cfg.vents ? "Vent slots 3.2 mm — face DOWN when wall-mounted outdoors" : "Sealed body (no vents)",
      BOARDS[cfg.board]?.name ? `Standoffs: ${BOARDS[cfg.board].name} (${BOARDS[cfg.board].insert || "—"})` : "No board fittings",
      cfg.wallMount ? "Keyhole tabs: 2× #8 pan-head, 16 mm apart from centreline" : "Desktop use",
      "4× M3×8 lid screws into heat-set inserts",
    ],
  };
}

export function enclosureBOM(cfg) {
  const rows = [];
  const add = (ref, name, qty, unit, supplier, url, note) => rows.push({ part: { ref, name, mpn: "-", unit, supplier, url, note }, qty, ext: unit * qty });
  add("INS", "M3×5.7 heat-set insert", 4, 0.14, "McMaster-Carr", "https://www.mcmaster.com/heat-set-inserts/", "Lid bosses");
  add("SCR", "M3×8 SHCS", 4, 0.08, "McMaster-Carr", "https://www.mcmaster.com/socket-head-screws/", "Lid");
  if (BOARDS[cfg.board]?.insert === "M2.5") add("SCR2", "M2.5×6 screw", 4, 0.09, "McMaster-Carr", "https://www.mcmaster.com/", "Board mount");
  if (cfg.fan) add("FAN", `${cfg.fan} mm 5 V fan`, 1, 4.5, "Digi-Key", "https://www.digikey.com/en/products/result?keywords=5v+" + cfg.fan + "mm+fan", "Quiet sleeve bearing");
  if (cfg.gland) add("GLD", "M12 nylon cable gland IP68", 1, 0.9, "Amazon", "https://www.amazon.com/s?k=m12+cable+gland", "Bottom entry + drip loop");
  if (cfg.wallMount) add("WS", "#8 × 32 mm pan-head wood screw", 2, 0.06, "Hardware store", "https://www.mcmaster.com/", "Into studs/anchors");
  if (cfg.board === "pi4") add("SBC", "Raspberry Pi 4B (user-supplied)", 1, 55, "rpilocator", "https://rpilocator.com/", "Existing unit OK");
  add("FIL", "PETG filament (per 100 g)", Math.max(1, Math.round((cfg.w * cfg.d * cfg.h) / 60000)), 2.3, "Prusament", "https://www.prusa3d.com/", "Base + lid");
  return rows;
}

export function enclosureDFM(cfg, printerBed = 220) {
  const W = cfg.w + 2 * cfg.wall, D = cfg.d + 2 * cfg.wall;
  const out = [];
  const rule = (id, cond, fail, pass, sev = "fail") =>
    out.push({ id, sev: cond ? "pass" : sev, area: "DFM/FDM", text: cond ? pass : fail, basis: "rule" });
  rule("wall", cfg.wall >= 1.6, `Wall ${cfg.wall} mm under 1.6 mm minimum for an enclosure`, `Wall ${cfg.wall} mm ≥ 1.6 mm`);
  rule("bed", Math.max(W, D) <= printerBed, `Enclosure ${W.toFixed(0)}×${D.toFixed(0)} exceeds the ${printerBed} mm bed`, `${W.toFixed(0)}×${D.toFixed(0)} mm fits the ${printerBed} mm bed`);
  rule("vent-bridge", !cfg.vents || true, "", "Vent slots 3.2 mm — self-bridging", "warn");
  if (cfg.fan) rule("fan-holes", true, "", `Fan pilot holes Ø3.2 for M3 self-tap (${cfg.fan} mm pattern)`, "warn");
  if (cfg.gland) rule("gland-floor", cfg.wall >= 2.4, "Floor too thin for gland torque — use ≥ 2.4 mm", "Floor thick enough for gland nut torque");
  const ports = cfg.ports || [];
  rule("port-spacing", ports.every((p, i) => ports.every((q, j) => i >= j || p.edge !== q.edge || Math.abs(p.at - q.at) >= 22)),
    "Ports on the same edge closer than 22 mm — connector bodies collide", "Port spacing ≥ 22 mm on every edge");
  return out;
}
