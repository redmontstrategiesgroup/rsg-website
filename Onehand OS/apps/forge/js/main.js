// ============ THE FORGE — application ============
import { defaultSpec, interpretOffline, SPEC_SCHEMA, specFromAI, EXAMPLES } from "./spec.js";
import { layoutSpec } from "./layout.js";
import { buildDeckModel, buildRepairPart, buildWoodModel } from "./geometry.js";
import { initViewer, setModel, setExplode, setSpin, isSpin, setMode as setViewMode, snapshot } from "./viewer.js";
import { buildElectronics, schematicSVG, wiringSVG } from "./electronics.js";
import { buildPCB, pcbSVG, gerberFiles } from "./pcb.js";
import { generateFirmware, highlightC } from "./firmware.js";
import {
  download, toSTL, printedPartFilter, makeZip, bomCSV,
  assemblySteps, testProcedure, manualHTML, productSiteHTML,
} from "./exports.js";
import { buildBOM, bomTotal, money, WOOD } from "./catalog.js";
import {
  getSettings, saveSettings, hasKey,
  generateSpecAI, generateConceptsAI, inspectPrototypeAI, inspectPrototypeDemo, applyPatches,
} from "./claude.js";
import { woodPlan, repairPlan, REPAIR_TYPES, conceptsOffline, scoreConcepts } from "./modes.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const state = {
  mode: "product",
  spec: null,
  firmware: "",
  renderURL: null,
  versions: [],            // [{rev, date, changes[], spec-clone}]
  wood: null,              // {cfg, plan}
  repair: null,            // {type, refMM, plan}
  inventor: { problem: "", concepts: [] },
  inspectImage: null,      // {b64, mediaType, dataURL}
  lastReport: null,
};

// ================================================================ pipeline UI
const STAGES = {
  product: ["Interpret intent", "Ergonomic layout", "Mechanical design", "Electronics", "PCB routing", "Firmware", "BOM & sourcing", "Docs & renders"],
  woodworking: ["Read stock", "Design around slab", "Cut list", "Joinery plan", "Material estimate", "Pricing", "Renders"],
  repair: ["Identify part", "Scale from reference", "Rebuild geometry", "Print plan"],
  inventor: ["Frame problem", "Generate concepts", "Score & rank", "Await selection"],
};

