// ============ THE FORGE — PCB generator ============
// Produces a 2-layer board: switch + diode footprints at the ergonomic key
// positions, column nets on F.Cu, row nets on B.Cu (COL2ROW, one 1N4148 per
// key), and a DevKitC header field near the USB edge. Exports Gerber X2 +
// Excellon that open in any Gerber viewer. v1 is comb-autorouted — run DRC
// in KiCad before fabbing.

const TRACE_W = 0.35;      // mm signal
const PAD_D = 2.2;         // th pad diameter
const DRILL_SW = 1.5;      // switch pin
const DRILL_D = 0.9;       // diode leg
const DRILL_HDR = 1.0;     // header pin

export function buildPCB(spec) {
  const { deck, parts, usb } = spec.derived;
  const e = spec.derived.elec;
  const bw = deck.w - 14, bh = deck.d - 26;
  const cx = 0, cy = -2;                          // board centre in layout coords
  const B = { w: bw, h: bh, x0: cx - bw / 2, y0: cy - bh / 2, x1: cx + bw / 2, y1: cy + bh / 2 };

  const pads = [];   // {x,y,d,drill,net,layer:'both'}
  const traces = []; // {layer:'F'|'B', w, pts:[[x,y],...]}
  const holes = [];  // npth {x,y,d}
  const silk = [];   // {x,y,rot,kind,label}

  const rot = (px, py, a) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];

  // ---- header field for the DevKitC (2 × 22 pins, 600 mil apart is dev-board
  // specific; DevKitC-1 is 0.9" between rows, 0.1" pitch) ----
  const hdrX = Math.min(B.x1 - 8, Math.max(B.x0 + 8, usb.x));
  const hdrTopY = B.y1 - 4;
  const hdrPins = [];
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < 22; i++) {
      const p = { x: hdrX - 11.43 + side * 22.86, y: hdrTopY - i * 2.54, d: 1.8, drill: DRILL_HDR, net: `HDR${side}_${i}` };
      pads.push(p); hdrPins.push(p);
    }
  }
  // logical GPIO → header pad (deterministic fake mapping; enough for routing)
  const gpioPad = (gpio) => hdrPins[gpio % hdrPins.length];

  // ---- per-key footprints ----
  const keyParts = parts.filter(p => p.type === "key");
  const colChains = new Map(), rowChains = new Map();
  for (const k of keyParts) {
    const a = ((k.rot || 0) * Math.PI) / 180;
    const [p1x, p1y] = rot(-3.81, 2.54, a);      // pin 1 → COL net (F.Cu)
    const [p2x, p2y] = rot(2.54, 5.08, a);       // pin 2 → diode → ROW (B.Cu)
    const [dax, day] = rot(6.5, 2.0, a);         // diode anode
    const [dkx, dky] = rot(6.5, -2.0, a);        // diode cathode
    const P1 = { x: k.x + p1x, y: k.y + p1y, d: PAD_D, drill: DRILL_SW, net: `COL${k.mc}` };
    const P2 = { x: k.x + p2x, y: k.y + p2y, d: PAD_D, drill: DRILL_SW, net: "SW2" };
    const DA = { x: k.x + dax, y: k.y + day, d: 1.8, drill: DRILL_D, net: "SW2" };
    const DK = { x: k.x + dkx, y: k.y + dky, d: 1.8, drill: DRILL_D, net: `ROW${k.mr}` };
    pads.push(P1, P2, DA, DK);
    holes.push({ x: k.x, y: k.y, d: 4.0 });      // MX centre post
    silk.push({ x: k.x, y: k.y, rot: k.rot || 0, kind: "sw", label: k.label });
    traces.push({ layer: "B", w: TRACE_W, pts: [[P2.x, P2.y], [DA.x, DA.y]] }); // pin2→anode
    push(colChains, k.mc, P1);
    push(rowChains, k.mr, DK);
  }

  // ---- encoder footprints ----
  for (const p of parts.filter(q => q.type === "encoder")) {
    for (const [dx, dy] of [[-2.5, 7.5], [0, 7.5], [2.5, 7.5], [-2.5, -7], [2.5, -7]])
      pads.push({ x: p.x + dx, y: p.y + dy, d: 1.9, drill: 1.0, net: p.label });
    silk.push({ x: p.x, y: p.y, rot: 0, kind: "enc", label: p.label });
    const hp = gpioPad(7 + pads.length % 11);
    traces.push({ layer: "F", w: TRACE_W, pts: L([p.x, p.y + 7.5], [hp.x, hp.y]) });
  }

  // ---- chain column nets on F.Cu, row nets on B.Cu ----
  for (const [c, chain] of colChains) {
    chain.sort((a, b) => a.y - b.y);
    for (let i = 0; i < chain.length - 1; i++)
      traces.push({ layer: "F", w: TRACE_W, pts: [[chain[i].x, chain[i].y], [chain[i + 1].x, chain[i + 1].y]] });
    const top = chain[chain.length - 1], hp = gpioPad(spec.derived.elec.matrix.cols[c] ?? c);
    traces.push({ layer: "F", w: TRACE_W, pts: L([top.x, top.y], [hp.x - 1.27, hp.y], B.y1 - 6 - c * 1.1) });
  }
  for (const [r, chain] of rowChains) {
    chain.sort((a, b) => a.x - b.x);
    for (let i = 0; i < chain.length - 1; i++)
      traces.push({ layer: "B", w: TRACE_W, pts: [[chain[i].x, chain[i].y], [chain[i + 1].x, chain[i + 1].y]] });
    const right = chain[chain.length - 1], hp = gpioPad(e.matrix.rows[r] ?? r + 30);
    traces.push({ layer: "B", w: TRACE_W, pts: L([right.x, right.y], [hp.x + 1.27, hp.y], B.y1 - 10 - r * 1.1) });
  }

  const pcb = { board: B, pads, traces, holes, silk, hdrX };
  spec.derived.pcb = pcb;
  return pcb;
}

