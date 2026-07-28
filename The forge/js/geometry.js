// ============ THE FORGE — parametric geometry ============
// Builds real, printable geometry with three.js primitives + extruded
// shapes-with-holes (no CSG dependency). Layout plan: X→x, Y(depth)→ -z, up→ +y.

import * as THREE from "three";
import { DIMS } from "./layout.js";

const M = {
  shell:   () => new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.62, metalness: 0.15 }),
  plate:   () => new THREE.MeshStandardMaterial({ color: 0x4a505b, roughness: 0.6, metalness: 0.12 }),
  keycap:  (c = 0xe8e4da) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72 }),
  switch:  () => new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 }),
  knob:    () => new THREE.MeshStandardMaterial({ color: 0x9aa2ad, roughness: 0.3, metalness: 0.9 }),
  ball:    () => new THREE.MeshStandardMaterial({ color: 0xc9463d, roughness: 0.25 }),
  pcb:     () => new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.6 }),
  pcbDark: () => new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 0.55 }),
  glass:   () => new THREE.MeshStandardMaterial({ color: 0x0a1220, roughness: 0.15, metalness: 0.4 }),
  steel:   () => new THREE.MeshStandardMaterial({ color: 0x707783, roughness: 0.35, metalness: 0.9 }),
  magnet:  () => new THREE.MeshStandardMaterial({ color: 0x51565e, roughness: 0.3, metalness: 0.85 }),
};

const D2 = Math.PI / 2;

export { M, roundedRectPath, wallSegments, extrudeUp, box, cyl, ring, tag, hardware, circleHole, rectHole };

/** Mark a mesh/group as bought hardware so it never reaches a print file. */
function hardware(obj, name) {
  obj.userData.partName = `${name} (hardware)`;
  obj.traverse?.(c => { c.userData.partName = c.userData.partName || obj.userData.partName; });
  return obj;
}

// ---------------------------------------------------------------- helpers
function roundedRectPath(target, w, d, r) {
  // returns THREE.Shape (or draws into given Path) centred at origin, in XY
  const s = target || new THREE.Shape();
  const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);           s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);       s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);           s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);               s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Dense polyline around a rounded rect perimeter (CCW, starts at rear-left). */
function roundedRectPolyline(w, d, r, step = 1.6) {
  const pts = [];
  const arc = (cx, cy, a0, a1) => {
    const n = Math.max(3, Math.ceil((Math.abs(a1 - a0) * r) / step));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
  };
  const line = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 1; i <= n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
  };
  const hw = w / 2, hd = d / 2;
  pts.push({ x: -hw + r, y: hd });
  line(-hw + r, hd, hw - r, hd);              // rear edge (y=+hd)  L→R
  arc(hw - r, hd - r, D2, 0);                 // rear-right corner
  line(hw, hd - r, hw, -hd + r);              // right edge
  arc(hw - r, -hd + r, 0, -D2);               // front-right corner
  line(hw - r, -hd, -hw + r, -hd);            // front edge
  arc(-hw + r, -hd + r, -D2, -Math.PI);       // front-left corner
  line(-hw, -hd + r, -hw, hd - r);            // left edge
  arc(-hw + r, hd - r, Math.PI, D2);          // rear-left corner
  return pts;
}

/**
 * Wall ring with gaps: returns array of THREE.Shape wall segments (plan view).
 * gaps: [{edge:'rear'|'left'|'right', at:number (coordinate along edge), width}]
 */
