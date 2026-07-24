// ============ THE FORGE — exporters ============
import * as THREE from "three";
import { buildBOM, bomTotal, money } from "./catalog.js";

// ---------------------------------------------------------------- downloads
export function download(name, data, mime = "application/octet-stream") {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ---------------------------------------------------------------- binary STL
/**
 * Export meshes to binary STL (mm units, world-transformed).
 * filter(mesh) limits which meshes are written (e.g. printed parts only).
 */
export function toSTL(root, filter = () => true) {
  root.updateWorldMatrix(true, true);
  const tris = [];
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const n = new THREE.Vector3();
  root.traverse(mesh => {
    if (!mesh.isMesh || !filter(mesh)) return;
    const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const pos = geo.getAttribute("position");
    for (let i = 0; i < pos.count; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, i + k).applyMatrix4(mesh.matrixWorld);
      n.copy(v[1]).sub(v[0]).cross(new THREE.Vector3().copy(v[2]).sub(v[0])).normalize();
      tris.push([n.clone(), v[0].clone(), v[1].clone(), v[2].clone()]);
    }
    if (geo !== mesh.geometry) geo.dispose();
  });
  const buf = new ArrayBuffer(84 + tris.length * 50);
  const dv = new DataView(buf);
  const headerText = "THE FORGE binary STL (mm)";
  for (let i = 0; i < headerText.length; i++) dv.setUint8(i, headerText.charCodeAt(i));
  dv.setUint32(80, tris.length, true);
  let o = 84;
  for (const [nn, a, b, c] of tris) {
    // three.js: x right, y up, z toward viewer → STL: z up. Map (x,y,z)→(x,-z,y)
    for (const p of [nn, a, b, c]) {
      dv.setFloat32(o, p.x, true);
      dv.setFloat32(o + 4, -p.z, true);
      dv.setFloat32(o + 8, p.y, true);
      o += 12;
    }
    dv.setUint16(o, 0, true); o += 2;
  }
  return buf;
}

export function printedPartFilter(mesh) {
  const n = mesh.userData.partName || "";
  return n.includes("(printed)");
}

// ---------------------------------------------------------------- minimal ZIP (store)
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** files: {name: string|ArrayBuffer|Uint8Array} → zip Blob (no compression). */
export function makeZip(files) {
  const enc = new TextEncoder();
  const entries = [];
  let offset = 0;
  const chunks = [];
  for (const [name, content] of Object.entries(files)) {
    const nameB = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content)
      : content instanceof ArrayBuffer ? new Uint8Array(content) : content;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);          // version
    local.setUint16(8, 0, true);           // store
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameB.length, true);
    chunks.push(new Uint8Array(local.buffer), nameB, data);
    entries.push({ nameB, crc, size: data.length, offset });
    offset += 30 + nameB.length + data.length;
  }
  const cdStart = offset;
  for (const e of entries) {
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
    cd.setUint32(16, e.crc, true);
    cd.setUint32(20, e.size, true); cd.setUint32(24, e.size, true);
    cd.setUint16(28, e.nameB.length, true);
    cd.setUint32(42, e.offset, true);
    chunks.push(new Uint8Array(cd.buffer), e.nameB);
    offset += 46 + e.nameB.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, offset - cdStart, true);
  end.setUint32(16, cdStart, true);
  chunks.push(new Uint8Array(end.buffer));
  return new Blob(chunks, { type: "application/zip" });
}

// ---------------------------------------------------------------- BOM CSV
export function bomCSV(spec) {
  const rows = buildBOM(spec);
  let csv = "Ref,Qty,Part,MPN,Supplier,Unit USD,Ext USD,Link,Note\n";
  for (const r of rows) {
    csv += [r.part.ref, r.qty, q(r.part.name), r.part.mpn, q(r.part.supplier),
      r.part.unit.toFixed(2), r.ext.toFixed(2), r.part.url, q(r.part.note)].join(",") + "\n";
  }
  csv += `,,,,TOTAL,,${bomTotal(rows).toFixed(2)},,\n`;
  return csv;
}
const q = s => `"${String(s).replace(/"/g, '""')}"`;