function paintStages(mode) {
  $("#pipeline-stages").innerHTML = STAGES[mode]
    .map(s => `<li><span class="st-dot"></span>${s}<span class="st-ms"></span></li>`).join("");
}
async function runStage(i, fn) {
  const items = $$("#pipeline-stages li");
  const li = items[i];
  if (!li) return fn?.();
  li.className = "run";
  const t0 = performance.now();
  await sleep(90 + Math.random() * 240);
  const out = await fn?.();
  li.className = "done";
  li.querySelector(".st-ms").textContent = `${Math.round(performance.now() - t0)}ms`;
  return out;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ================================================================ product flow
async function forgeProduct(sentence, { silent = false } = {}) {
  setMode("product", { keepInput: true });
  paintStages("product");
  const btn = $("#btn-forge");
  btn.disabled = true;
  try {
    let spec;
    await runStage(0, async () => {
      if (hasKey()) {
        try {
          const ai = await generateSpecAI(sentence, SPEC_SCHEMA);
          spec = specFromAI(ai, sentence);
          if (!silent) toast("Fable interpreted your invention ✓", "ok");
        } catch (e) {
          if (!silent) toast("AI interpret failed (" + e.message + ") — using offline engine", "err");
          spec = interpretOffline(sentence);
        }
      } else {
        spec = interpretOffline(sentence);
      }
      // ability panel overrides
      spec.ability = readAbilityPanel(spec.ability);
      state.spec = spec;
      syncModulePanel();
    });
    await rebuildProduct({ animate: true, fromStage: 1 });
    state.versions = [verEntry(state.spec, ["Initial generation from prompt"])];
    paintVersions();
    if (!silent) toast(`⚒ ${state.spec.name} forged — rev 1`, "ok");
  } finally {
    btn.disabled = false;
  }
}

/** Re-run everything downstream of the spec. */
async function rebuildProduct({ animate = false, fromStage = 1 } = {}) {
  const spec = state.spec;
  if (!spec) return;
  const st = animate ? (i, f) => runStage(i, f) : (_i, f) => f();
  await st(fromStage + 0, () => layoutSpec(spec));
  let model;
  await st(fromStage + 1, () => { model = buildDeckModel(spec); });
  await st(fromStage + 2, () => buildElectronics(spec));
  await st(fromStage + 3, () => buildPCB(spec));
  await st(fromStage + 4, () => { state.firmware = generateFirmware(spec); });
  await st(fromStage + 5, () => buildBOM(spec));
  await st(fromStage + 6, async () => {
    setModel(model);
    await sleep(60);
    state.renderURL = snapshot(1100, 620);
  });
  renderAllPanes();
  updateViewerDims();
}

function verEntry(spec, changes) {
  return { rev: spec.rev, date: new Date().toLocaleString(), name: spec.name, changes, clone: structuredClone(plainSpec(spec)) };
}
function plainSpec(spec) {
  const { derived, ...rest } = spec;
  return structuredClone(rest);
}

// ================================================================ mode switching
function setMode(mode, { keepInput = false } = {}) {
  state.mode = mode;
  $$(".mode-tab").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  $("#ability-panel").classList.toggle("hidden", mode !== "product");
  $("#modules-panel").classList.toggle("hidden", mode !== "product");
  $("#wood-panel").classList.toggle("hidden", mode !== "woodworking");
  $("#repair-panel").classList.toggle("hidden", mode !== "repair");
  $("#inventor-panel").classList.toggle("hidden", mode !== "inventor");
  paintStages(mode);

  const show = {
    product: ["overview", "model", "electronics", "pcb", "firmware", "bom", "assembly", "versions"],
    woodworking: ["overview", "model", "bom", "assembly"],
    repair: ["overview", "model"],
    inventor: ["overview"],
  }[mode];
  const labels = {
    product: { bom: "BOM", assembly: "Assembly", overview: "Overview" },
    woodworking: { bom: "Cut list", assembly: "Joinery & finish", overview: "Plan" },
    repair: { overview: "Repair plan" },
    inventor: { overview: "Concepts" },
  }[mode];
  $$(".ws-tab").forEach(t => {
    const id = t.dataset.tab;
    t.style.display = show.includes(id) ? "" : "none";
    t.textContent = labels?.[id] || t.dataset.label || t.textContent;
    t.dataset.label = t.dataset.label || t.textContent;
  });
  if (!show.includes(activeTab())) selectTab("overview");

  const ph = {
    product: EXAMPLES[0],
    woodworking: "Design a desk around this walnut slab for a client who wants cable management and a monitor riser.",
    repair: "The tumble-dryer door latch snapped — recreate the broken clip.",
    inventor: "I cannot comfortably use a normal keyboard with one hand.",
  }[mode];
  if (!keepInput) $("#prompt-input").placeholder = ph;
  $("#btn-inspect").disabled = mode !== "product";
}

// ================================================================ forge dispatcher
async function forge() {
  const text = $("#prompt-input").value.trim() || $("#prompt-input").placeholder;
  if (state.mode === "product") return forgeProduct(text);
  if (state.mode === "woodworking") return forgeWood(text);
  if (state.mode === "repair") return forgeRepair(text);
  if (state.mode === "inventor") return forgeInventor(text);
}

// ================================================================ woodworking flow
async function forgeWood() {
  paintStages("woodworking");
  const cfg = {
    type: $("#wood-type").value,
    l: +$("#wood-l").value || 1800,
    w: +$("#wood-w").value || 700,
    t: +$("#wood-t").value || 45,
    species: $("#wood-species").value,
  };
  let plan, model;
  await runStage(0, () => {});
  await runStage(1, () => { model = buildWoodModel(cfg, WOOD[cfg.species].color); });
  await runStage(2, () => { plan = woodPlan(cfg); });
  await runStage(3, () => {});
  await runStage(4, () => {});
  await runStage(5, () => {});
  await runStage(6, async () => {
    setModel(model);
    await sleep(60);
    state.renderURL = snapshot(1100, 620);
  });
  state.wood = { cfg, plan };
  renderWoodPanes();
  toast(`🪵 ${plan.name} designed — ${plan.priceStr} suggested price`, "ok");
}

// ================================================================ repair flow
async function forgeRepair() {
  paintStages("repair");
  const type = $("#repair-type").value;
  const refMM = +$("#repair-ref").value || 30;
  let model, plan;
  await runStage(0, () => {});
  await runStage(1, () => { plan = repairPlan(type, refMM); });
  await runStage(2, () => { model = buildRepairPart(type, { ref: refMM }); });
  await runStage(3, async () => {
    setModel(model);
    await sleep(60);
    state.renderURL = snapshot(1100, 620);
  });
  state.repair = { type, refMM, plan };
  renderRepairPanes();
  toast(`🔧 Replacement ${plan.name.toLowerCase()} rebuilt — ${plan.grams} g, ${plan.minutes} min print`, "ok");
}

// ================================================================ inventor flow
async function forgeInventor(problem) {
  paintStages("inventor");
  state.inventor.problem = problem;
  let concepts;
  await runStage(0, () => {});
  await runStage(1, async () => {
    if (hasKey()) {
      try { concepts = await generateConceptsAI(problem); }
      catch (e) { toast("AI concepts failed (" + e.message + ") — offline set", "err"); concepts = conceptsOffline(problem); }
    } else concepts = conceptsOffline(problem);
  });
  await runStage(2, () => {
    scoreConcepts(concepts, {
      use: +$("#w-use").value, cost: +$("#w-cost").value, mfg: +$("#w-mfg").value,
    });
  });
  await runStage(3, () => {});
  state.inventor.concepts = concepts;
  renderInventorPane();
  selectTab("overview");
  toast(`💡 ${concepts.length} competing solutions generated`, "ok");
}

// ================================================================ pane renderers
function renderAllPanes() {
  renderOverview();
  renderElectronicsPane();
  renderPCBPane();
  renderFirmwarePane();
  renderBOMPane();
  renderAssemblyPane();
  paintVersions();
}

function renderOverview() {
  const s = state.spec;
  if (!s || state.mode !== "product") return;
  const d = s.derived;
  const rows = buildBOM(s);
  $("#pane-overview").innerHTML = `
    <div class="ov-hero"><div class="ov-title">
      <h2>${esc(s.name)}</h2>
      <div class="ov-tagline">${esc(s.tagline)}</div>
      <div>
        <span class="ov-badge">REV ${s.rev}</span>
        <span class="ov-badge">${s.ability.hand.toUpperCase()} HAND</span>
        <span class="ov-badge">${hasKey() ? "FABLE 5 DESIGN" : "OFFLINE ENGINE"}</span>
        <span class="ov-badge">ESP32-S3 · USB HID + BLE</span>
      </div>
    </div></div>
    <div class="stat-grid">
      ${stat("DECK", `${d.deck.w.toFixed(0)}×${d.deck.d.toFixed(0)}`, "mm footprint")}
      ${stat("KEYS", d.keyTotal, "hot-swap MX")}
      ${stat("DIALS", s.modules.encoders.count, "EC11 + alu knobs")}
      ${stat("PARTS COST", money(bomTotal(rows)), rows.length + " line items")}
      ${stat("PRINT", d.printTimeH + " h", d.printGrams + " g PETG")}
      ${stat("ASSEMBLY", d.assemblyMin + " min", s.geometry.snapFit ? "snap-fit lid" : "6 screws")}
      ${stat("MATRIX", d.matrix.rows + "×" + d.matrix.cols, d.keyTotal + " diodes")}
      ${stat("PEDALS", s.modules.pedals.count || "—", s.geometry.jackEdge + " jacks")}
    </div>
    ${s.aiNotes?.length ? `<div class="ov-section"><h3>ENGINEERING DECISIONS (FABLE 5)</h3>
      <div class="doc"><ul>${s.aiNotes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div></div>` : ""}
    <div class="ov-section"><h3>PRODUCT RENDER</h3>
      <div class="ov-render">${state.renderURL ? `<img src="${state.renderURL}">` : ""}</div>
    </div>`;
}
const stat = (l, v, sub) => `<div class="stat-card"><div class="st-label">${l}</div><div class="st-value">${v}</div><div class="st-sub">${sub}</div></div>`;

function renderElectronicsPane() {
  if (!state.spec?.derived?.elec) return;
  $("#pane-electronics").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn" id="dl-schematic">⬇ schematic.svg</button>
      <span class="hint">Block schematic — nets labelled with real ESP32-S3 GPIO assignments.</span>
    </div>
    <div class="svg-holder">${schematicSVG(state.spec)}</div>`;
  $("#dl-schematic").onclick = () => download(fname("schematic.svg"), schematicSVG(state.spec), "image/svg+xml");
}

function renderPCBPane() {
  if (!state.spec?.derived?.pcb) return;
  $("#pane-pcb").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn accent" id="dl-gerber">⬇ Gerber + drill (.zip)</button>
      <span class="hint">2-layer · red = top copper (columns) · blue = bottom copper (rows) · comb-autorouted v1, DRC before fab.</span>
    </div>
    <div class="svg-holder">${pcbSVG(state.spec)}</div>`;
  $("#dl-gerber").onclick = exportGerbers;
}

function renderFirmwarePane() {
  if (!state.firmware) return;
  const lines = state.firmware.split("\n").length;
  $("#pane-firmware").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn accent" id="dl-fw">⬇ ${fname("firmware.ino")}</button>
      <span class="hint">${lines} lines · ESP32-S3 Arduino · TinyUSB HID keyboard + mouse + consumer · ${state.spec.profiles.length} profiles</span>
    </div>
    <pre class="code">${highlightC(state.firmware)}</pre>`;
  $("#dl-fw").onclick = () => download(fname("firmware.ino"), state.firmware, "text/plain");
}

function renderBOMPane() {
  const s = state.spec;
  if (!s) return;
  const rows = buildBOM(s);
  $("#pane-bom").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn accent" id="dl-bom">⬇ ${fname("bom.csv")}</button>
      <span class="spacer"></span>
      <span class="hint">Every part is a real, orderable component with MPN and supplier link.</span>
    </div>
    <table class="grid">
      <tr><th>REF</th><th>QTY</th><th>PART</th><th>MPN</th><th>SUPPLIER</th><th class="right">UNIT</th><th class="right">EXT</th></tr>
      ${rows.map(r => `<tr>
        <td class="mono">${r.part.ref}</td><td class="mono">${r.qty}</td>
        <td>${r.part.name}<div class="hint" style="margin:2px 0 0">${r.part.note}</div></td>
        <td class="mono">${r.part.mpn}</td>
        <td><a href="${r.part.url}" target="_blank" rel="noopener">${r.part.supplier} ↗</a></td>
        <td class="right mono">${money(r.part.unit)}</td><td class="right mono">${money(r.ext)}</td>
      </tr>`).join("")}
      <tr><td colspan="6"><b>TOTAL — one unit, single-qty pricing</b></td><td class="right mono"><b>${money(bomTotal(rows))}</b></td></tr>
    </table>`;
  $("#dl-bom").onclick = () => download(fname("bom.csv"), bomCSV(s), "text/csv");
}

function renderAssemblyPane() {
  const s = state.spec;
  if (!s?.derived?.elec) return;
  const steps = assemblySteps(s);
  const tests = testProcedure(s);
  const total = steps.reduce((a, x) => a + x.mins, 0);
  $("#pane-assembly").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn accent" id="dl-manual">⬇ ${fname("manual.html")}</button>
      <button class="bar-btn" id="dl-wiring">⬇ wiring.svg</button>
      <span class="hint">${steps.length} steps · ~${total} min after printing</span>
    </div>
    <div class="doc">
      <h2>Assembly — ${esc(s.name)} rev ${s.rev}</h2>
      ${steps.map((st, i) => `<div class="step"><span class="step-time">${st.mins ? st.mins + " min" : "printer"}</span>
        <h4>${i + 1}. ${st.title}</h4><p>${st.body}</p><div class="step-parts">PARTS: ${st.parts}</div></div>`).join("")}
      <h2>Wiring diagram</h2>
      <div class="svg-holder">${wiringSVG(s)}</div>
      <h2>Testing procedure</h2>
      <ol>${tests.map(t => `<li>${t}</li>`).join("")}</ol>
    </div>`;
  $("#dl-manual").onclick = () => download(fname("manual.html"), manualHTML(s), "text/html");
  $("#dl-wiring").onclick = () => download(fname("wiring.svg"), wiringSVG(s), "image/svg+xml");
}

function paintVersions() {
  const strip = $("#ver-strip");
  strip.innerHTML = state.versions.map(v =>
    `<span class="ver-pill ${state.spec && v.rev === state.spec.rev ? "current" : ""}" data-rev="${v.rev}">rev ${v.rev}</span>`).join("");
  strip.querySelectorAll(".ver-pill").forEach(p => p.onclick = () => restoreRev(+p.dataset.rev));

  $("#pane-versions").innerHTML = `
    <div class="doc"><h2>Version history</h2></div>
    ${[...state.versions].reverse().map(v => `
      <div class="ver-card ${state.spec && v.rev === state.spec.rev ? "current" : ""}">
        <div class="ver-num">R${v.rev}</div>
        <div class="ver-body">
          <h4>${esc(v.name)}</h4>
          <div class="ver-date">${v.date}</div>
          <ul>${v.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
        </div>
        <button class="bar-btn ver-restore" data-rev="${v.rev}">${state.spec && v.rev === state.spec.rev ? "current" : "restore"}</button>
      </div>`).join("")}`;
  $("#pane-versions").querySelectorAll(".ver-restore").forEach(b => b.onclick = () => restoreRev(+b.dataset.rev));
}

async function restoreRev(rev) {
  const v = state.versions.find(x => x.rev === rev);
  if (!v || (state.spec && state.spec.rev === rev)) return;
  state.spec = structuredClone(v.clone);
  await rebuildProduct({ animate: false });
  syncModulePanel();
  toast(`Restored rev ${rev}`, "ok");
}

// ---------------- wood panes ----------------
function renderWoodPanes() {
  const { cfg, plan } = state.wood;
  $("#pane-overview").innerHTML = `
    <div class="ov-hero"><div class="ov-title">
      <h2>${esc(plan.name)}</h2>
      <div class="ov-tagline">Designed around your ${cfg.l}×${cfg.w}×${cfg.t} mm ${plan.species.name.toLowerCase()} slab.</div>
      <div><span class="ov-badge">WOODWORKING</span><span class="ov-badge">${plan.bf} BF NET</span><span class="ov-badge">CLIENT-READY</span></div>
    </div></div>
    <div class="stat-grid">
      ${stat("MATERIALS", money(plan.materials), plan.bfBuy + " BF w/ waste")}
      ${stat("SHOP TIME", plan.hours + " h", "make + finish")}
      ${stat("SUGGESTED PRICE", plan.priceStr, "materials×1.15 + $65/h")}
      ${stat("WEIGHT", "~" + plan.weightKg + " kg", "wood only")}
    </div>
    <div class="ov-section"><h3>CLIENT RENDER</h3>
      <div class="ov-render">${state.renderURL ? `<img src="${state.renderURL}">` : ""}</div></div>
    <div class="ov-section"><h3>CNC</h3><div class="doc"><p>${plan.cncNote}</p></div></div>`;

  $("#pane-bom").innerHTML = `
    <div class="pane-toolbar"><span class="hint">Cut list — dimensions in mm, ${plan.species.name} @ ${money(plan.species.bf)}/BF</span></div>
    <table class="grid">
      <tr><th>PIECE</th><th>QTY</th><th class="right">L</th><th class="right">W</th><th class="right">T</th><th>MATERIAL</th><th>NOTE</th></tr>
      ${plan.cuts.map(c => `<tr><td>${c.name}</td><td class="mono">${c.qty}</td>
        <td class="right mono">${c.l}</td><td class="right mono">${c.w}</td><td class="right mono">${c.t}</td>
        <td>${c.mat}</td><td class="hint">${c.note}</td></tr>`).join("")}
    </table>`;

  $("#pane-assembly").innerHTML = `
    <div class="doc">
      <h2>Joinery & finishing</h2>
      ${plan.joinery.map((j, i) => `<div class="step"><h4>${i + 1}.</h4><p>${j}</p></div>`).join("")}
      <h2>Exploded view</h2><p>Use the 3D tab's EXPLODE slider for the client walkthrough.</p>
    </div>`;
}

// ---------------- repair panes ----------------
function renderRepairPanes() {
  const { plan } = state.repair;
  $("#pane-overview").innerHTML = `
    <div class="ov-hero"><div class="ov-title">
      <h2>Replacement: ${esc(plan.name)}</h2>
      <div class="ov-tagline">Recreated from reference dimension ${plan.refMM.toFixed(1)} mm.</div>
      <div><span class="ov-badge">REPAIR MODE</span><span class="ov-badge">${plan.material}</span></div>
    </div></div>
    <div class="stat-grid">
      ${stat("MATERIAL", plan.grams + " g", plan.material)}
      ${stat("PRINT TIME", plan.minutes + " min", "0.2 mm layers")}
      ${stat("COST", money(plan.cost), "vs buying: usually 10-50×")}
      ${stat("REF DIM", plan.refMM + " mm", plan.ref)}
    </div>
    <div class="ov-section"><h3>RENDER</h3>
      <div class="ov-render">${state.renderURL ? `<img src="${state.renderURL}">` : ""}</div></div>
    <div class="ov-section"><h3>REPAIR PLAN</h3><div class="doc">
      ${plan.steps.map((s, i) => `<div class="step"><h4>${i + 1}.</h4><p>${s}</p></div>`).join("")}
    </div></div>`;
}

// ---------------- inventor pane ----------------
function renderInventorPane() {
  const inv = state.inventor;
  $("#pane-overview").innerHTML = `
    <div class="ov-hero"><div class="ov-title">
      <h2>Competing solutions</h2>
      <div class="ov-tagline">“${esc(inv.problem)}”</div>
      <div><span class="ov-badge">INVENTOR MODE</span><span class="ov-badge">${hasKey() ? "FABLE 5 CONCEPTS" : "OFFLINE CONCEPTS"}</span></div>
    </div></div>
    <div class="concept-grid" style="margin-top:18px">
      ${inv.concepts.map((c, i) => `
        <div class="concept-card ${i === 0 ? "winner" : ""}">
          <div class="c-total">${c.total}</div>
          <h4>${i === 0 ? "🏆 " : ""}${esc(c.name)}</h4>
          <div class="c-desc">${esc(c.description)}</div>
          ${scoreBar("USABILITY", c.usability)}
          ${scoreBar("COST", c.cost)}
          ${scoreBar("BUILD", c.manufacturability)}
          <div class="c-actions">
            <button data-forge="${i}">⚒ Forge this</button>
            ${i > 0 ? `<button data-merge="${i}">＋ Merge into winner</button>` : ""}
          </div>
        </div>`).join("")}
    </div>
    <p class="hint" style="margin-top:14px">Forging a concept switches to Product Mode and runs the full pipeline on its design sentence. Merging splices a runner-up's strongest feature into the winner's sentence.</p>`;
  $("#pane-overview").querySelectorAll("[data-forge]").forEach(b =>
    b.onclick = () => { $("#prompt-input").value = inv.concepts[+b.dataset.forge].sentence; forgeProduct(inv.concepts[+b.dataset.forge].sentence); });
  $("#pane-overview").querySelectorAll("[data-merge]").forEach(b =>
    b.onclick = () => {
      const w = inv.concepts[0], m = inv.concepts[+b.dataset.merge];
      const merged = `${w.sentence} Also incorporate the best feature of "${m.name}": ${m.description.split(".")[0]}.`;
      $("#prompt-input").value = merged;
      toast("Concepts merged — hit FORGE IT", "ok");
    });
}
const scoreBar = (l, v) => `<div class="score-bar"><span class="sb-label">${l}</span><span class="sb-track"><span class="sb-fill" style="width:${v}%"></span></span><span class="sb-num">${v}</span></div>`;

// ================================================================ inspection
function wireInspection() {
  const modal = $("#inspect-modal");
  $("#btn-inspect").onclick = () => {
    if (!state.spec) return toast("Forge a product first", "err");
    resetInspect();
    modal.showModal();
  };
  $("#inspect-close").onclick = () => modal.close();
  const drop = $("#inspect-drop");
  const fileIn = $("#inspect-file");
  drop.onclick = () => fileIn.click();
  drop.ondragover = e => e.preventDefault();
  drop.ondrop = e => { e.preventDefault(); if (e.dataTransfer.files[0]) loadInspectFile(e.dataTransfer.files[0]); };
  fileIn.onchange = () => fileIn.files[0] && loadInspectFile(fileIn.files[0]);
  $("#inspect-run").onclick = runInspection;
  $("#inspect-rev").onclick = generateRevision;
}
function resetInspect() {
  state.inspectImage = null; state.lastReport = null;
  $("#inspect-preview").innerHTML = "Drop a photo here, or tap to open the camera";
  $("#inspect-report").classList.add("hidden");
  $("#inspect-rev").classList.add("hidden");
  $("#inspect-run").disabled = !hasKey();     // demo mode can run without a photo
  if (!hasKey()) $("#inspect-run").disabled = false;
}
function loadInspectFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    const dataURL = rd.result;
    state.inspectImage = {
      dataURL,
      b64: dataURL.split(",")[1],
      mediaType: file.type || "image/jpeg",
    };
    $("#inspect-preview").innerHTML = `<img src="${dataURL}">`;
    $("#inspect-run").disabled = false;
  };
  rd.readAsDataURL(file);
}
async function runInspection() {
  const btn = $("#inspect-run");
  btn.disabled = true; btn.textContent = "Inspecting…";
  try {
    let report;
    if (hasKey() && state.inspectImage) {
      report = await inspectPrototypeAI(state.inspectImage.b64, state.inspectImage.mediaType, state.spec);
    } else {
      await sleep(1100);
      report = inspectPrototypeDemo(state.spec);
      if (!state.inspectImage) toast("No photo — running simulated inspection of rev " + state.spec.rev, "");
    }
    state.lastReport = report;
    const sev = { major: "finding-bad", minor: "finding-warn", info: "finding-ok" };
    $("#inspect-report").innerHTML =
      `<b>PROTOTYPE INSPECTION — rev ${state.spec.rev}</b>\n\n` +
      report.findings.map(f => `<span class="${sev[f.severity]}">▸ ${esc(f.observation)}</span>\n   FIX: ${esc(f.fix)}`).join("\n\n") +
      `\n\n<b>${esc(report.summary)}</b>`;
    $("#inspect-report").classList.remove("hidden");
    if (report.recommendRevision) $("#inspect-rev").classList.remove("hidden");
  } catch (e) {
    toast("Inspection failed: " + e.message, "err");
  } finally {
    btn.disabled = false; btn.textContent = "🔍 Inspect";
  }
}
async function generateRevision() {
  const report = state.lastReport;
  if (!report) return;
  const applied = applyPatches(state.spec, report.findings);
  $("#inspect-modal").close();
  if (!applied.length) return toast("Nothing to change — design already optimal", "ok");
  paintStages("product");
  await rebuildProduct({ animate: true, fromStage: 1 });
  state.versions.push(verEntry(state.spec, applied));
  paintVersions();
  toast(`⚒ Revision ${state.spec.rev} generated — ${applied.length} design changes`, "ok");
  selectTab("versions");
}

// ================================================================ exports
async function doExport(kind) {
  const s = state.spec;
  const model = (await import("./viewer.js")).getModel();
  const need = m => { toast(m, "err"); };
  switch (kind) {
    case "stl": {
      if (!model) return need("Nothing to export yet");
      const printedOnly = state.mode === "product";
      const buf = toSTL(model, printedOnly ? printedPartFilter : () => true);
      download(fname("enclosure.stl"), buf); break;
    }
    case "gerber": return s?.derived?.pcb ? exportGerbers() : need("Forge a product first");
    case "firmware": return state.firmware ? download(fname("firmware.ino"), state.firmware, "text/plain") : need("Forge a product first");
    case "bom": return s ? download(fname("bom.csv"), bomCSV(s), "text/csv") : need("Forge a product first");
    case "manual": return s?.derived?.elec ? download(fname("manual.html"), manualHTML(s), "text/html") : need("Forge a product first");
    case "wiring": return s?.derived?.elec ? download(fname("wiring.svg"), wiringSVG(s), "image/svg+xml") : need("Forge a product first");
    case "schematic": return s?.derived?.elec ? download(fname("schematic.svg"), schematicSVG(s), "image/svg+xml") : need("Forge a product first");
    case "site": return s ? download(fname("site.html"), productSiteHTML(s, state.renderURL), "text/html") : need("Forge a product first");
    case "all": {
      if (!s?.derived?.elec || !model) return need("Forge a product first");
      const files = {
        [fname("enclosure.stl")]: toSTL(model, printedPartFilter),
        [fname("firmware.ino")]: generateFirmware(s),
        [fname("bom.csv")]: bomCSV(s),
        [fname("manual.html")]: manualHTML(s),
        [fname("wiring.svg")]: wiringSVG(s),
        [fname("schematic.svg")]: schematicSVG(s),
        [fname("site.html")]: productSiteHTML(s, state.renderURL),
      };
      for (const [n, c] of Object.entries(gerberFiles(s))) files["gerber/" + n] = c;
      download(fname("complete.zip"), makeZip(files));
      toast("Complete manufacturing package exported", "ok");
      break;
    }
  }
}
function exportGerbers() {
  download(fname("gerbers.zip"), makeZip(gerberFiles(state.spec)));
}
function fname(suffix) {
  const base = state.mode === "product" && state.spec ? state.spec.name : state.mode === "woodworking" ? (state.wood?.plan.name || "wood") : state.mode === "repair" ? "repair-part" : "forge";
  return base.toLowerCase().replace(/\W+/g, "-") + "-rev" + (state.spec?.rev || 1) + "-" + suffix;
}

// ================================================================ wiring: UI events
function wireHeader() {
  $$(".mode-tab").forEach(b => b.onclick = () => {
    setMode(b.dataset.mode);
    $("#prompt-input").value = "";
  });
}
function wireCommandBar() {
  $("#btn-forge").onclick = forge;
  const inp = $("#prompt-input");
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); forge(); }
  });
  inp.addEventListener("input", () => {
    inp.style.height = "auto";
    inp.style.height = Math.min(120, inp.scrollHeight) + "px";
  });
}
function buildExampleChips() {
  $("#example-chips").innerHTML = EXAMPLES.map((e, i) => `<button class="chip" data-i="${i}">${e.slice(0, 64)}…</button>`).join("");
  $$(".chip").forEach(c => c.onclick = () => {
    $("#prompt-input").value = EXAMPLES[+c.dataset.i];
    forge();
  });
}

function wireSidebar() {
  // hand
  $("#seg-hand").querySelectorAll("button").forEach(b => b.onclick = () => {
    $("#seg-hand").querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    liveRelayout();
  });
  // fingers
  $("#finger-picker").querySelectorAll("button").forEach(b => b.onclick = () => {
    b.classList.toggle("active");
    liveRelayout();
  });
  // reach
  $("#reach-range").oninput = () => {
    $("#reach-val").textContent = $("#reach-range").value + " mm";
    liveRelayoutDebounced();
  };
  // inventor weights
  for (const [id, lbl] of [["w-use", "w-use-val"], ["w-cost", "w-cost-val"], ["w-mfg", "w-mfg-val"]]) {
    $("#" + id).oninput = () => $("#" + lbl).textContent = $("#" + id).value + "%";
  }
  // wood/repair photos
  $("#wood-photo").onchange = e => $("#wood-photo-name").textContent = e.target.files[0]?.name || "";
  $("#repair-photo").onchange = e => $("#repair-photo-name").textContent = e.target.files[0]?.name || "";
  ["repair-type", "repair-ref"].forEach(id => $("#" + id).addEventListener("change", () => state.repair && forgeRepair()));
}

let relayoutT = null;
function liveRelayoutDebounced() { clearTimeout(relayoutT); relayoutT = setTimeout(liveRelayout, 250); }
async function liveRelayout() {
  if (state.mode !== "product" || !state.spec) return;
  state.spec.ability = readAbilityPanel(state.spec.ability);
  await rebuildProduct({ animate: false });
}
function readAbilityPanel(cur) {
  const hand = $("#seg-hand button.active")?.dataset.v || cur.hand;
  const fingers = {};
  $("#finger-picker").querySelectorAll("button").forEach(b => fingers[b.dataset.f] = b.classList.contains("active"));
  return { hand, fingers, reachMM: +$("#reach-range").value };
}

function syncModulePanel() {
  const s = state.spec;
  if (!s) return;
  // reflect ability into the panel
  $("#seg-hand").querySelectorAll("button").forEach(b => b.classList.toggle("active", b.dataset.v === s.ability.hand));
  $("#finger-picker").querySelectorAll("button").forEach(b => b.classList.toggle("active", !!s.ability.fingers[b.dataset.f]));
  $("#reach-range").value = s.ability.reachMM;
  $("#reach-val").textContent = s.ability.reachMM + " mm";

  const m = s.modules;
  const mods = [
    { id: "keys", ico: "⌨", name: "Macro keys", qty: m.keys.count, on: m.keys.count > 0 },
    { id: "encoders", ico: "🎛", name: "Rotary dials", qty: m.encoders.count, on: m.encoders.count > 0 },
    { id: "trackball", ico: "🖱", name: "Thumb trackball", qty: "", on: m.trackball.present },
    { id: "oled", ico: "📟", name: "OLED screen", qty: "", on: m.oled.present },
    { id: "pedals", ico: "🦶", name: "Foot pedals", qty: m.pedals.count, on: m.pedals.count > 0 },
    { id: "voiceButton", ico: "🎤", name: "Voice key", qty: "", on: m.voiceButton },
    { id: "kvmKeys", ico: "🖥", name: "KVM cluster", qty: m.kvmKeys, on: m.kvmKeys > 0 },
    { id: "magnets", ico: "🧲", name: "Magnetic modules", qty: "", on: m.magnets },
  ];
  $("#module-toggles").innerHTML = mods.map(x => `
    <div class="mod-toggle ${x.on ? "on" : "off"}" data-id="${x.id}">
      <span class="mod-ico">${x.ico}</span><span class="mod-name">${x.name}</span>
      ${x.qty !== "" ? `<span class="mod-qty" data-q="${x.id}">${x.qty}</span>` : `<span class="mod-qty">${x.on ? "on" : "off"}</span>`}
    </div>`).join("");
  $("#module-toggles").querySelectorAll(".mod-toggle").forEach(el => {
    el.onclick = (ev) => {
      const id = el.dataset.id;
      const qtyClicked = ev.target.dataset?.q;
      mutateModule(id, !!qtyClicked);
    };
  });
}
async function mutateModule(id, bumpQty) {
  const m = state.spec.modules;
  const bump = (v, max, min = 0) => (v + 1 > max ? min : v + 1);
  switch (id) {
    case "keys": m.keys.count = bumpQty ? bump(m.keys.count, 24, 4) : (m.keys.count ? 0 : 12); break;
    case "encoders": m.encoders.count = bumpQty ? bump(m.encoders.count, 4) : (m.encoders.count ? 0 : 2); break;
    case "trackball": m.trackball.present = !m.trackball.present; break;
    case "oled": m.oled.present = !m.oled.present; break;
    case "pedals": m.pedals.count = bumpQty ? bump(m.pedals.count, 4) : (m.pedals.count ? 0 : 3); break;
    case "voiceButton": m.voiceButton = !m.voiceButton; break;
    case "kvmKeys": m.kvmKeys = bumpQty ? bump(m.kvmKeys, 6) : (m.kvmKeys ? 0 : 4); break;
    case "magnets": m.magnets = !m.magnets; break;
  }
  syncModulePanel();
  await rebuildProduct({ animate: false });
}

function wireWorkspaceTabs() {
  $$(".ws-tab").forEach(t => t.onclick = () => selectTab(t.dataset.tab));
}
function selectTab(id) {
  $$(".ws-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === id));
  $$(".ws-pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + id));
}
function activeTab() { return $(".ws-tab.active")?.dataset.tab || "overview"; }

function wireViewerHUD() {
  $("#explode-range").oninput = e => setExplode(+e.target.value / 100);
  const modes = { "btn-view-solid": "solid", "btn-view-xray": "xray", "btn-view-wire": "wire" };
  for (const [id, m] of Object.entries(modes)) {
    $("#" + id).onclick = () => {
      $$("#viewer-hud .hud-btn").forEach(b => ["btn-view-solid", "btn-view-xray", "btn-view-wire"].includes(b.id) && b.classList.remove("active"));
      $("#" + id).classList.add("active");
      setViewMode(m);
    };
  }
  $("#btn-view-spin").onclick = () => {
    setSpin(!isSpin());
    $("#btn-view-spin").classList.toggle("active", isSpin());
  };
}
function updateViewerDims() {
  const s = state.spec;
  if (!s?.derived?.deck || state.mode !== "product") { $("#viewer-dims").innerHTML = ""; return; }
  const d = s.derived;
  $("#viewer-dims").innerHTML =
    `${esc(s.name)} · rev ${s.rev}<br>` +
    `${d.deck.w.toFixed(1)} × ${d.deck.d.toFixed(1)} × ${(d.deck.h + s.geometry.plateMM).toFixed(1)} mm<br>` +
    `${d.keyTotal} keys · ${s.modules.encoders.count} dials · ${d.matrix.rows}×${d.matrix.cols} matrix`;
}

function wireFooter() {
  const dd = $(".dropdown");
  $("#btn-export").onclick = e => { e.stopPropagation(); dd.classList.toggle("open"); };
  document.addEventListener("click", () => dd.classList.remove("open"));
  $("#export-menu").querySelectorAll("button").forEach(b => b.onclick = e => {
    e.stopPropagation(); dd.classList.remove("open"); doExport(b.dataset.x);
  });
}

function wireSettings() {
  const modal = $("#settings-modal");
  $("#btn-settings").onclick = () => {
    const s = getSettings();
    $("#set-apikey").value = s.apiKey;
    $("#set-model").value = s.model;
    modal.showModal();
  };
  $("#set-cancel").onclick = () => modal.close();
  $("#set-save").onclick = () => {
    saveSettings({ apiKey: $("#set-apikey").value.trim(), model: $("#set-model").value });
    modal.close();
    refreshAIStatus();
    toast(hasKey() ? "Claude connected — generation & inspection now AI-powered" : "Running on the offline engine", "ok");
  };
}
function refreshAIStatus() {
  const el = $("#ai-status");
  if (hasKey()) {
    el.textContent = getSettings().model.replace("claude-", "").toUpperCase();
    el.classList.add("online");
  } else {
    el.textContent = "OFFLINE ENGINE";
    el.classList.remove("online");
  }
}

// ================================================================ misc
function toast(msg, cls = "") {
  const t = document.createElement("div");
  t.className = "toast " + cls;
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; }, 3800);
  setTimeout(() => t.remove(), 4300);
}
function esc(t) { return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

// ================================================================ boot
window.addEventListener("unhandledrejection", e => toast("Error: " + (e.reason?.message || e.reason), "err"));
window.addEventListener("error", e => toast("Error: " + e.message, "err"));

initViewer($("#viewer-canvas"));
buildExampleChips();
wireHeader();
wireCommandBar();
wireSidebar();
wireWorkspaceTabs();
wireViewerHUD();
wireFooter();
wireSettings();
wireInspection();
refreshAIStatus();

// forge the flagship on load so the app never opens empty
forgeProduct(EXAMPLES[0], { silent: true });
