// ============ THE FORGE — drawings + CAD file formats ============
// Dimensioned 2-D drawings (SVG), DXF R12 (laser/plasma/CNC), 3MF (print),
// and STEP AP242 with tessellated geometry. The parametric model remains the
// source of truth; these are derived exports.

import * as THREE from "three";
import { modelScale } from "./exports.js";
import { DIMS } from "./layout.js";

// ---------------------------------------------------------------- dimensioned drawing (SVG)
export function deckDrawingSVG(spec) {
  const d = spec.derived.deck, g = spec.geometry;
  const S = 2.6, pad = 90;
  const W = d.w * S + pad * 2 + 120, H = d.d * S + (d.h + g.plateMM) * S + pad * 2.6 + 130;
  const x0 = pad + 60, y0 = pad;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="background:#fff">
  <style>
    .out{fill:none;stroke:#111;stroke-width:1.6}.thin{fill:none;stroke:#111;stroke-width:0.7}
    .dim{stroke:#0a58c9;stroke-width:0.8;fill:none}.dt{fill:#0a58c9;font:11px monospace}
    .cl{stroke:#c99;stroke-width:0.6;stroke-dasharray:8 3 2 3;fill:none}
    .tb{font:10.5px monospace;fill:#111}.tbh{font:bold 12px monospace;fill:#111}
    .note{font:9.5px monospace;fill:#555}
  </style>`;

  // TOP VIEW
  s += `<rect x="${x0}" y="${y0}" width="${d.w * S}" height="${d.d * S}" rx="${d.r * S}" class="out"/>`;
  for (const p of spec.derived.parts) {
    const px = x0 + (p.x + d.w / 2) * S, py = y0 + (d.d / 2 - p.y) * S;
    if (p.type === "key") s += `<rect x="${px - 7 * S}" y="${py - 7 * S}" width="${14 * S}" height="${14 * S}" transform="rotate(${-p.rot} ${px} ${py})" class="thin"/>`;
    else if (p.type === "encoder") s += `<circle cx="${px}" cy="${py}" r="${3.6 * S}" class="thin"/><circle cx="${px}" cy="${py}" r="${10 * S}" class="cl"/>`;
    else if (p.type === "trackball") s += `<circle cx="${px}" cy="${py}" r="${(p.d / 2 - 1.5) * S}" class="thin"/>`;
    else if (p.type === "oled") s += `<rect x="${px - 12.5 * S}" y="${py - 7 * S}" width="${25 * S}" height="${14 * S}" class="thin"/>`;
  }
  // dims: width
  const dy = y0 + d.d * S + 26;
  s += dimH(x0, x0 + d.w * S, dy, `${d.w.toFixed(1)}`);
  s += dimV(x0 - 26, y0, y0 + d.d * S, `${d.d.toFixed(1)}`);
  // key pitch callout on first two keys of one column
  const keys = spec.derived.parts.filter(p => p.type === "key" && p.mr !== undefined && p.mc === 1).sort((a, b) => b.y - a.y);
  if (keys.length >= 2) {
    const k1 = keys[0], k2 = keys[1];
    const px = x0 + (k1.x + d.w / 2) * S + 11 * S;
    s += dimV(px + 14, y0 + (d.d / 2 - k1.y) * S, y0 + (d.d / 2 - k2.y) * S, "19.05 TYP");
  }

  // SIDE VIEW (section)
  const sy = y0 + d.d * S + 74;
  const th = (d.h + g.plateMM) * S;
  s += `<rect x="${x0}" y="${sy}" width="${d.w * S}" height="${th}" class="out"/>`;
  s += `<line x1="${x0}" y1="${sy + g.plateMM * S}" x2="${x0 + d.w * S}" y2="${sy + g.plateMM * S}" class="thin"/>`;
  s += `<line x1="${x0 - 8}" y1="${sy - 8}" x2="${x0 + 40}" y2="${sy - 8}" class="thin"/><text x="${x0 + 44}" y="${sy - 5}" class="note">SECTION A-A</text>`;
  s += dimV(x0 + d.w * S + 26, sy, sy + th, `${(d.h + g.plateMM).toFixed(1)}`);
  s += dimH(x0, x0 + g.wallMM * S * 6, sy + th + 22, `WALL ${g.wallMM.toFixed(1)}`);

  // title block
  const tbY = H - 108;
  s += `<rect x="${W - 372}" y="${tbY}" width="352" height="88" class="out"/>
  <line x1="${W - 372}" y1="${tbY + 26}" x2="${W - 20}" y2="${tbY + 26}" class="thin"/>
  <line x1="${W - 372}" y1="${tbY + 48}" x2="${W - 20}" y2="${tbY + 48}" class="thin"/>
  <line x1="${W - 200}" y1="${tbY + 26}" x2="${W - 200}" y2="${tbY + 88}" class="thin"/>
  <text x="${W - 362}" y="${tbY + 18}" class="tbh">${esc(spec.name.toUpperCase())} — TOP ASSEMBLY</text>
  <text x="${W - 362}" y="${tbY + 42}" class="tb">PN FRG-${String(spec.rev).padStart(3, "0")}-A  REV ${spec.rev}</text>
  <text x="${W - 190}" y="${tbY + 42}" class="tb">MATL: PETG / FR4</text>
  <text x="${W - 362}" y="${tbY + 64}" class="tb">SCALE 1:${(1 / (S / 3.78)).toFixed(1)}  UNITS mm</text>
  <text x="${W - 190}" y="${tbY + 64}" class="tb">PROC: FDM + PCB FAB</text>
  <text x="${W - 362}" y="${tbY + 82}" class="note">THE FORGE — PRELIMINARY. TOL ±0.2 UNLESS NOTED. VERIFY BEFORE PRODUCTION.</text>`;
  s += `</svg>`;
  return s;
}

/** Generic single-part drawing: plan + side silhouette with overall dims. */
export function partDrawingSVG(name, rev, material, process, plan) {
  // plan: {w, d, h, outline:[[x,y]...], holes:[{x,y,r}], notes[]}
  const S = Math.min(3.4, 420 / Math.max(plan.w, plan.d));
  const pad = 80;
  const W = plan.w * S + pad * 2 + 140, H = plan.d * S + plan.h * S + pad * 2 + 190;
  const x0 = pad + 40, y0 = pad;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="background:#fff"><style>
    .out{fill:none;stroke:#111;stroke-width:1.5}.thin{fill:none;stroke:#111;stroke-width:0.7}
    .dim{stroke:#0a58c9;stroke-width:0.8;fill:none}.dt{fill:#0a58c9;font:11px monospace}
    .tb{font:10.5px monospace;fill:#111}.tbh{font:bold 12px monospace;fill:#111}.note{font:9.5px monospace;fill:#555}
  </style>`;
  if (plan.outline?.length) {
    s += `<path class="out" d="${plan.outline.map((p, i) => `${i ? "L" : "M"} ${x0 + p[0] * S} ${y0 + p[1] * S}`).join(" ")} Z"/>`;
  } else {
    s += `<rect x="${x0}" y="${y0}" width="${plan.w * S}" height="${plan.d * S}" class="out"/>`;
  }
  for (const h of plan.holes || []) {
    s += `<circle cx="${x0 + h.x * S}" cy="${y0 + h.y * S}" r="${h.r * S}" class="thin"/>`;
    s += `<text x="${x0 + h.x * S + h.r * S + 3}" y="${y0 + h.y * S - 3}" class="dt">Ø${(h.r * 2).toFixed(1)}</text>`;
  }
  s += dimH(x0, x0 + plan.w * S, y0 + plan.d * S + 24, plan.w.toFixed(1));
  s += dimV(x0 - 24, y0, y0 + plan.d * S, plan.d.toFixed(1));
  const sy = y0 + plan.d * S + 62;
  s += `<rect x="${x0}" y="${sy}" width="${plan.w * S}" height="${plan.h * S}" class="out"/>`;
  s += dimV(x0 + plan.w * S + 24, sy, sy + plan.h * S, plan.h.toFixed(1));
  (plan.notes || []).forEach((n, i) => s += `<text x="${x0}" y="${sy + plan.h * S + 30 + i * 14}" class="note">${i + 1}. ${esc(n)}</text>`);
  const tbY = H - 96;
  s += `<rect x="${W - 342}" y="${tbY}" width="322" height="76" class="out"/>
  <text x="${W - 332}" y="${tbY + 18}" class="tbh">${esc(name.toUpperCase())}</text>
  <text x="${W - 332}" y="${tbY + 38}" class="tb">REV ${rev} · ${esc(material)} · ${esc(process)}</text>
  <text x="${W - 332}" y="${tbY + 56}" class="tb">UNITS mm · TOL ±0.2 UNLESS NOTED</text>
  <text x="${W - 332}" y="${tbY + 70}" class="note">THE FORGE — PRELIMINARY. VERIFY BEFORE PRODUCTION.</text></svg>`;
  return s;
}

function dimH(x1, x2, y, label) {
  return `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="dim"/>
  <line x1="${x1}" y1="${y - 5}" x2="${x1}" y2="${y + 5}" class="dim"/><line x1="${x2}" y1="${y - 5}" x2="${x2}" y2="${y + 5}" class="dim"/>
  <text x="${(x1 + x2) / 2}" y="${y - 5}" class="dt" text-anchor="middle">${label}</text>`;
}
function dimV(x, y1, y2, label) {
  return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" class="dim"/>
  <line x1="${x - 5}" y1="${y1}" x2="${x + 5}" y2="${y1}" class="dim"/><line x1="${x - 5}" y1="${y2}" x2="${x + 5}" y2="${y2}" class="dim"/>
  <text x="${x - 7}" y="${(y1 + y2) / 2}" class="dt" text-anchor="middle" transform="rotate(-90 ${x - 7} ${(y1 + y2) / 2})">${label}</text>`;
}
function esc(t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
// attribute-safe: part names reach 3MF/STEP attributes and STEP string literals
function xesc(t) { return esc(t).replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
function sesc(t) { return String(t).replace(/'/g, "''").replace(/\\/g, "\\\\"); }

// ---------------------------------------------------------------- DXF R12
/** entities: [{type:'poly', pts:[[x,y]..], closed} | {type:'circle', x,y,r}] — mm, laser-ready. */
export function toDXF(entities) {
  // R12 (AC1009). $ACADVER so readers do not have to guess the version, and the
  // 10/20/30 dummy point plus a 70 flag on every VERTEX, both of which the
  // POLYLINE record requires — importers that validate strictly reject
  // otherwise, and the geometry looked fine right up until they did.
  let d = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
  for (const e of entities) {
    if (e.type === "circle") {
      d += `0\nCIRCLE\n8\nCUT\n10\n${e.x.toFixed(3)}\n20\n${e.y.toFixed(3)}\n30\n0.0\n40\n${e.r.toFixed(3)}\n`;
    } else {
      d += `0\nPOLYLINE\n8\nCUT\n66\n1\n70\n${e.closed ? 1 : 0}\n10\n0.0\n20\n0.0\n30\n0.0\n`;
      for (const p of e.pts)
        d += `0\nVERTEX\n8\nCUT\n70\n0\n10\n${p[0].toFixed(3)}\n20\n${p[1].toFixed(3)}\n30\n0.0\n`;
      d += "0\nSEQEND\n8\nCUT\n";
    }
  }
  d += "0\nENDSEC\n0\nEOF\n";
  return d;
}

/** The switch plate as a laser-cuttable DXF (outline + all cutouts). */
export function plateDXF(spec) {
  const d = spec.derived.deck;
  const ents = [{ type: "poly", closed: true, pts: roundedRectPts(d.w, d.d, d.r) }];
  for (const p of spec.derived.parts) {
    if (p.type === "key") ents.push({ type: "poly", closed: true, pts: rotSquare(p.x, p.y, DIMS.PLATE_CUTOUT, p.rot) });
    else if (p.type === "encoder") ents.push({ type: "circle", x: p.x, y: p.y, r: 3.6 });
    else if (p.type === "trackball") ents.push({ type: "circle", x: p.x, y: p.y, r: p.d / 2 - 1.5 });
    else if (p.type === "oled") ents.push({ type: "poly", closed: true, pts: rotSquareWH(p.x, p.y, 25, 14, 0) });
  }
  return toDXF(ents);
}
function roundedRectPts(w, d, r, n = 8) {
  const pts = [];
  const cs = [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, 90], [-w / 2 + r, -d / 2 + r, 180], [w / 2 - r, -d / 2 + r, 270]];
  for (const [cx, cy, a0] of cs)
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  return pts;
}
function rotSquare(cx, cy, size, rotDeg) { return rotSquareWH(cx, cy, size, size, rotDeg); }
function rotSquareWH(cx, cy, w, h, rotDeg) {
  const a = (rotDeg * Math.PI) / 180, hw = w / 2, hh = h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [
    cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)]);
}

// ---------------------------------------------------------------- mesh collection
function collectMesh(root, filter) {
  root.updateWorldMatrix(true, true);
  const S = modelScale(root);
  const verts = [], tris = [];
  const map = new Map();
  const v = new THREE.Vector3();
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  root.traverse(mesh => {
    if (!mesh.isMesh || (filter && !filter(mesh))) return;
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      const tri = [];
      for (let k = 0; k < 3; k++) {
        v.fromBufferAttribute(pos, i + k).applyMatrix4(mesh.matrixWorld).multiplyScalar(S);
        // three (y-up) → CAD (z-up)
        const x = v.x, y = -v.z, z = v.y;
        const kk = key(x, y, z);
        let idx = map.get(kk);
        if (idx === undefined) { idx = verts.length; verts.push([x, y, z]); map.set(kk, idx); }
        tri.push(idx);
      }
      tris.push(tri);
    }
    if (geo !== mesh.geometry) geo.dispose();
  });
  return { verts, tris };
}

/**
 * One entry per printed part, keyed by the tagged part name.
 *
 * These exports carry several separately printed parts. Merging them into a
 * single mesh makes the shell and the plate share the faces they touch at, and
 * 3MF core requires each object to be a manifold solid — so the honest and the
 * conforming representation are the same one: a part per object.
 */
function collectParts(root, filter) {
  const names = [];
  root.traverse(m => {
    if (!m.isMesh || (filter && !filter(m))) return;
    const n = m.userData.partName || "part";
    if (!names.includes(n)) names.push(n);
  });
  return names
    .map(n => ({ name: n, ...collectMesh(root, m => (!filter || filter(m)) && (m.userData.partName || "part") === n) }))
    .filter(p => p.tris.length);
}

// ---------------------------------------------------------------- 3MF
export function to3MF(root, filter, title = "forge-part") {
  const parts = collectParts(root, filter);
  const objects = parts.map((p, i) => `  <object id="${i + 1}" type="model" name="${xesc(p.name)}">
   <mesh>
    <vertices>
${p.verts.map(v => `     <vertex x="${v[0].toFixed(3)}" y="${v[1].toFixed(3)}" z="${v[2].toFixed(3)}"/>`).join("\n")}
    </vertices>
    <triangles>
${p.tris.map(t => `     <triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join("\n")}
    </triangles>
   </mesh>
  </object>`).join("\n");
  const model =
`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
 <metadata name="Title">${xesc(title)}</metadata>
 <metadata name="Application">THE FORGE</metadata>
 <resources>
${objects}
 </resources>
 <build>${parts.map((_, i) => `<item objectid="${i + 1}"/>`).join("")}</build>
</model>`;
  return {
    "[Content_Types].xml":
`<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>`,
    "_rels/.rels":
`<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`,
    "3D/3dmodel.model": model,
  };
}

// ---------------------------------------------------------------- STEP AP242 (tessellated)
export function toSTEP(root, filter, name = "FORGE-PART") {
  const parts = collectParts(root, filter);
  const ts = new Date().toISOString().slice(0, 19);
  // One coordinates_list + triangulated_face per printed part, all gathered into
  // a single tessellated_shell. The shell matters: OCCT 7.8 (FreeCAD 1.1)
  // imports a tessellated_shape_representation holding one triangulated_face,
  // but silently yields zero objects when it holds two — verified by importing
  // both arrangements. Wrapped in a shell it comes in as one object with a face
  // per part, so the parts stay identifiable and the file still opens.
  let id = 30;
  const faceIds = [];
  const faces = parts.map(p => {
    const cid = id++, fid = id++;
    faceIds.push(fid);
    const coords = p.verts.map(v => `(${v[0].toFixed(3)},${v[1].toFixed(3)},${v[2].toFixed(3)})`).join(",");
    const tl = p.tris.map(t => `(${t[0] + 1},${t[1] + 1},${t[2] + 1})`).join(",");
    return `#${cid}=COORDINATES_LIST('${sesc(p.name)}',${p.verts.length},(${coords}));\n` +
           `#${fid}=TRIANGULATED_FACE('${sesc(p.name)}',#${cid},${p.verts.length},(),$,(),(${tl}));`;
  }).join("\n");
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('THE FORGE tessellated export','${sesc(name)}'),'2;1');
FILE_NAME('${sesc(name)}.step','${ts}',('THE FORGE'),(''),'AP242','THE FORGE','');
FILE_SCHEMA(('AP242_MANAGED_MODEL_BASED_3D_ENGINEERING_MIM_LF'));
ENDSEC;
DATA;
#1=APPLICATION_CONTEXT('managed model based 3d engineering');
#2=APPLICATION_PROTOCOL_DEFINITION('international standard','ap242_managed_model_based_3d_engineering',2020,#1);
#3=PRODUCT_CONTEXT('',#1,'mechanical');
#4=PRODUCT('${sesc(name)}','${sesc(name)}','',(#3));
#5=PRODUCT_DEFINITION_FORMATION('1','',#4);
#6=PRODUCT_DEFINITION_CONTEXT('part definition',#1,'design');
#7=PRODUCT_DEFINITION('design','',#5,#6);
#8=PRODUCT_DEFINITION_SHAPE('','',#7);
#10=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));
#11=(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.));
#12=(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT());
#13=UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(0.005),#10,'DISTANCE_ACCURACY_VALUE','');
#14=(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#13))GLOBAL_UNIT_ASSIGNED_CONTEXT((#10,#11,#12))REPRESENTATION_CONTEXT('',''));
#15=PRODUCT_RELATED_PRODUCT_CATEGORY('part','',(#4));
${faces}
#${id}=TESSELLATED_SHELL('${sesc(name)}',(${faceIds.map(f => "#" + f).join(",")}),$);
#22=TESSELLATED_SHAPE_REPRESENTATION('${sesc(name)}',(#${id}),#14);
#23=SHAPE_DEFINITION_REPRESENTATION(#8,#22);
ENDSEC;
END-ISO-10303-21;
`;
}