// ---------------------------------------------------------------- assembly steps
export function assemblySteps(spec) {
  const m = spec.modules, d = spec.derived;
  const steps = [];
  const add = (title, mins, body, parts) => steps.push({ title, mins, body, parts });
  add("Print the enclosure", 0,
    `Print the bottom shell and switch plate in PETG, 0.2 mm layers, 4 perimeters, 25 % infill. Orient both parts flat side down — no supports needed. Estimated ${d.printTimeH} h, ${d.printGrams} g.`,
    "Bottom shell, switch plate, PETG filament");
  add("Install heat-set inserts", 6,
    "Press six M3 brass inserts into the shell bosses with a soldering iron at 240 °C. Keep the iron vertical; stop flush with the surface.",
    "6× M3 insert");
  if (m.magnets) add("Glue module magnets", 8,
    "Drop a dab of CA glue into each floor pocket and seat the 6×3 mm magnets. IMPORTANT: alternate polarity per printed pocket arrows so modules self-align.",
    "8× N52 magnet, CA glue");
  add("Fit the PCB", 5,
    "Seat the main PCB on the shell standoffs. The USB edge faces the rear opening. Do not screw down yet.",
    "Main PCB");
  add(`Solder switches (${d.keyTotal})`, Math.round(d.keyTotal * 1.6),
    `Snap all ${d.keyTotal} switches into the plate first, then lower plate+switches onto the PCB so every pin enters its hole. Solder pins and the 1N4148 diodes (cathode band toward the ROW trace).`,
    `${d.keyTotal}× switch, ${d.keyTotal}× 1N4148`);
  if (m.encoders.count) add("Mount encoders", m.encoders.count * 4,
    `Insert the ${m.encoders.count} EC11 encoders through the plate holes, thread the bushing nuts, solder, then press on the aluminum knobs and tighten set screws. Check ${spec.geometry.dialClearanceMM} mm knob clearance.`,
    `${m.encoders.count}× PEC11R, ${m.encoders.count}× knob`);
  if (m.trackball.present) add("Install trackball", 6,
    "Screw the PIM447 breakout under the plate opening with M2 screws, drop the ball in, and connect SDA/SCL/3V3/GND flying leads to the labelled PCB pads.",
    "PIM447, 4× jumper wire");
  if (m.oled.present) add("Install OLED", 5,
    "Seat the SSD1306 module behind the plate window, secure with the printed clips, connect the shared I²C harness.",
    "SSD1306 OLED");
  if (m.pedals.count) add("Wire pedal jacks", m.pedals.count * 3,
    `Mount the ${m.pedals.count} TRS jacks in the ${spec.geometry.jackEdge} wall slots. Tip → GPIO wire, sleeve → GND.`,
    `${m.pedals.count}× PJ-320A`);
  add("Flash firmware", 6,
    "Connect USB-C, hold BOOT while tapping RESET, then upload the generated sketch (USB Mode = USB-OTG/TinyUSB). The OLED should show the boot screen.",
    "USB-C cable");
  add(spec.geometry.snapFit ? "Snap on the plate" : "Close it up", spec.geometry.snapFit ? 2 : 6,
    spec.geometry.snapFit
      ? "Align the plate and press until all snap tabs click."
      : "Align the plate and drive the six M3×8 screws into the inserts. Stick the four rubber feet on the base.",
    spec.geometry.snapFit ? "—" : "6× M3×8, 4× Bumpon");
  return steps;
}

