// ============ THE FORGE — ergonomic layout engine ============
// Turns spec.ability + spec.modules into physical component placements (mm).
// The key fan is generated around a wrist pivot: each usable finger gets a
// column of keys along its natural arc; reach sets the radius; missing
// fingers remove columns and the whole deck compacts around what remains.

const KEY_PITCH = 19.05;          // MX spacing
const KEY_SIZE = 18.0;            // keycap footprint
const ENC_BODY = 14;              // EC11 body square
const KNOB_D = 20;                // aluminum knob diameter
const OLED_W = 27, OLED_H = 19.5; // 0.96" module active outline
const TB_HOUSING = 8;             // trackball bezel around ball

// Manufacturing constants shared by the generator, the drawings and the DFM
// checks, so a claim in validation.js can never drift from the cut geometry.
const PLATE_CUTOUT = 14.15;       // MX 14.00 nominal + 0.15 FDM compensation
const BOSS_OD = 7.2;              // insert boss outer Ø
const BOSS_BORE = 4.0;            // bore for an M3×5.7 heat-set insert
const PLATE_SCREWS = 6;           // lid fasteners when snapFit is off
const MAGNET_D = 6, MAGNET_H = 3; // N52 puck
const MAGNET_FIT = 0.4;           // pocket clearance on Ø

const FINGERS = [
  { id: "index",  angle: 108, lenF: 0.96 },
  { id: "middle", angle: 94,  lenF: 1.00 },
  { id: "ring",   angle: 80,  lenF: 0.95 },
  { id: "pinky",  angle: 65,  lenF: 0.80 },
];

const rad = d => d * Math.PI / 180;

export function layoutSpec(spec) {
  const { ability, modules, geometry } = spec;
  const R = ability.reachMM;
  const parts = [];                       // {type,x,y,rot,label,mr,mc,...}
  let mc = 0;                             // matrix column cursor

  // ---- key field: ergonomic fan (default) or straight grid (panel style) ----
  const active = FINGERS.filter(f => ability.fingers[f.id]);
  const nCols = Math.max(1, active.length);
  const wantKeys = modules.keys.count;
  let placed = 0;
  const colsMeta = [];

  if (spec.layoutStyle === "grid") {
    const gc = Math.min(6, Math.max(2, Math.ceil(Math.sqrt(wantKeys * 1.3))));
    const gr = Math.ceil(wantKeys / gc);
    for (let r = 0; r < gr; r++) {
      for (let c = 0; c < gc && placed < wantKeys; c++) {
        parts.push({
          type: "key",
          x: (c - (gc - 1) / 2) * KEY_PITCH,
          y: ((gr - 1) / 2 - r) * KEY_PITCH,
          rot: 0, label: `K${placed + 1}`, finger: "grid", mr: Math.min(r, 3), mc: c, // matrix rows capped at hardware budget
        });
        placed++;
      }
    }
    for (let c = 0; c < gc; c++) colsMeta.push({ finger: "grid", n: gr });
    mc = gc;
  } else {
  // Fingertip anchors sit on the reach arc; columns run straight toward the
  // palm so inner rows never converge/overlap (real column-stagger practice).
  const rows = Math.max(2, Math.min(4, Math.ceil(wantKeys / nCols)));
  const anchors = active.map(f => ({
    f,
    x: Math.cos(rad(f.angle)) * R * f.lenF,
    y: Math.sin(rad(f.angle)) * R * f.lenF,
    splay: (f.angle - 90) * 0.35,          // cosmetic splay, ≤ ~7°
  })).sort((a, b) => a.x - b.x);
  for (let i = 1; i < anchors.length; i++)   // enforce column pitch
    if (anchors[i].x - anchors[i - 1].x < KEY_PITCH + 0.6)
      anchors[i].x = anchors[i - 1].x + KEY_PITCH + 0.6;
  for (const a of anchors) {
    const colKeys = [];
    for (let r = 0; r < rows && placed < wantKeys; r++) {
      const p = {
        type: "key", x: a.x, y: a.y - r * KEY_PITCH, rot: a.splay,
        label: `K${placed + 1}`, finger: a.f.id, mr: r, mc,
      };
      parts.push(p); colKeys.push(p); placed++;
    }
    if (colKeys.length) { colsMeta.push({ finger: a.f.id, n: colKeys.length }); mc++; }
  }
  }
  const fanBB = bbox(parts.filter(p => p.type === "key"));

  // ---- thumb cluster: trackball + voice + leftover keys, below/left of fan ----
  const tbTotal = modules.trackball.diameter / 2 + TB_HOUSING;
  if (modules.trackball.present && ability.fingers.thumb) {
    parts.push({
      type: "trackball",
      x: fanBB.minX - tbTotal - 3,      // ≥2 mm housing-to-keycap clearance (validated)
      y: fanBB.minY + tbTotal * 0.35,
      rot: 0, d: modules.trackball.diameter, label: "TB1",
    });
  }
  if (modules.voiceButton) {
    const nearTB = modules.trackball.present && ability.fingers.thumb;
    parts.push({
      type: "key",
      x: nearTB ? fanBB.minX - tbTotal + 2 : fanBB.minX - KEY_PITCH,
      y: nearTB ? fanBB.minY - tbTotal - 8 : fanBB.minY,
      rot: 0, label: "VOICE", voice: true, finger: "thumb", mr: 3, mc: Math.max(0, mc - 1),
    });
  }
  // leftover keys → thumb row under the fan
  let leftover = wantKeys - placed;
  let li = 0;
  while (leftover > 0 && li < 3) {
    parts.push({
      type: "key", x: fanBB.minX + 12 + li * KEY_PITCH, y: fanBB.minY - KEY_PITCH - 4,
      rot: 0, label: `T${li + 1}`, finger: "thumb", mr: li, mc,
    });
    leftover--; li++; placed++;
  }
  if (li > 0) mc++;

  // ---- bbox of the hand cluster so far ----
  let bb = bbox(parts);

  // ---- top strip: OLED · KVM keys · encoders ----
  const stripY = bb.maxY + 16;
  let cursorX = bb.minX;
  if (modules.oled.present) {
    parts.push({ type: "oled", x: cursorX + OLED_W / 2, y: stripY + 2, rot: 0, label: "OLED1" });
    cursorX += OLED_W + 12;
  }
  const kvmN = modules.kvmKeys;
  if (kvmN > 0) {
    for (let i = 0; i < kvmN; i++) {
      const isPC = i < kvmN - 2;
      parts.push({
        type: "key", x: cursorX + KEY_PITCH / 2, y: stripY, rot: 0,
        label: isPC ? `PC${i + 1}` : (i === kvmN - 2 ? "KVM" : "OSD"),
        kvm: true, mr: 4, mc: i % 6,
      });
      cursorX += KEY_PITCH;
    }
    cursorX += 10;
  }
  const encN = modules.encoders.count;
  if (encN > 0) {
    const pitch = KNOB_D + geometry.dialClearanceMM + 4;
    for (let i = 0; i < encN; i++) {
      parts.push({ type: "encoder", x: cursorX + KNOB_D / 2 + i * pitch, y: stripY, rot: 0, label: `ENC${i + 1}` });
    }
  }

  // ---- mirror for left hand ----
  if (ability.hand === "left") {
    for (const p of parts) { p.x = -p.x; p.rot = -p.rot; }
  }

  // ---- deck outline ----
  bb = bbox(parts);
  const margin = 9;
  const deck = {
    w: bb.maxX - bb.minX + margin * 2 + 8,
    d: bb.maxY - bb.minY + margin * 2 + 6,
    r: 8,                                        // corner radius
    h: spec.geometry.deckHeightMM,
  };
  // recentre parts on deck origin
  const cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
  for (const p of parts) { p.x -= cx; p.y -= cy; }

  // ---- rear/side connectors ----
  const jacks = [];
  const jn = modules.pedals.count;
  const onSide = spec.geometry.jackEdge === "side";
  for (let i = 0; i < jn; i++) {
    if (onSide) {
      const sx = ability.hand === "left" ? -deck.w / 2 : deck.w / 2;
      jacks.push({ type: "jack", x: sx, y: -deck.d / 6 + i * 16, edge: "side", label: `J${i + 1}` });
    } else {
      jacks.push({ type: "jack", x: -deck.w / 2 + 18 + i * 16, y: deck.d / 2, edge: "rear", label: `J${i + 1}` });
    }
  }
  const usb = { type: "usb", x: onSide ? 0 : deck.w / 2 - 24, y: deck.d / 2, edge: "rear" };

  // ---- derived stats ----
  const keyTotal = parts.filter(p => p.type === "key").length;
  const shellVol = (deck.w * deck.d * deck.h) / 1000; // cm3 envelope
  const asmMin = estimateAssembly(spec, keyTotal);
  spec.derived = {
    deck, parts, jacks, usb,
    keyTotal,
    colsMeta,
    enclosureVolumeCm3: Math.round(shellVol),
    printTimeH: +(shellVol * 0.032 + 1.4).toFixed(1),
    printGrams: Math.round(shellVol * 0.155 + 38),
    assemblyMin: asmMin,
    matrix: matrixFrom(parts),
  };
  return spec;
}