function push(map, k, v) { if (!map.has(k)) map.set(k, []); map.get(k).push(v); }
/** L-shaped escape route with optional horizontal bus Y. */
function L(from, to, busY) {
  if (busY === undefined) return [from, [from[0], to[1]], to];
  return [from, [from[0], busY], [to[0], busY], to];
}

// ---------------------------------------------------------------- SVG preview
const esc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export function pcbSVG(spec) {
  const { board: B, pads, traces, holes, silk } = spec.derived.pcb;
  const S = 4.4, pad = 30;
  const W = B.w * S + pad * 2, H = B.h * S + pad * 2;
  const X = x => pad + (x - B.x0) * S;
  const Y = y => pad + (B.y1 - y) * S;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H + 30}" style="background:#0b0d10">`;
  s += `<text x="${pad}" y="18" fill="#ffb143" font-family="monospace" font-size="13" font-weight="bold">${esc(spec.name)} — PCB rev ${spec.rev} · 2-layer · ${B.w.toFixed(0)}×${B.h.toFixed(0)} mm<tspan fill="#ff6b7a" font-weight="normal"> · ⚠ header→GPIO pins unverified</tspan></text>`;
  s += `<g transform="translate(0,26)">`;
  s += `<rect x="${X(B.x0)}" y="${Y(B.y1)}" width="${B.w * S}" height="${B.h * S}" rx="10" fill="#0e2a1a" stroke="#d9c46a" stroke-width="1.6"/>`;
  for (const t of traces) {
    const col = t.layer === "F" ? "#c94a35" : "#3a72c9";
    const d = t.pts.map((p, i) => `${i ? "L" : "M"} ${X(p[0])} ${Y(p[1])}`).join(" ");
    s += `<path d="${d}" stroke="${col}" stroke-width="${t.w * S}" fill="none" stroke-linecap="round" opacity="0.9"/>`;
  }
  for (const h of holes) s += `<circle cx="${X(h.x)}" cy="${Y(h.y)}" r="${(h.d / 2) * S}" fill="#0b0d10" stroke="#3d4c42"/>`;
  for (const p of pads) {
    s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${(p.d / 2) * S}" fill="#d8b23a"/>`;
    s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${(p.drill / 2) * S}" fill="#0b0d10"/>`;
  }
  for (const k of silk) {
    if (k.kind === "sw")
      s += `<rect x="${X(k.x) - 7 * S}" y="${Y(k.y) - 7 * S}" width="${14 * S}" height="${14 * S}" transform="rotate(${-k.rot} ${X(k.x)} ${Y(k.y)})" fill="none" stroke="#e8e4da55" stroke-width="1"/>`;
    else
      s += `<circle cx="${X(k.x)}" cy="${Y(k.y)}" r="${7 * S}" fill="none" stroke="#e8e4da55"/>`;
    s += `<text x="${X(k.x)}" y="${Y(k.y) - 8 * S}" fill="#e8e4da88" font-size="9" font-family="monospace" text-anchor="middle">${k.label}</text>`;
  }
  s += `</g></svg>`;
  return s;
}

// ---------------------------------------------------------------- Gerber X2
const FMT = n => {
  const v = Math.round(n * 1e6);
  return (v < 0 ? "-" : "") + String(Math.abs(v)).padStart(1, "0");
};