export function testProcedure(spec) {
  const m = spec.modules;
  const t = [
    "Continuity: with the meter in beep mode, verify GND at every switch pin 1 is NOT shorted to 3V3 (probe TP1 vs TP2).",
    "Power-on: plug USB-C. Current draw should be 60–120 mA. The OLED boot screen must appear within 2 s." + (m.oled.present ? "" : " (no OLED in this build — check the DevKit RGB LED instead)"),
    "Matrix test: open a text editor, press every key once in reading order — each must emit exactly one code (watch for chatter = re-flow that joint).",
  ];
  if (m.encoders.count) t.push("Encoders: each detent must change volume / scroll by exactly one step in both directions; press must click.");
  if (m.trackball.present) t.push("Trackball: cursor tracks all 4 directions; press = left click. If jittery, check I²C pull-ups.");
  if (m.pedals.count) t.push("Pedals: plug each pedal, verify press/release in a key tester. Tip polarity matters on TS-only pedals.");
  if (m.kvmKeys) t.push("KVM: with both computers connected through the PiKVM, PC1/PC2 keys must switch the video output within 1 s (double-ScrollLock convention).");
  t.push("Profiles: cycle profiles with the encoder press; verify the OLED name changes and a test key emits a different code per profile.");
  t.push("Soak: leave the deck plugged for 30 min; keys must not ghost or repeat (matrix diode check).");
  return t;
}