function estimateAssembly(spec, keys) {
  const m = spec.modules;
  let min = 22;
  min += keys * 2.1;
  min += (m.encoders.count || 0) * 4;
  if (m.trackball.present) min += 6;
  if (m.oled.present) min += 5;
  min += (m.pedals.count || 0) * 3;
  if (m.magnets) min += 8;
  if (spec.geometry.snapFit) min -= 8;      // snap lid: no lid screws
  if (spec.geometry.usbRibs) min += 1;
  return Math.round(min);
}

/** Group keys into an electrical matrix description. */
function matrixFrom(parts) {
  const keys = parts.filter(p => p.type === "key");
  const rows = 1 + Math.max(0, ...keys.map(k => k.mr ?? 0));
  const cols = 1 + Math.max(0, ...keys.map(k => k.mc ?? 0));
  return { rows, cols, keys: keys.map(k => ({ label: k.label, r: k.mr ?? 0, c: k.mc ?? 0 })) };
}

function bbox(parts) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const p of parts) {
    const half = p.type === "trackball" ? (p.d / 2 + TB_HOUSING)
      : p.type === "oled" ? Math.max(OLED_W, OLED_H) / 2 + 2
      : p.type === "encoder" ? KNOB_D / 2 + 2
      : KEY_PITCH / 2;
    minX = Math.min(minX, p.x - half); maxX = Math.max(maxX, p.x + half);
    minY = Math.min(minY, p.y - half); maxY = Math.max(maxY, p.y + half);
  }
  if (minX > maxX) { minX = maxX = minY = maxY = 0; }
  return { minX, minY, maxX, maxY };
}

export const DIMS = {
  KEY_PITCH, KEY_SIZE, ENC_BODY, KNOB_D, OLED_W, OLED_H, TB_HOUSING,
  PLATE_CUTOUT, BOSS_OD, BOSS_BORE, PLATE_SCREWS, MAGNET_D, MAGNET_H, MAGNET_FIT,
};
