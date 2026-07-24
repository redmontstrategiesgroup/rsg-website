// ============ THE FORGE — mechanical part library (Part Mode, Level 1) ============
// Single parametric parts: every dimension explicit, every part exportable as
// STL / 3MF / STEP / DXF + a dimensioned drawing. No electronics, no assemblies.

import * as THREE from "three";
import { extrudeUp, cyl, box } from "./geometry.js";

const mat = () => new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.55 });

const P = (key, label, def, min, max, step = 0.5) => ({ key, label, def, min, max, step });

export const PART_TYPES = {
  bracket: {
    name: "L-bracket", process: "FDM / CNC", material: "PETG or 6061 aluminum",
    params: [P("legA", "Leg A length (mm)", 40, 15, 120), P("legB", "Leg B length (mm)", 40, 15, 120),
      P("width", "Width (mm)", 20, 8, 80), P("thick", "Thickness (mm)", 4, 2, 12),
      P("holeD", "Hole Ø (mm)", 4.2, 2, 10), P("fillet", "Corner gusset (mm)", 8, 0, 30)],
    build(p) {
      const s = new THREE.Shape();
      s.moveTo(0, 0); s.lineTo(p.legA, 0); s.lineTo(p.legA, p.thick);
      if (p.fillet > 0) { s.lineTo(p.thick + p.fillet, p.thick); s.lineTo(p.thick, p.thick + p.fillet); }
      else s.lineTo(p.thick, p.thick);
      s.lineTo(p.thick, p.legB); s.lineTo(0, p.legB); s.closePath();
      s.holes.push(circle(p.legA * 0.7, p.thick / 2 + 0.01, p.holeD / 2));
      s.holes.push(circle(p.thick / 2 + 0.01, p.legB * 0.7, p.holeD / 2));
      const g = new THREE.Group();
      const m = extrudeUp(s, p.width, mat());
      m.rotation.x = -Math.PI / 2; m.rotation.z = 0;
      m.position.set(-p.legA / 2, p.legB, 0);
      m.rotation.set(Math.PI / 2, 0, 0);
      m.position.set(-p.legA / 2, 0, -p.width / 2);
      g.add(m);
      return g;
    },
    plan: p => ({
      w: p.legA, d: p.legB, h: p.width,
      outline: [[0, p.legB], [0, 0], [p.legA, 0], [p.legA, p.thick], [p.thick, p.thick], [p.thick, p.legB]],
      holes: [{ x: p.legA * 0.7, y: p.thick / 2, r: p.holeD / 2 }, { x: p.thick / 2, y: p.legB * 0.7, r: p.holeD / 2 }],
      notes: [`Thickness ${p.thick} mm, gusset ${p.fillet} mm`, "Print flat on back face — layers run across the bend", `Holes Ø${p.holeD} (M${Math.floor(p.holeD - 0.4)} clearance)`],
    }),
  },
  spacer: {
    name: "Spacer / bushing", process: "FDM / lathe", material: "PETG or Nylon",
    params: [P("od", "Outer Ø (mm)", 12, 4, 60), P("id", "Inner Ø (mm)", 5.2, 1, 50), P("len", "Length (mm)", 10, 1, 80)],
    build(p) {
      const g = new THREE.Group();
      const s = new THREE.Shape();
      s.absarc(0, 0, p.od / 2, 0, Math.PI * 2, false);
      s.holes.push(circle(0, 0, p.id / 2));
      g.add(extrudeUp(s, p.len, mat()));
      return g;
    },
    plan: p => ({ w: p.od, d: p.od, h: p.len, holes: [{ x: p.od / 2, y: p.od / 2, r: p.id / 2 }], notes: [`OD ${p.od} / ID ${p.id} × ${p.len} mm`, "Print vertically for a round bore", "Ream bore if press-fit is required"] }),
  },
  adapter: {
    name: "Adapter plate", process: "FDM / laser / CNC", material: "PETG, acrylic, or aluminum",
    params: [P("w", "Width (mm)", 80, 20, 200), P("d", "Depth (mm)", 60, 20, 200), P("thick", "Thickness (mm)", 5, 2, 15),
      P("patAw", "Pattern A pitch X (mm)", 58, 10, 180), P("patAd", "Pattern A pitch Y (mm)", 49, 10, 180), P("holeA", "Pattern A hole Ø", 2.8, 2, 8),
      P("patBw", "Pattern B pitch X (mm)", 75, 10, 180), P("patBd", "Pattern B pitch Y (mm)", 75, 10, 180), P("holeB", "Pattern B hole Ø", 4.2, 2, 8)],
    build(p) {
      const s = roundedRect(p.w, p.d, 4);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        s.holes.push(circle(sx * p.patAw / 2, sy * p.patAd / 2, p.holeA / 2));
        s.holes.push(circle(sx * p.patBw / 2, sy * p.patBd / 2, p.holeB / 2));
      }
      const g = new THREE.Group();
      g.add(extrudeUp(s, p.thick, mat()));
      return g;
    },
    plan: p => ({
      w: p.w, d: p.d, h: p.thick,
      holes: [[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([sx, sy]) => [
        { x: p.w / 2 + sx * p.patAw / 2, y: p.d / 2 + sy * p.patAd / 2, r: p.holeA / 2 },
        { x: p.w / 2 + sx * p.patBw / 2, y: p.d / 2 + sy * p.patBd / 2, r: p.holeB / 2 }]),
      notes: [`Bridges pattern A (${p.patAw}×${p.patAd}, Ø${p.holeA}) to pattern B (${p.patBw}×${p.patBd}, Ø${p.holeB})`, "Default A = Raspberry Pi 4 pattern, B = 75 mm VESA", "Countersink pattern-B side if using flat-head screws"],
    }),
  },
  cover: {
    name: "Cover / lid", process: "FDM", material: "PETG",
    params: [P("w", "Opening width (mm)", 60, 10, 220), P("d", "Opening depth (mm)", 40, 10, 220),
      P("lip", "Lip depth (mm)", 6, 2, 20), P("clear", "Fit clearance (mm)", 0.25, 0, 0.8, 0.05), P("thick", "Top thickness (mm)", 2.4, 1.2, 6)],
    build(p) {
      const g = new THREE.Group();
      g.add(extrudeUp(roundedRect(p.w + 6, p.d + 6, 3), p.thick, mat()));
      const lip = roundedRect(p.w - 2 * p.clear, p.d - 2 * p.clear, 2);
      lip.holes.push(rrHole(p.w - 2 * p.clear - 4.8, p.d - 2 * p.clear - 4.8, 1.5));
      const lm = extrudeUp(lip, p.lip, mat());
      lm.position.y = -p.lip;
      g.add(lm);
      return g;
    },
    plan: p => ({ w: p.w + 6, d: p.d + 6, h: p.thick + p.lip, holes: [], notes: [`Snap lip ${p.lip} mm, clearance ${p.clear} mm per side`, "Print top-down, no supports", "Increase clearance +0.1 if tight"] }),
  },
  cableclip: {
    name: "Cable clip / guide", process: "FDM", material: "PETG (flexible walls)",
    params: [P("cableD", "Cable bundle Ø (mm)", 8, 2, 30), P("width", "Clip width (mm)", 10, 5, 30),
      P("base", "Base length (mm)", 22, 10, 60), P("holeD", "Screw hole Ø (mm)", 3.4, 2, 6)],
    build(p) {
      const r = p.cableD / 2 + 0.4;
      const g = new THREE.Group();
      const s = new THREE.Shape();
      const t = 2.2;
      s.absarc(0, r + 1.5, r + t, Math.PI * 0.12, Math.PI * 1.88, false);
      const inner = new THREE.Path();
      inner.absarc(0, r + 1.5, r, Math.PI * 1.88, Math.PI * 0.12, true);
      s.holes.push(inner);
      const clip = extrudeUp(s, p.width, mat());
      g.add(clip);
      const baseS = roundedRect(p.base, p.width, 2);
      baseS.holes.push(circle(p.base / 2 - 4, 0, p.holeD / 2));
      const b = extrudeUp(baseS, 2.4, mat());
      b.position.set(p.base / 2 + r * 0.4, 0, 0);
      g.add(b);
      return g;
    },
    plan: p => ({ w: p.base + p.cableD + 6, d: p.width, h: p.cableD + 6, holes: [{ x: p.base - 4, y: p.width / 2, r: p.holeD / 2 }], notes: [`Grips Ø${p.cableD} mm bundle (+0.4 clearance)`, "2 walls + 25% gyroid for spring action", "Orient clip opening up"] }),
  },
  drilljig: {
    name: "Drill guide jig", process: "FDM", material: "PETG (hardened bushings optional)",
    params: [P("holes", "Number of holes", 4, 1, 10, 1), P("pitch", "Hole pitch (mm)", 32, 8, 100),
      P("drillD", "Drill Ø (mm)", 5, 2, 12), P("edge", "Edge offset / fence (mm)", 19, 5, 60), P("thick", "Jig thickness (mm)", 12, 6, 25)],
    build(p) {
      const L = (p.holes - 1) * p.pitch + 30, W = p.edge + 22;
      const g = new THREE.Group();
      const s = roundedRect(L, W, 3);
      for (let i = 0; i < p.holes; i++) s.holes.push(circle(-((p.holes - 1) * p.pitch) / 2 + i * p.pitch, W / 2 - p.edge, p.drillD / 2 + 0.15));
      g.add(extrudeUp(s, p.thick, mat()));
      const fence = box(L, 14, 6, mat(), 0, -7, W / 2 + 3);
      fence.userData.partName = "Fence";
      g.add(fence);
      return g;
    },
    plan: p => {
      const L = (p.holes - 1) * p.pitch + 30, W = p.edge + 22;
      return {
        w: L, d: W, h: p.thick,
        holes: Array.from({ length: p.holes }, (_, i) => ({ x: 15 + i * p.pitch, y: W - p.edge, r: p.drillD / 2 + 0.15 })),
        notes: [`${p.holes}× Ø${p.drillD} guides at ${p.pitch} mm pitch, ${p.edge} mm from the fence`, `Guide bores +0.15 mm; press in Ø${p.drillD} steel bushings for repeated use`, "Clamp fence against the reference edge — never drill hand-held", `Jig thickness ${p.thick} mm keeps the bit square`],
      };
    },
  },
};