function wallSegments(w, d, r, wall, gaps) {
  const outer = roundedRectPolyline(w, d, r);
  const inner = roundedRectPolyline(w - 2 * wall, d - 2 * wall, Math.max(0.8, r - wall));
  // resample inner to same count as outer (index-matched)
  const innerR = resample(inner, outer.length);
  const eps = 0.9;
  const inGap = (p) => gaps.some(g => {
    if (g.edge === "rear")  return Math.abs(p.y - d / 2) < eps && Math.abs(p.x - g.at) <= g.width / 2;
    if (g.edge === "right") return Math.abs(p.x - w / 2) < eps && Math.abs(p.y - g.at) <= g.width / 2;
    if (g.edge === "left")  return Math.abs(p.x + w / 2) < eps && Math.abs(p.y - g.at) <= g.width / 2;
    return false;
  });
  const runs = [];
  let cur = null;
  for (let i = 0; i < outer.length; i++) {
    if (!inGap(outer[i])) {
      if (!cur) { cur = { o: [], n: [] }; runs.push(cur); }
      cur.o.push(outer[i]); cur.n.push(innerR[i]);
    } else cur = null;
  }
  // Uninterrupted ring → emit a true annulus (outer contour + inner contour as a
  // hole). Tracing outer-forward/inner-backward instead closes the ring with a
  // zero-width slit, whose two coincident edges are shared by four faces — a
  // non-manifold solid that renders correctly and is not a valid solid.
  if (runs.length === 1 && runs[0].o.length === outer.length) {
    const s = new THREE.Shape();
    polyInto(s, outer);
    const hole = new THREE.Path();
    polyInto(hole, innerR.slice().reverse());
    s.holes.push(hole);
    return [s];
  }
  // merge last+first run (wraps around start point) if both exist and touch
  if (runs.length > 1) {
    const a = runs[0], z = runs[runs.length - 1];
    const p0 = a.o[0], pz = z.o[z.o.length - 1];
    if (Math.hypot(p0.x - pz.x, p0.y - pz.y) < 3.5) {
      z.o.push(...a.o); z.n.push(...a.n); runs.shift();
    }
  }
  return runs
    .filter(rn => rn.o.length > 2)
    .map(rn => {
      const s = new THREE.Shape();
      polyInto(s, [...rn.o, ...rn.n.slice().reverse()]);
      return s;
    });
}

/** Trace a point list into a Shape/Path, skipping repeats (zero-length edges). */
function polyInto(target, pts) {
  let last = null;
  for (const p of pts) {
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1e-6) continue;
    last ? target.lineTo(p.x, p.y) : target.moveTo(p.x, p.y);
    last = p;
  }
  target.closePath();
  return target;
}

/** Annulus in plan view (outer circle with a concentric bore). */
function ring(cx, cy, rOut, rIn, seg = 32) {
  const s = new THREE.Shape();
  s.absarc(cx, cy, rOut, 0, Math.PI * 2, false);
  s.holes.push(circleHole(cx, cy, rIn));
  s.curveSegments = seg;
  return s;
}

function resample(pts, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * (pts.length - 1);
    const i0 = Math.floor(t), i1 = Math.min(pts.length - 1, i0 + 1), f = t - i0;
    out.push({ x: pts[i0].x + (pts[i1].x - pts[i0].x) * f, y: pts[i0].y + (pts[i1].y - pts[i0].y) * f });
  }
  return out;
}

/** Extrude a plan-view shape upward (XY plan → XZ world, +y up). */
function extrudeUp(shape, h, mat, y0 = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 20 });
  g.rotateX(-D2);              // plan Y → world -z, extrusion → +y
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.y = y0;        // body occupies y0 … y0+h
  return mesh;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); return m;
}

function tag(obj, name, ex, ey, ez) {
  obj.userData.explode = new THREE.Vector3(ex, ey, ez);
  obj.userData.partName = name;
  obj.traverse?.(c => { c.userData.partName = c.userData.partName || name; });
  return obj;
}