export function gerberFiles(spec) {
  const { board: B, pads, traces, holes } = spec.derived.pcb;
  const name = spec.name.replace(/\W+/g, "-");
  const head = (fn, pol = "Positive") =>
    `%TF.GenerationSoftware,TheForge,forge,1.0*%\n%TF.FileFunction,${fn}*%\n%TF.FilePolarity,${pol}*%\n%FSLAX46Y46*%\n%MOMM*%\n`;
  const files = {};

  // --- outline ---
  {
    let g = head("Profile,NP") + "%ADD10C,0.100*%\nD10*\n";
    g += `X${FMT(B.x0)}Y${FMT(B.y0)}D02*\nX${FMT(B.x1)}Y${FMT(B.y0)}D01*\nX${FMT(B.x1)}Y${FMT(B.y1)}D01*\nX${FMT(B.x0)}Y${FMT(B.y1)}D01*\nX${FMT(B.x0)}Y${FMT(B.y0)}D01*\nM02*\n`;
    files[`${name}-Edge_Cuts.gko`] = g;
  }
  // --- copper layers ---
  for (const layer of ["F", "B"]) {
    let g = head(`Copper,L${layer === "F" ? 1 : 2},${layer === "F" ? "Top" : "Bot"}`);
    g += `%ADD10C,${TRACE_W.toFixed(3)}*%\n%ADD11C,${PAD_D.toFixed(3)}*%\n%ADD12C,1.800*%\n`;
    g += "D10*\n";
    for (const t of traces.filter(t => t.layer === layer)) {
      g += `X${FMT(t.pts[0][0])}Y${FMT(t.pts[0][1])}D02*\n`;
      for (let i = 1; i < t.pts.length; i++) g += `X${FMT(t.pts[i][0])}Y${FMT(t.pts[i][1])}D01*\n`;
    }
    g += "D11*\n";
    for (const p of pads.filter(p => p.d >= PAD_D)) g += `X${FMT(p.x)}Y${FMT(p.y)}D03*\n`;
    g += "D12*\n";
    for (const p of pads.filter(p => p.d < PAD_D)) g += `X${FMT(p.x)}Y${FMT(p.y)}D03*\n`;
    g += "M02*\n";
    files[`${name}-${layer}_Cu.g${layer.toLowerCase()}l`] = g;
  }
  // --- solder mask (openings over pads) ---
  for (const layer of ["F", "B"]) {
    let g = head(`Soldermask,${layer === "F" ? "Top" : "Bot"}`, "Negative");
    g += `%ADD11C,${(PAD_D + 0.1).toFixed(3)}*%\nD11*\n`;
    for (const p of pads) g += `X${FMT(p.x)}Y${FMT(p.y)}D03*\n`;
    g += "M02*\n";
    files[`${name}-${layer}_Mask.g${layer.toLowerCase()}s`] = g;
  }
  // --- Excellon drills ---
  {
    const tools = new Map();
    const all = [
      ...pads.map(p => ({ x: p.x, y: p.y, d: p.drill })),
      ...holes.map(h => ({ x: h.x, y: h.y, d: h.d })),
    ];
    for (const h of all) { const k = h.d.toFixed(2); if (!tools.has(k)) tools.set(k, []); tools.get(k).push(h); }
    let d = "M48\nMETRIC,TZ\n";
    let ti = 1;
    for (const k of tools.keys()) d += `T${ti++}C${k}\n`;
    d += "%\nG90\nG05\n";
    ti = 1;
    for (const [, hs] of tools) {
      d += `T${ti++}\n`;
      for (const h of hs) d += `X${h.x.toFixed(3)}Y${h.y.toFixed(3)}\n`;
    }
    d += "M30\n";
    files[`${name}.drl`] = d;
  }
  files["README.txt"] =
`${spec.name} — rev ${spec.rev}
Generated by THE FORGE

2-layer PCB, ${B.w.toFixed(1)} x ${B.h.toFixed(1)} mm
Stack: F.Cu (columns) / B.Cu (rows), COL2ROW diode matrix (1N4148).

Files:
  *.gko  board outline        *.gtl/.gbl  top/bottom copper
  *.gts/.gbs soldermask       *.drl       Excellon drill

*** DO NOT FABRICATE AS-IS ***
The board GEOMETRY is real, but the header-pin mapping is an UNVERIFIED
PLACEHOLDER: the matrix/encoder escape traces are routed to header pads by
position (gpio % pad-count), NOT to the ESP32-S3-DevKitC-1 pins that actually
carry those GPIOs. The copper therefore does not electrically match the
schematic/firmware. Before ordering: assign every header pad to its real
DevKitC-1 pin, re-route, and run a KiCad DRC pass. This is v1 comb-autoroute —
Import into KiCad (File > Import > Gerber). Any 2-layer service (JLCPCB/PCBWay/
OSHPark) works once the netlist is corrected.
`;
  return files;
}