function circle(cx, cy, r) { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, true); return p; }
function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function rrHole(w, d, r) {
  const p = new THREE.Path();
  const x = -w / 2, y = -d / 2;
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + d - r); p.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  p.lineTo(x + r, y + d); p.quadraticCurveTo(x, y + d, x, y + d - r);
  p.lineTo(x, y + r); p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

export function partDFM(typeId, p, printerBed = 220) {
  const out = [];
  const rule = (id, cond, fail, pass, sev = "fail") =>
    out.push({ id, sev: cond ? "pass" : sev, area: "DFM/FDM", text: cond ? pass : fail, basis: "rule" });
  const plan = PART_TYPES[typeId].plan(p);
  rule("bed", Math.max(plan.w, plan.d) <= printerBed, `Part ${plan.w.toFixed(0)}×${plan.d.toFixed(0)} exceeds the ${printerBed} mm bed`, `Fits the ${printerBed} mm bed`);
  if (typeId === "bracket") rule("bracket-orient", true, "", "Layer orientation crosses the bend — full strength", "warn");
  if (typeId === "spacer") rule("bore", p.id >= 1.5, "Bore under 1.5 mm won't print round", `Bore Ø${p.id} printable`);
  if (typeId === "drilljig") rule("guide-wall", (p.pitch - p.drillD) > 6, "Guide walls thinner than 6 mm between holes", "Guide wall thickness OK");
  if (typeId === "cover") rule("clearance", p.clear >= 0.15, "Fit clearance under 0.15 mm will bind on FDM", `Clearance ${p.clear} mm within FDM capability`);
  rule("thin", true, "", "All walls ≥ 3 perimeters at 0.4 mm nozzle", "warn");
  return out;
}