// ---------------------------------------------------------------- deck model
export function buildDeckModel(spec) {
  const { deck, parts, jacks, usb } = spec.derived;
  const G = spec.geometry;
  const root = new THREE.Group();
  root.name = "deck";
  const plateY = deck.h;                       // top of walls / underside of plate
  const P = DIMS;

  // ---------- bottom shell ----------
  const shell = new THREE.Group(); shell.name = "shell";
  const gaps = [];
  gaps.push({ edge: usb.edge === "rear" ? "rear" : "right", at: usb.x, width: 13 });
  for (const j of jacks) {
    gaps.push(j.edge === "rear"
      ? { edge: "rear", at: j.x, width: 8 }
      : { edge: j.x > 0 ? "right" : "left", at: j.y, width: 8 });
  }
  const segs = wallSegments(deck.w, deck.d, deck.r, G.wallMM, gaps);
  const shellMat = M.shell();
  for (const s of segs) shell.add(extrudeUp(s, deck.h, shellMat));

  // ---------- floor ----------
  // Deliberately 0.6 mm inside the outer face so it interpenetrates the wall
  // rather than sharing a face with it: coincident faces are ambiguous to
  // boolean and mesh tooling, a real overlap is not.
  const magnets = !!spec.modules.magnets;
  const floorW = deck.w - 1.2, floorD = deck.d - 1.2, floorR = Math.max(1, deck.r - 0.6);
  const floorH = magnets ? 1.2 + P.MAGNET_H : 3;      // base + pocket layer
  const magnetPts = [];
  if (magnets) {
    const mx = deck.w / 2 - 9, mz = deck.d / 2 - 9;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      magnetPts.push([sx * mx, sz * mz], [sx * (mx - 12), sz * mz]);
    }
  }
  if (magnets) {
    // solid base 0…1.2 plus a pocketed layer starting 0.4 mm lower, so the two
    // layers interpenetrate instead of meeting on a shared plane. The pocket
    // floor is the base's top face at 1.2 → MAGNET_H deep, flush at the top.
    shell.add(extrudeUp(roundedRectPath(null, floorW, floorD, floorR), 1.2, shellMat));
    const pocketLayer = roundedRectPath(null, floorW, floorD, floorR);
    for (const [px, pz] of magnetPts)
      pocketLayer.holes.push(circleHole(px, -pz, (P.MAGNET_D + P.MAGNET_FIT) / 2));
    shell.add(extrudeUp(pocketLayer, P.MAGNET_H + 0.4, shellMat, 0.8));
  } else {
    shell.add(extrudeUp(roundedRectPath(null, floorW, floorD, floorR), 3, shellMat));
  }
  // lintels over each gap (close the wall above the opening)
  const lintelH = deck.h - 11.5;
  for (const g of gaps) {
    if (lintelH <= 0) continue;
    if (g.edge === "rear")
      shell.add(box(g.width + 4, lintelH, G.wallMM, shellMat, g.at, 11.5 + lintelH / 2, -(deck.d / 2 - G.wallMM / 2)));
    else {
      const sx = g.edge === "right" ? deck.w / 2 - G.wallMM / 2 : -(deck.w / 2 - G.wallMM / 2);
      shell.add(box(G.wallMM, lintelH, g.width + 4, shellMat, sx, 11.5 + lintelH / 2, -g.at));
    }
  }
  // USB reinforcement ribs (Rev-2 style fix)
  if (G.usbRibs) {
    const zWall = -(deck.d / 2 - G.wallMM);
    shell.add(box(2.4, deck.h - 4, 12, shellMat, usb.x - 10, (deck.h - 4) / 2 + 3, zWall + 6));
    shell.add(box(2.4, deck.h - 4, 12, shellMat, usb.x + 10, (deck.h - 4) / 2 + 3, zWall + 6));
  }
  // insert bosses under each plate screw — the assembly manual tells the builder
  // to press heat-set inserts into these, so they have to exist in the print.
  // 5.4 mm in from the edge so the Ø7.2 boss overlaps the wall by 0.6 mm
  // instead of standing tangent to it, and it starts 0.8 mm below the floor
  // top so the two fuse rather than meet face-to-face.
  const screwPts = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]]
    .map(([ax, az]) => [ax * (deck.w / 2 - 5.4), az * (deck.d / 2 - 5.4)]);
  if (!G.snapFit) {
    for (const [bx, bz] of screwPts)
      shell.add(extrudeUp(ring(bx, -bz, P.BOSS_OD / 2, P.BOSS_BORE / 2, 24), deck.h - floorH + 0.8, shellMat, floorH - 0.8));
  }
  tag(shell, "Bottom shell (printed)", 0, -34, 0);
  root.add(shell);

  // magnets are bought parts sitting in the printed pockets, not printed solids
  if (magnets) {
    for (const [px, pz] of magnetPts)
      root.add(hardware(cyl(P.MAGNET_D / 2, P.MAGNET_D / 2, P.MAGNET_H, M.magnet(), px, 1.2 + P.MAGNET_H / 2, pz), "N52 magnet"));
  }

  // ---------- top plate with cutouts ----------
  const plateShape = roundedRectPath(null, deck.w, deck.d, deck.r);
  for (const p of parts) {
    if (p.type === "key") plateShape.holes.push(squareHole(p.x, p.y, P.PLATE_CUTOUT, p.rot));
    else if (p.type === "encoder") plateShape.holes.push(circleHole(p.x, p.y, 3.6));
    else if (p.type === "trackball") plateShape.holes.push(circleHole(p.x, p.y, p.d / 2 - 1.5));
    else if (p.type === "oled") plateShape.holes.push(rectHole(p.x, p.y, DIMS.OLED_W - 2, 14));
  }
  const plate = extrudeUp(plateShape, G.plateMM, M.plate(), plateY);
  const plateG = new THREE.Group(); plateG.name = "plate"; plateG.add(plate);
  tag(plateG, "Switch plate (printed)", 0, 34, 0);
  root.add(plateG);
  // screw heads are bought hardware — tagged after the plate so tag() can't
  // inherit "(printed)" onto them and push steel into print.stl
  if (!G.snapFit) {
    for (const [bx, bz] of screwPts)
      root.add(hardware(cyl(1.9, 1.9, 1.6, M.steel(), bx, plateY + G.plateMM, bz), "M3×8 screw"));
  }

  // ---------- main PCB under plate ----------
  // inset to clear the Ø7.2 insert bosses standing at 6 mm from each edge
  const pcb = box(deck.w - 24, 1.6, deck.d - 30, M.pcb(), 0, plateY - 7, 2);
  tag(pcb, "Main PCB (2-layer)", 0, 14, 0);
  root.add(pcb);

  // ---------- MCU dev board ----------
  const mcu = new THREE.Group();
  mcu.add(box(26, 1.6, 52, M.pcbDark(), 0, 0, 0));
  mcu.add(box(15, 3, 17, M.steel(), 0, 2, -14));                 // RF can
  mcu.add(box(9, 3.2, 7.4, M.steel(), 0, 2, 24));                // USB-C
  mcu.position.set(usb.x, 8, -(deck.d / 2) + 30);
  tag(mcu, "ESP32-S3 DevKitC", 0, 6, 26);
  root.add(mcu);

  // ---------- per-part components ----------
  for (const p of parts) {
    if (p.type === "key") {
      const g = new THREE.Group();
      g.add(box(13.8, 9, 13.8, M.switch(), 0, plateY - 3, 0));   // switch body through plate
      const capMat = p.voice ? M.keycap(0xff7a1a) : p.kvm ? M.keycap(0x59636f) : M.keycap();
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(11.3, 12.7, 7.6, 4, 1), capMat);
      cap.rotation.y = Math.PI / 4 + (p.rot * Math.PI) / 180;
      cap.position.set(0, plateY + G.plateMM + 4.8, 0);
      g.add(cap);
      g.position.set(p.x, 0, -p.y);
      g.rotation.y = 0;
      tag(g, p.voice ? "Voice key" : p.kvm ? `KVM key ${p.label}` : `Key ${p.label}`, 0, 58 + (p.mr ?? 0) * 4, 0);
      root.add(g);
    } else if (p.type === "encoder") {
      const g = new THREE.Group();
      g.add(box(DIMS.ENC_BODY, 6.5, DIMS.ENC_BODY, M.switch(), 0, plateY - 3, 0));
      g.add(cyl(3.4, 3.4, 7, M.steel(), 0, plateY + G.plateMM + 2, 0));           // bushing+shaft
      const knob = cyl(DIMS.KNOB_D / 2, DIMS.KNOB_D / 2, 13, M.knob(), 0, plateY + G.plateMM + 10, 0, 48);
      g.add(knob);
      g.add(cyl(DIMS.KNOB_D / 2 - 1.5, DIMS.KNOB_D / 2 - 1.5, 1.2, M.switch(), 0, plateY + G.plateMM + 16.7, 0, 48));
      g.position.set(p.x, 0, -p.y);
      tag(g, `Rotary dial ${p.label}`, 0, 66, 0);
      root.add(g);
    } else if (p.type === "trackball") {
      const g = new THREE.Group();
      const bezel = new THREE.Mesh(new THREE.CylinderGeometry(p.d / 2 + 5, p.d / 2 + 7, 6, 48, 1, true), M.plate());
      bezel.position.y = plateY + G.plateMM + 1;
      g.add(bezel);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(p.d / 2, 40, 28), M.ball());
      ball.position.y = plateY + G.plateMM + p.d / 2 - 6;
      g.add(ball);
      g.add(box(21, 1.6, 21, M.pcb(), 0, plateY - 9, 0));        // PIM447 breakout
      g.position.set(p.x, 0, -p.y);
      tag(g, "Thumb trackball (PIM447)", 0, 62, 0);
      root.add(g);
    } else if (p.type === "oled") {
      const g = new THREE.Group();
      g.add(box(DIMS.OLED_W, 1.6, DIMS.OLED_H, M.pcbDark(), 0, plateY + G.plateMM - 2.4, 0));
      const scr = box(24, 0.8, 13, M.glass(), 0, plateY + G.plateMM + 0.28, 0);
      scr.material = oledMaterial(spec);
      g.add(scr);
      g.position.set(p.x, 0, -p.y);
      tag(g, "OLED status screen", 0, 50, 0);
      root.add(g);
    }
  }

  // ---------- jacks ----------
  for (const j of jacks) {
    const g = new THREE.Group();
    const c = cyl(3, 3, 7, M.switch(), 0, 0, 0);
    c.rotation.x = D2;
    g.add(c);
    g.add(cyl(3.6, 3.6, 1.6, M.steel(), 0, 0, j.edge === "rear" ? -3 : 0));
    if (j.edge === "rear") g.position.set(j.x, 8, -(deck.d / 2) - 1);
    else { c.rotation.set(0, 0, D2); g.position.set(j.x > 0 ? deck.w / 2 + 1 : -deck.w / 2 - 1, 8, -j.y); }
    tag(g, `Pedal jack ${j.label}`, j.edge === "rear" ? 0 : (j.x > 0 ? 22 : -22), 0, j.edge === "rear" ? -22 : 0);
    root.add(g);
  }

  // ---------- external foot pedals (accessory, shown beside deck) ----------
  if (spec.modules.pedals.count > 0) {
    for (let i = 0; i < spec.modules.pedals.count; i++) {
      const ped = new THREE.Group();
      const base = box(46, 10, 62, M.shell(), 0, 5, 0);
      const top = box(42, 6, 46, M.keycap(0x3a4049), 0, 14, -4);
      top.rotation.x = -0.13;
      ped.add(base, top);
      ped.position.set(deck.w / 2 + 46 + i * 56, 0, deck.d / 2 + 10);
      ped.userData.excludeFromFit = true;
      tag(ped, `Foot pedal ${i + 1}`, 26 + i * 8, 0, 30);
      root.add(ped);
    }
  }

  // ---------- concept accessories: pedal pod / desk clamp ----------
  if (spec.podPart && spec.modules.pedals.count > 0) {
    const pod = new THREE.Group();
    pod.add(box(70, 16, 44, M.shell(), 0, 8, 0));
    for (let i = 0; i < spec.modules.pedals.count; i++) {
      const jc = cyl(3.6, 3.6, 4, M.steel(), -22 + i * 18, 8, 23);
      jc.rotation.x = D2;
      pod.add(jc);
    }
    pod.position.set(-deck.w / 2 - 60, 0, deck.d / 2 + 26);
    pod.userData.excludeFromFit = true;
    tag(pod, "Pedal pod (printed)", -30, 0, 30);
    root.add(pod);
  }
  if (spec.clampMount) {
    const clamp = new THREE.Group();
    clamp.add(box(60, 6, 46, M.shell(), 0, -3, 0));                       // upper jaw under deck
    clamp.add(box(60, 42, 6, M.shell(), 0, -24, -20));                    // back drop
    clamp.add(box(60, 6, 30, M.shell(), 0, -45, -8));                     // lower jaw
    clamp.add(cyl(4, 4, 12, M.steel(), 0, -38, 0, 20));                   // clamp screw
    clamp.position.set(0, 0, -(deck.d / 2) + 26);
    tag(clamp, "Desk clamp (printed)", 0, -52, 0);
    root.add(clamp);
  }

  // drop everything so deck sits on origin ground
  root.position.y = 0;
  return root;
}