// ---------------------------------------------------------------- assembly manual HTML
export function manualHTML(spec) {
  const steps = assemblySteps(spec);
  const tests = testProcedure(spec);
  const rows = buildBOM(spec);
  const total = steps.reduce((s, x) => s + x.mins, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${spec.name} — Assembly Manual</title>
<style>
 body{font-family:Georgia,serif;max-width:820px;margin:40px auto;padding:0 20px;color:#222;line-height:1.6}
 h1{font-size:30px;border-bottom:3px solid #e05e0e;padding-bottom:8px}
 h2{margin-top:34px;color:#b34a0b} .step{border:1px solid #ddd;border-left:4px solid #e05e0e;border-radius:6px;padding:12px 16px;margin:12px 0}
 .step b{font-size:15px} .t{float:right;color:#888;font-size:13px} .p{color:#777;font-size:12.5px;font-family:monospace;margin-top:6px}
 table{border-collapse:collapse;width:100%;font-size:13px} td,th{border:1px solid #ddd;padding:6px 9px;text-align:left}
 th{background:#faf4ee} .foot{margin-top:40px;color:#999;font-size:12px;border-top:1px solid #ddd;padding-top:10px}
 ol.test li{margin:8px 0}
</style></head><body>
<h1>${spec.name}</h1>
<p><i>${spec.tagline}</i></p>
<p><b>Revision ${spec.rev}</b> · deck ${spec.derived.deck.w.toFixed(0)} × ${spec.derived.deck.d.toFixed(0)} × ${spec.derived.deck.h} mm ·
estimated assembly ${total} min · generated by THE FORGE</p>
<h2>Parts</h2>
<table><tr><th>Ref</th><th>Qty</th><th>Part</th><th>MPN</th><th>Supplier</th><th>Ext</th></tr>
${rows.map(r => `<tr><td>${r.part.ref}</td><td>${r.qty}</td><td>${r.part.name}</td><td>${r.part.mpn}</td><td><a href="${r.part.url}">${r.part.supplier}</a></td><td>${money(r.ext)}</td></tr>`).join("")}
<tr><td colspan="5"><b>Total</b></td><td><b>${money(bomTotal(rows))}</b></td></tr></table>
<h2>Assembly</h2>
${steps.map((s, i) => `<div class="step"><span class="t">${s.mins ? s.mins + " min" : "print"}</span><b>${i + 1}. ${s.title}</b><br>${s.body}<div class="p">PARTS: ${s.parts}</div></div>`).join("")}
<h2>Testing procedure</h2>
<ol class="test">${tests.map(t => `<li>${t}</li>`).join("")}</ol>
<div class="foot">Generated by THE FORGE — describe the problem, manufacture the solution.</div>
</body></html>`;
}

// ---------------------------------------------------------------- product site
export function productSiteHTML(spec, renderDataURL) {
  const rows = buildBOM(spec);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${spec.name}</title>
<style>
 :root{--a:#ff7a1a} *{box-sizing:border-box;margin:0}
 body{font-family:'Segoe UI',system-ui,sans-serif;background:#0d0f12;color:#e8e4da}
 .hero{min-height:70vh;display:grid;place-items:center;text-align:center;padding:60px 20px;
   background:radial-gradient(ellipse at 50% 30%,#1d2230,#0d0f12 70%)}
 h1{font-size:clamp(34px,7vw,64px);letter-spacing:2px}
 .tag{color:#9aa0aa;font-size:clamp(15px,2.5vw,20px);max-width:640px;margin:14px auto}
 .cta{display:inline-block;margin-top:28px;background:linear-gradient(180deg,#ff8c2e,#e05e0e);color:#1a0d02;
   font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:17px}
 .render{max-width:900px;margin:-30px auto 60px;padding:0 20px}
 .render img{width:100%;border-radius:16px;border:1px solid #2a2f38;box-shadow:0 30px 80px #000a}
 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px;max-width:1000px;margin:0 auto 80px;padding:0 20px}
 .card{background:#171a20;border:1px solid #2a2f38;border-radius:14px;padding:22px}
 .card h3{color:var(--a);margin-bottom:8px;font-size:16px} .card p{color:#9aa0aa;font-size:14px;line-height:1.55}
 .price{text-align:center;margin:0 auto 80px} .price .n{font-size:54px;color:var(--a);font-weight:700}
 footer{color:#596070;text-align:center;padding:30px;font-size:13px;border-top:1px solid #1b1f26}
</style></head><body>
<div class="hero"><div>
<h1>${spec.name.toUpperCase()}</h1>
<p class="tag">${spec.tagline}</p>
<a class="cta" href="#build">Build it yourself — full plans included</a>
</div></div>
${renderDataURL ? `<div class="render"><img src="${renderDataURL}" alt="${spec.name} render"></div>` : ""}
<div class="grid" id="build">
 <div class="card"><h3>⌨ ${spec.derived.keyTotal} programmable keys</h3><p>Hot-swap mechanical switches arranged along your fingers' natural arc — not a grid.</p></div>
 ${spec.modules.trackball.present ? '<div class="card"><h3>🖱 Thumb trackball</h3><p>Full cursor control without leaving the deck. Press to click.</p></div>' : ""}
 ${spec.modules.encoders.count ? `<div class="card"><h3>🎛 ${spec.modules.encoders.count} rotary dials</h3><p>Volume, scroll, jog and scrub with machined aluminum knobs.</p></div>` : ""}
 ${spec.modules.pedals.count ? `<div class="card"><h3>🦶 ${spec.modules.pedals.count} foot pedals</h3><p>Modifiers and push-to-talk moved to your feet, freeing your hand.</p></div>` : ""}
 ${spec.modules.kvmKeys ? '<div class="card"><h3>🖥 Multi-computer control</h3><p>Dedicated keys switch machines through your KVM / PiKVM in under a second.</p></div>' : ""}
 ${spec.modules.oled.present ? '<div class="card"><h3>📟 OLED status</h3><p>Active profile, connected host and layer at a glance.</p></div>' : ""}
 <div class="card"><h3>👤 Fits YOUR hand</h3><p>Generated from a physical-ability profile: ${spec.ability.hand} hand, reach ${spec.ability.reachMM} mm. Every deck is personal.</p></div>
 <div class="card"><h3>🔓 100% open</h3><p>STL, Gerbers, firmware and BOM included. Fix it, fork it, print it again.</p></div>
</div>
<div class="price"><div class="n">$${Math.ceil(bomTotal(rows))}</div><div style="color:#9aa0aa">in parts · ~${Math.round(spec.derived.assemblyMin)} min assembly</div></div>
<footer>Designed with THE FORGE · rev ${spec.rev} · ${new Date().toISOString().slice(0, 10)}</footer>
</body></html>`;
}