function squareHole(cx, cy, size, rotDeg) {
  const p = new THREE.Path();
  const a = (rotDeg * Math.PI) / 180, h = size / 2;
  const pts = [[-h, -h], [h, -h], [h, h], [-h, h]].map(([x, y]) => [
    cx + x * Math.cos(a) - y * Math.sin(a),
    cy + x * Math.sin(a) + y * Math.cos(a),
  ]);
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < 4; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
  return p;
}
function circleHole(cx, cy, r) {
  const p = new THREE.Path();
  p.absarc(cx, cy, r, 0, Math.PI * 2, true);
  return p;
}
function rectHole(cx, cy, w, h) {
  const p = new THREE.Path();
  p.moveTo(cx - w / 2, cy - h / 2); p.lineTo(cx + w / 2, cy - h / 2);
  p.lineTo(cx + w / 2, cy + h / 2); p.lineTo(cx - w / 2, cy + h / 2);
  p.closePath();
  return p;
}

function oledMaterial(spec) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#050910"; x.fillRect(0, 0, 256, 128);
  x.fillStyle = "#9fd8ff"; x.font = "bold 30px monospace";
  x.fillText("FORGE v" + spec.rev, 12, 44);
  x.fillStyle = "#ffb143"; x.font = "22px monospace";
  x.fillText("PROFILE: " + (spec.profiles?.[1] || "coding").toUpperCase(), 12, 84);
  x.fillStyle = "#4a5a70"; x.fillText("PC1 ● PC2 ○", 12, 114);
  const t = new THREE.CanvasTexture(c);
  return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.3 });
}

// ---------------------------------------------------------------- repair parts
export function buildRepairPart(type, dims) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.55 });
  if (type === "knob") {
    const r = dims.ref / 2;
    const outer = new THREE.Shape();
    const knurls = 24;
    for (let i = 0; i <= knurls * 4; i++) {
      const a = (i / (knurls * 4)) * Math.PI * 2;
      const rr = r * (1 + 0.045 * Math.sin(a * knurls));
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? outer.moveTo(px, py) : outer.lineTo(px, py);
    }
    outer.closePath();
    outer.holes.push(dShaftHole(0, 0, 3.05, 2.4));
    g.add(extrudeUp(outer, dims.ref * 0.55, mat));
    g.add(cyl(r * 1.18, r * 1.18, 2.5, mat, 0, 1.25, 0, 48));
  } else if (type === "gear") {
    const teeth = Math.max(8, Math.round(dims.ref / 3));
    const rOut = dims.ref / 2, rRoot = rOut * 0.82;
    const s = new THREE.Shape();
    for (let t = 0; t < teeth; t++) {
      const a0 = (t / teeth) * Math.PI * 2;
      const seg = (Math.PI * 2) / teeth;
      const pts = [
        [rRoot, a0], [rRoot, a0 + seg * 0.18], [rOut, a0 + seg * 0.3],
        [rOut, a0 + seg * 0.55], [rRoot, a0 + seg * 0.67], [rRoot, a0 + seg],
      ];
      for (const [rr, aa] of pts) {
        const px = Math.cos(aa) * rr, py = Math.sin(aa) * rr;
        t === 0 && rr === pts[0][0] && aa === a0 ? s.moveTo(px, py) : s.lineTo(px, py);
      }
    }
    s.closePath();
    s.holes.push(circleHole(0, 0, Math.max(2, rOut * 0.18)));
    g.add(extrudeUp(s, Math.max(4, dims.ref * 0.2), mat));
  } else if (type === "bracket") {
    // leg must stay thicker than the Ø4.2 hole plus two perimeters each side,
    // or the hole breaks the outline and the part is no longer a closed solid
    const L = dims.ref, t = Math.max(4.2 + 1.6, L * 0.12);
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(L, 0); s.lineTo(L, t); s.lineTo(t, t); s.lineTo(t, L); s.lineTo(0, L); s.closePath();
    s.holes.push(circleHole(L * 0.65, t / 2, 2.1));
    s.holes.push(circleHole(t / 2, L * 0.65, 2.1));
    const m = extrudeUp(s, L * 0.5, mat);
    m.position.x = -L / 2; m.position.z = L * 0.25;
    m.rotation.x = 0;
    g.add(m);
  } else if (type === "hinge") {
    const L = dims.ref;
    g.add(cyl(L * 0.1, L * 0.1, L, mat, 0, L / 2, 0));                       // pin
    const barrel = cyl(L * 0.2, L * 0.2, L * 0.42, mat, L * 0.45, L * 0.21, 0);
    g.add(barrel);
    g.add(box(L * 0.5, L * 0.42, L * 0.08, mat, L * 0.62, L * 0.21, 0));
  } else { // clip
    const r = dims.ref / 2;
    const s = new THREE.Shape();
    s.absarc(0, 0, r + 3, Math.PI * 0.15, Math.PI * 1.85, false);
    const inn = new THREE.Path();
    inn.absarc(0, 0, r, Math.PI * 1.85, Math.PI * 0.15, true);
    s.holes.push(inn);
    g.add(extrudeUp(s, Math.max(6, r * 0.6), mat));
  }
  return g;
}
function dShaftHole(cx, cy, r, flat) {
  const p = new THREE.Path();
  const aF = Math.acos(flat / r);
  p.absarc(cx, cy, r, -aF, aF, false);       // round part
  p.lineTo(cx + flat, cy - Math.sin(aF) * r);
  p.closePath();
  return p;
}

// ---------------------------------------------------------------- woodworking
export function buildWoodModel(cfg, woodColor) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.68 });
  const steel = M.steel();
  const L = cfg.l, W = cfg.w, T = cfg.t;
  const liveEdgeTop = () => {
    const s = new THREE.Shape();
    s.moveTo(-L / 2, -W / 2);
    s.lineTo(L / 2, -W / 2);
    s.lineTo(L / 2, W / 2 - 25);
    // wavy live edge along the back
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const x = L / 2 - (L * i) / n;
      const y = W / 2 - 25 + Math.sin(i * 1.7 + 0.8) * 16 + Math.sin(i * 0.55) * 9 + 12;
      s.lineTo(x, y);
    }
    s.closePath();
    const top = extrudeUp(s, T, wood);
    return top;
  };
  if (cfg.type === "desk" || cfg.type === "table") {
    const h = cfg.type === "desk" ? 740 : 440;
    const top = liveEdgeTop(); top.position.y = h; tag(top, "Slab top", 0, 260, 0);
    g.add(top);
    for (const sxn of [-1, 1]) {
      const leg = new THREE.Group();
      const lx = sxn * (L / 2 - 180);
      leg.add(box(60, 8, W * 0.72, steel, lx, h - T - 4, 0));
      leg.add(box(8, h - T, 60, steel, lx - 26, (h - T) / 2, -(W * 0.30)));
      leg.add(box(8, h - T, 60, steel, lx + 26, (h - T) / 2, -(W * 0.30)));
      leg.add(box(8, h - T, 60, steel, lx - 26, (h - T) / 2, W * 0.30));
      leg.add(box(8, h - T, 60, steel, lx + 26, (h - T) / 2, W * 0.30));
      leg.add(box(60, 8, W * 0.72, steel, lx, 6, 0));
      tag(leg, sxn < 0 ? "Left leg frame" : "Right leg frame", sxn * 200, 0, 0);
      g.add(leg);
    }
    const str = box(L * 0.62, 60, 20, wood, 0, 200, 0);
    tag(str, "Stretcher", 0, 0, -180);
    g.add(str);
  } else if (cfg.type === "shelf") {
    for (let i = 0; i < 3; i++) {
      const sh = box(L * 0.6, T * 0.6, W * 0.4, wood, 0, 350 + i * 330, 0);
      tag(sh, `Shelf board ${i + 1}`, 0, i * 40 + 40, 120 + i * 30);
      g.add(sh);
      for (const sxn of [-1, 1]) {
        const bk = box(10, 90, W * 0.36, steel, sxn * (L * 0.24), 310 + i * 330, 0);
        tag(bk, "Bracket", sxn * 60, 0, 0);
        g.add(bk);
      }
    }
  } else if (cfg.type === "jig") {
    // drilling/routing jig: base board + fence + toggle-clamp blocks + guide holes
    const baseS = new THREE.Shape();
    const L = Math.min(cfg.l, 450), W2 = Math.min(cfg.w, 220);
    baseS.moveTo(-L / 2, -W2 / 2); baseS.lineTo(L / 2, -W2 / 2); baseS.lineTo(L / 2, W2 / 2); baseS.lineTo(-L / 2, W2 / 2); baseS.closePath();
    for (let i = 0; i < 4; i++) {
      const hp = new THREE.Path();
      hp.absarc(-L / 2 + 60 + i * ((L - 120) / 3), W2 / 2 - 40, 6, 0, Math.PI * 2, true);
      baseS.holes.push(hp);
    }
    const base = extrudeUp(baseS, 18, wood);
    tag(base, "Jig base (guide holes)", 0, 120, 0);
    g.add(base);
    const fence = box(L, 40, 18, wood, 0, 29, W2 / 2 - 9);
    tag(fence, "Fence", 0, 60, 60);
    g.add(fence);
    for (const sxn of [-1, 1]) {
      const cl = box(50, 30, 40, steel, sxn * (L / 2 - 60), 45, -W2 / 4);
      tag(cl, "Toggle clamp", sxn * 60, 40, 0);
      g.add(cl);
    }
  } else { // bench
    const top = liveEdgeTop(); top.position.y = 450; tag(top, "Seat slab", 0, 200, 0);
    g.add(top);
    for (const sxn of [-1, 1]) {
      const leg = box(T, 450 - T, W * 0.8, wood, sxn * (L / 2 - 150), (450 - T) / 2, 0);
      tag(leg, sxn < 0 ? "Left leg slab" : "Right leg slab", sxn * 180, 0, 0);
      g.add(leg);
    }
    const str = box(L * 0.7, 90, T * 0.7, wood, 0, 260, 0);
    tag(str, "Center stretcher", 0, 0, -160);
    g.add(str);
  }
  g.scale.setScalar(0.14);      // wood pieces are huge vs deck; scale for viewer
  g.userData.realScale = 1 / 0.14;
  return g;
}
