// ============ THE FORGE v2 — bounded invention platform (application shell) ============
import { defaultSpec, interpretOffline, SPEC_SCHEMA, specFromAI, EXAMPLES, deckConcepts } from "./spec.js";
import { layoutSpec } from "./layout.js";
import { buildDeckModel, buildRepairPart, buildWoodModel } from "./geometry.js";
import { initViewer, setModel, getModel, setExplode, setSpin, isSpin, setMode as setViewMode, snapshot, onPick } from "./viewer.js";
import { buildElectronics, schematicSVG, wiringSVG } from "./electronics.js";
import { buildPCB, pcbSVG, gerberFiles } from "./pcb.js";
import { generateFirmware, highlightC } from "./firmware.js";
import { download, toSTL, printedPartFilter, makeZip, bomCSV, assemblySteps, testProcedure, manualHTML, productSiteHTML } from "./exports.js";
import { buildBOM, bomTotal, money, WOOD } from "./catalog.js";
import { getSettings, saveSettings, hasKey, generateSpecAI, inspectPrototypeAI, inspectPrototypeDemo, applyPatches, parseEditOffline, parseEditAI, applyEditOps } from "./claude.js";
import { woodPlan, repairPlan, REPAIR_TYPES } from "./modes.js";
import { screenRequest, refusalDocument, rateSpec, exportPolicy, LEVELS } from "./complexity.js";
import { deriveRequirements, deriveSimpleRequirements, criticalUnknowns, conflicts, acceptanceTests, CATEGORIES } from "./requirements.js";
import { dfmFDM, clearanceChecks, elecChecks, firmwareConsistency, engineeringCalcs, computeGates } from "./validation.js";
import { deckDrawingSVG, partDrawingSVG, plateDXF, toDXF, to3MF, toSTEP } from "./drawings.js";
import { PART_TYPES, partDFM } from "./partlib.js";
import { BOARDS, ENCLOSURE_PRESETS, buildEnclosure, enclosurePlan, enclosureBOM, enclosureDFM } from "./enclosure.js";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = t => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ================================================================ state
const state = {
  mode: "product",
  spec: null,                 // deck-family spec
  firmware: "",
  renderURL: null,
  project: {                  // v2 engineering project state
    requirements: [],
    complexity: null,
    concepts: [],
    conceptsPending: false,
    conceptChosen: null,
    checks: [],
    calcs: [],
    gates: [],
    dfmAcked: false,
    reviewAcknowledged: false,
    exportedOnce: false,
    blocked: null,
  },
  versions: [],
  wood: null,
  repair: null,
  part: { type: "bracket", params: {}, model: null, plan: null },
  enc: { cfg: null, model: null, plan: null },
  inspectImage: null,
  lastReport: null,
};

const DECK_MODES = ["product", "electronics", "access"];
const isDeckMode = () => DECK_MODES.includes(state.mode);

// ================================================================ pipeline UI
const STAGES = {
  product: ["Safety screen", "Interpret intent", "Requirements", "Complexity rating", "Design concepts", "Ergonomic layout", "Mechanical design", "Electronics", "PCB routing", "Firmware", "Validation", "Docs & renders"],
  electronics: null, access: null,     // filled below (same as product)
  part: ["Parameters", "Complexity rating", "Geometry", "DFM validation", "Drawing & exports"],
  enclosure: ["Configuration", "Complexity rating", "Geometry", "DFM validation", "BOM & docs"],
  woodworking: ["Read stock", "Design around stock", "Cut list", "Joinery plan", "Estimate & price", "Renders"],
  repair: ["Identify part", "Scale from reference", "Rebuild geometry", "Print plan"],
};
STAGES.electronics = STAGES.product;
STAGES.access = STAGES.product;

function paintStages(mode) {
  $("#pipeline-stages").innerHTML = STAGES[mode]
    .map(s => `<li><span class="st-dot"></span>${s}<span class="st-ms"></span></li>`).join("");
}
async function runStage(i, fn) {
  const li = $$("#pipeline-stages li")[i];
  if (!li) return fn?.();
  li.className = "run";
  const t0 = performance.now();
  await sleep(70 + Math.random() * 180);
  const out = await fn?.();
  li.className = "done";
  li.querySelector(".st-ms").textContent = `${Math.round(performance.now() - t0)}ms`;
  return out;
}

// ================================================================ deck-family flow
async function forgeDeck(sentence, { silent = false, autoConcept = false } = {}) {
  paintStages(state.mode);
  const P = state.project;
  Object.assign(P, { concepts: [], conceptsPending: false, conceptChosen: null, checks: [], calcs: [], dfmAcked: false, reviewAcknowledged: false, exportedOnce: false, blocked: null });
  const btn = $("#btn-forge");
  btn.disabled = true;
  try {
    // stage 0: safety screen (Level 5 policy)
    let hit;
    await runStage(0, () => { hit = screenRequest(sentence); });
    if (hit) {
      P.blocked = refusalDocument(sentence, hit);
      P.complexity = { level: 5, ...LEVELS[5], reasons: [`L5: ${hit.why}`], factors: {} };
      state.spec = null;
      renderOverview(); paintCxChip(); selectTab("overview");
      toast("Request outside supported scope — see Overview", "err");
      return;
    }
    // stage 1: interpret
    let spec;
    await runStage(1, async () => {
      if (hasKey()) {
        try {
          const ai = await generateSpecAI(sentence, SPEC_SCHEMA);
          spec = specFromAI(ai, sentence);
          spec.aiUsed = true;
        } catch (e) {
          if (!silent) toast("AI interpret failed (" + e.message + ") — offline engine", "err");
          spec = interpretOffline(sentence);
        }
      } else spec = interpretOffline(sentence);
      if (state.mode === "access") { spec.access = true; }
      if (state.mode === "electronics") { spec.layoutStyle = "grid"; spec.modules.trackball.present = false; }
      spec.ability = readAbilityPanel(spec.ability);
      state.spec = spec;
      syncModulePanel(); syncParamPanel();
    });
    // stage 2: requirements
    await runStage(2, () => { P.requirements = deriveRequirements(state.spec, sentence); });
    // stage 3: complexity (pre-generation, shown with reasons)
    await runStage(3, () => {
      layoutSpec(state.spec);                    // cheap pre-layout so part counts are real
      P.complexity = rateSpec(state.spec);
      paintCxChip();
    });
    // stage 4: concepts — pipeline pauses here for selection
    await runStage(4, () => {
      P.concepts = deckConcepts(state.spec);
      P.conceptsPending = true;
    });
    renderOverview(); renderRequirements(); paintVersions();
    selectTab("overview");
    if (autoConcept) {
      await chooseConcept(0, { auto: true, silent });
    } else if (!silent) {
      toast("⚒ " + state.spec.name + ": pick a design concept to continue (Gate 2)", "");
    }
  } finally { btn.disabled = false; }
}

async function chooseConcept(idx, { auto = false, silent = false } = {}) {
  const P = state.project;
  const c = P.concepts[idx];
  if (!c) return;
  c.patch(state.spec);
  if (state.mode === "electronics") { state.spec.layoutStyle = "grid"; state.spec.modules.trackball.present = false; }
  P.conceptChosen = { id: c.id, name: c.name, auto };
  P.conceptsPending = false;
  await rebuildDeck({ animate: true, fromStage: 5 });
  state.versions = [verEntry(state.spec, [`Initial generation — concept “${c.name}”${auto ? " (auto-selected for demo — change any time)" : ""}`])];
  state.versions[0].bomTotal = state.spec.derived?.bomTotal;
  paintVersions();
  if (!silent) toast(`Concept “${c.name}” approved — engineering package generated`, "ok");
}

/** Regenerate everything downstream of the deck spec, then validate + gate. */
async function rebuildDeck({ animate = false, fromStage = 5 } = {}) {
  const spec = state.spec;
  if (!spec) return;
  const st = animate ? (i, f) => runStage(i, f) : (_i, f) => f();
  let model;
  await st(fromStage + 0, () => layoutSpec(spec));
  await st(fromStage + 1, () => { model = buildDeckModel(spec); });
  await st(fromStage + 2, () => buildElectronics(spec));
  await st(fromStage + 3, () => buildPCB(spec));
  await st(fromStage + 4, () => { state.firmware = generateFirmware(spec); });
  await st(fromStage + 5, () => runValidation());
  await st(fromStage + 6, async () => {
    spec.derived.bomTotal = bomTotal(buildBOM(spec));
    setModel(model);
    await sleep(60);
    state.renderURL = snapshot(1100, 620);
  });
  refreshGates();
  renderAllPanes();
  updateViewerDims();
}

function runValidation() {
  const spec = state.spec, P = state.project;
  P.checks = [...dfmFDM(spec), ...clearanceChecks(spec), ...elecChecks(spec), ...firmwareConsistency(spec, state.firmware)];
  P.calcs = engineeringCalcs(spec);
  P.complexity = rateSpec(spec);
  paintCxChip();
}

function refreshGates() {
  const P = state.project;
  P.gates = computeGates({ spec: state.spec, requirements: P.requirements, complexity: P.complexity, conceptChosen: P.conceptChosen, checks: P.checks, calcs: P.calcs, exportedOnce: P.exportedOnce, reviewAcknowledged: P.reviewAcknowledged, dfmAcked: P.dfmAcked });
}

function verEntry(spec, changes, impact = null) {
  return { rev: spec.rev, date: new Date().toLocaleString(), name: spec.name, changes, impact, clone: structuredClone(plainSpec(spec)) };
}
function plainSpec(spec) { const { derived, ...rest } = spec; return structuredClone(rest); }

function recordRevision(reason, changes) {
  const spec = state.spec;
  const prev = state.versions[state.versions.length - 1];
  spec.rev += 1;
  const impact = {
    affected: ["layout", "enclosure CAD", "PCB", "firmware", "BOM", "drawings", "validation", "docs"],
    costDelta: prev?.clone && spec.derived?.bomTotal != null && prev.bomTotal != null ? spec.derived.bomTotal - prev.bomTotal : null,
  };
  const e = verEntry(spec, changes, impact);
  e.reason = reason;
  e.bomTotal = spec.derived?.bomTotal;
  state.versions.push(e);
  paintVersions();
}

// ================================================================ other-mode flows
async function forgePart() {
  paintStages("part");
  const P = state.project;
  Object.assign(P, { conceptsPending: false, conceptChosen: { name: PART_TYPES[state.part.type].name }, checks: [], calcs: [], blocked: null, dfmAcked: false, reviewAcknowledged: true, exportedOnce: false });
  const t = PART_TYPES[state.part.type];
  const p = readPartParams();
  await runStage(0, () => { P.requirements = deriveSimpleRequirements("part", { typeName: t.name, params: p, process: t.process }); });
  await runStage(1, () => { P.complexity = rateSpec({ singlePart: true, modules: {}, geometry: {} }); paintCxChip(); });
  let model;
  await runStage(2, () => { model = t.build(p); state.part.model = model; state.part.plan = t.plan(p); });
  await runStage(3, () => { P.checks = partDFM(state.part.type, p, state.spec?.printerBedMM || 220); });
  await runStage(4, async () => {
    setModel(model); await sleep(60);
    state.renderURL = snapshot(1100, 620);
  });
  refreshGates();
  renderOverview(); renderRequirements(); renderEngineering();
  toast(`🔩 ${t.name} generated — L${P.complexity.level}, drawing + STL/STEP/DXF ready`, "ok");
}

async function forgeEnclosure() {
  paintStages("enclosure");
  const P = state.project;
  const cfg = readEnclosureCfg();
  Object.assign(P, { conceptsPending: false, conceptChosen: { name: "Enclosure: " + (BOARDS[cfg.board]?.name || "custom") }, checks: [], calcs: [], blocked: null, dfmAcked: false, reviewAcknowledged: true, exportedOnce: false });
  await runStage(0, () => { P.requirements = deriveSimpleRequirements("enclosure", cfg); });
  await runStage(1, () => { P.complexity = rateSpec({ partCountOverride: 2, modules: {}, geometry: {} }); paintCxChip(); });
  let model;
  await runStage(2, () => { model = buildEnclosure(cfg); state.enc = { cfg, model, plan: enclosurePlan(cfg) }; });
  await runStage(3, () => { P.checks = enclosureDFM(cfg, state.spec?.printerBedMM || 220); });
  await runStage(4, async () => {
    setModel(model); await sleep(60);
    state.renderURL = snapshot(1100, 620);
  });
  refreshGates();
  renderOverview(); renderRequirements(); renderEngineering(); renderEnclosureBOM(); renderEnclosureAssembly();
  toast(`📦 Enclosure generated — base + lid, ${P.checks.filter(c => c.sev === "fail").length ? "DFM issues found" : "DFM clean"}`, "ok");
}

async function forgeWood() {
  paintStages("woodworking");
  const P = state.project;
  const cfg = { type: $("#wood-type").value, l: +$("#wood-l").value || 1800, w: +$("#wood-w").value || 700, t: +$("#wood-t").value || 45, species: $("#wood-species").value };
  Object.assign(P, { conceptsPending: false, conceptChosen: { name: cfg.type }, checks: [], calcs: [], blocked: null, reviewAcknowledged: true, exportedOnce: false });
  let plan, model;
  await runStage(0, () => {});
  await runStage(1, () => { model = buildWoodModel(cfg, WOOD[cfg.species].color); });
  await runStage(2, () => { plan = woodPlan(cfg); });
  await runStage(3, () => { P.requirements = deriveSimpleRequirements("wood", { typeName: plan.name, speciesName: plan.species.name }); });
  await runStage(4, () => { P.complexity = rateSpec({ partCountOverride: cfg.type === "jig" ? 3 : 4, modules: {}, geometry: {} }); paintCxChip(); });
  await runStage(5, async () => { setModel(model); await sleep(60); state.renderURL = snapshot(1100, 620); });
  state.wood = { cfg, plan };
  refreshGates();
  renderWoodPanes(); renderRequirements();
  toast(`🪵 ${plan.name} — ${plan.priceStr} suggested price`, "ok");
}

async function forgeRepair() {
  paintStages("repair");
  const P = state.project;
  const type = $("#repair-type").value;
  const refMM = +$("#repair-ref").value || 30;
  Object.assign(P, { conceptsPending: false, conceptChosen: { name: "Replacement " + type }, checks: [], calcs: [], blocked: null, reviewAcknowledged: true, exportedOnce: false });
  let model, plan;
  await runStage(0, () => { plan = repairPlan(type, refMM); });
  await runStage(1, () => { P.complexity = rateSpec({ singlePart: true, modules: {}, geometry: {} }); paintCxChip(); });
  await runStage(2, () => { model = buildRepairPart(type, { ref: refMM }); });
  await runStage(3, async () => { setModel(model); await sleep(60); state.renderURL = snapshot(1100, 620); });
  state.repair = { type, refMM, plan };
  P.requirements = deriveSimpleRequirements("part", { typeName: plan.name, params: { ref: refMM }, process: "FDM printing" });
  refreshGates();
  renderRepairPanes(); renderRequirements();
  toast(`🔧 ${plan.name} rebuilt — ${plan.grams} g, ${plan.minutes} min print`, "ok");
}

// ================================================================ dispatcher
let _busy = false;
async function guard(fn) {
  if (_busy) return;
  _busy = true;
  try { await fn(); } finally { _busy = false; }
}
async function forge() {
  const text = $("#prompt-input").value.trim() || $("#prompt-input").placeholder;
  return guard(() => {
    if (isDeckMode()) return forgeDeck(text);
    if (state.mode === "part") return forgePart();
    if (state.mode === "enclosure") return forgeEnclosure();
    if (state.mode === "woodworking") return forgeWood();
    if (state.mode === "repair") return forgeRepair();
  });
}

// ================================================================ mode switching
const MODE_TABS = {
  product: ["overview", "requirements", "model", "engineering", "electronics", "pcb", "firmware", "bom", "assembly", "versions"],
  electronics: ["overview", "requirements", "model", "engineering", "electronics", "pcb", "firmware", "bom", "assembly", "versions"],
  access: ["overview", "requirements", "model", "engineering", "electronics", "pcb", "firmware", "bom", "assembly", "versions"],
  part: ["overview", "requirements", "model", "engineering"],
  enclosure: ["overview", "requirements", "model", "engineering", "bom", "assembly"],
  woodworking: ["overview", "requirements", "model", "bom", "assembly"],
  repair: ["overview", "requirements", "model"],
};
const MODE_PLACEHOLDER = {
  product: EXAMPLES[0],
  electronics: "A desktop button panel with 12 keys, 2 dials and an OLED for stream control.",
  access: "Create a customizable command deck for a person with one functional hand controlling two computers, with foot controls.",
  part: "Configure the part with the parameters on the left, then Forge.",
  enclosure: "Pick a preset or set dimensions on the left, then Forge.",
  woodworking: "Design a desk around this walnut slab — or pick the jig type for a shop fixture.",
  repair: "The dryer door latch snapped — recreate the broken clip.",
};

function setMode(mode) {
  state.mode = mode;
  $$(".mode-tab").forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  const deck = isDeckMode();
  $("#ability-panel").classList.toggle("hidden", !(mode === "product" || mode === "access"));
  $("#modules-panel").classList.toggle("hidden", !deck);
  $("#params-panel").classList.toggle("hidden", !deck);
  $("#edit-panel").classList.toggle("hidden", !deck);
  $("#part-panel").classList.toggle("hidden", mode !== "part");
  $("#enclosure-panel").classList.toggle("hidden", mode !== "enclosure");
  $("#wood-panel").classList.toggle("hidden", mode !== "woodworking");
  $("#repair-panel").classList.toggle("hidden", mode !== "repair");
  paintStages(mode);
  const show = MODE_TABS[mode];
  $$(".ws-tab").forEach(t => { t.style.display = show.includes(t.dataset.tab) ? "" : "none"; });
  if (!show.includes(activeTab())) selectTab("overview");
  $("#prompt-input").placeholder = MODE_PLACEHOLDER[mode];
  $("#btn-inspect").disabled = !deck;
}

// ================================================================ overview pane
function paintCxChip() {
  const c = state.project.complexity;
  const el = $("#cx-chip");
  if (!c) { el.textContent = "L–"; el.style.color = ""; return; }
  el.textContent = "L" + c.level + " · " + c.name.toUpperCase();
  el.style.color = c.color;
  el.style.borderColor = c.color + "66";
}

function gateStrip() {
  const gs = state.project.gates || [];
  if (!gs.length) return "";
  return `<div class="gate-strip">${gs.map(g => `
    <div class="gate ${g.pass ? "pass" : "open"}" title="${esc(g.blockers.join("\n"))}">
      <span class="g-n">GATE ${g.n} ${g.pass ? "✓" : "○"}</span>
      <span class="g-name">${g.name}</span>
      ${!g.pass && g.blockers.length ? `<div class="g-block">${esc(g.blockers[0])}${g.blockers.length > 1 ? ` (+${g.blockers.length - 1})` : ""}</div>` : ""}
    </div>`).join("")}</div>`;
}

function complexityCard() {
  const c = state.project.complexity;
  if (!c) return "";
  return `<div class="cx-card" style="color:${c.color}">
    <div class="cx-badge">L${c.level}</div>
    <div class="cx-body" style="color:var(--text)">
      <h4>Design Complexity Rating: Level ${c.level} — ${c.name}</h4>
      <div class="cx-policy">${c.policy}</div>
      <ul>${c.reasons.map(r => `<li>${esc(r)}</li>`).join("")}</ul>
    </div>
  </div>`;
}

function conceptCards() {
  const P = state.project;
  if (!P.concepts.length) return "";
  const pending = P.conceptsPending;
  return `<div class="ov-section"><h3>DESIGN CONCEPTS ${pending ? "— SELECT ONE TO CONTINUE (GATE 2)" : ""}</h3>
  <div class="concept-grid">
  ${P.concepts.map((c, i) => `
    <div class="concept-card ${P.conceptChosen?.id === c.id ? "winner" : ""}">
      <h4>${P.conceptChosen?.id === c.id ? "✓ " : ""}${esc(c.name)}</h4>
      <div class="c-desc"><b>${esc(c.form)}</b><br>${esc(c.method)}</div>
      <div class="hint" style="margin-top:6px">PARTS ${c.estParts} · ${c.estCost} · ${esc(c.process)}</div>
      <div class="hint" style="margin-top:4px">＋ ${c.adv.map(esc).join(" · ")}</div>
      <div class="hint" style="margin-top:2px">－ ${c.trade.map(esc).join(" · ")}</div>
      <div class="hint" style="margin-top:2px">♿ ${esc(c.access)}</div>
      <div class="c-actions"><button data-concept="${i}">${P.conceptChosen?.id === c.id ? "Re-generate with this" : "⚒ Select & generate"}</button></div>
    </div>`).join("")}
  </div></div>`;
}

function renderOverview() {
  const P = state.project;
  const pane = $("#pane-overview");
  if (P.blocked) {
    pane.innerHTML = `${complexityCard()}
      <div class="blocked-card"><h3>⛔ ${esc(P.blocked.title)}</h3><pre>${esc(P.blocked.body)}</pre></div>`;
    return;
  }
  if (isDeckMode() && state.spec) {
    const s = state.spec, d = s.derived || {};
    const rows = d.deck ? buildBOM(s) : null;
    pane.innerHTML = `
      <div class="ov-hero"><div class="ov-title">
        <h2>${esc(s.name)}</h2>
        <div class="ov-tagline">${esc(s.tagline)}</div>
        <div>
          <span class="ov-badge">REV ${s.rev}</span>
          <span class="ov-badge">${s.ability.hand.toUpperCase()} HAND</span>
          <span class="ov-badge">${s.aiUsed ? "FABLE 5 DESIGN" : "OFFLINE ENGINE"}</span>
          ${P.conceptChosen ? `<span class="ov-badge">CONCEPT: ${esc(P.conceptChosen.name.toUpperCase())}</span>` : ""}
        </div>
      </div></div>
      ${complexityCard()}
      ${P.complexity?.level === 4 ? `<div class="l4-banner">⚠ EXPERT REVIEW REQUIRED BEFORE MANUFACTURING — files export as PRELIMINARY.</div>` : ""}
      ${gateStrip()}
      ${conceptCards()}
      ${d.deck ? `
      <div class="stat-grid">
        ${stat("DECK", `${d.deck.w.toFixed(0)}×${d.deck.d.toFixed(0)}`, "mm footprint")}
        ${stat("KEYS", d.keyTotal, s.layoutStyle === "grid" ? "grid panel" : "ergonomic fan")}
        ${stat("PARTS COST", money(bomTotal(rows)), rows.length + " line items")}
        ${stat("PRINT", d.printTimeH + " h", d.printGrams + " g PETG")}
        ${stat("ASSEMBLY", d.assemblyMin + " min", s.geometry.snapFit ? "snap-fit lid" : "6 screws")}
        ${stat("VALIDATION", `${P.checks.filter(c => c.sev === "pass").length}✓ ${P.checks.filter(c => c.sev === "warn").length}⚠ ${P.checks.filter(c => c.sev === "fail").length}✗`, "checks run")}
      </div>
      ${s.aiNotes?.length ? `<div class="ov-section"><h3>ENGINEERING DECISIONS (FABLE 5)</h3><div class="doc"><ul>${s.aiNotes.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div></div>` : ""}
      <div class="ov-section"><h3>PRODUCT RENDER — visualization of the parametric CAD (the CAD is the source of truth)</h3>
        <div class="ov-render">${state.renderURL ? `<img src="${state.renderURL}">` : ""}</div></div>` : ""}`;
  } else if (state.mode === "part" && state.part.plan) {
    const t = PART_TYPES[state.part.type];
    pane.innerHTML = `
      <div class="ov-hero"><div class="ov-title">
        <h2>${esc(t.name)}</h2>
        <div class="ov-tagline">Parametric single part — every dimension explicit, regenerated from ${t.params.length} parameters.</div>
        <div><span class="ov-badge">PART MODE</span><span class="ov-badge">${esc(t.material)}</span><span class="ov-badge">${esc(t.process)}</span></div>
      </div></div>
      ${complexityCard()}
      ${gateStrip()}
      <div class="stat-grid">
        ${stat("ENVELOPE", `${state.part.plan.w.toFixed(0)}×${state.part.plan.d.toFixed(0)}×${state.part.plan.h.toFixed(0)}`, "mm")}
        ${stat("EXPORTS", "STL · 3MF · STEP · DXF", "+ drawing")}
        ${stat("DFM", `${state.project.checks.filter(c => c.sev === "pass").length}✓ ${state.project.checks.filter(c => c.sev === "fail").length}✗`, "process checks")}
      </div>
      <div class="ov-section"><h3>DIMENSIONED DRAWING</h3>
        <div class="svg-holder">${partDrawingSVG(t.name, 1, t.material, t.process, state.part.plan)}</div></div>`;
  } else if (state.mode === "enclosure" && state.enc.plan) {
    const cfg = state.enc.cfg;
    pane.innerHTML = `
      <div class="ov-hero"><div class="ov-title">
        <h2>${esc(BOARDS[cfg.board]?.name || "Custom")} Enclosure</h2>
        <div class="ov-tagline">Base + lid, ${cfg.vents ? "ventilated" : "sealed"}${cfg.fan ? `, ${cfg.fan} mm fan` : ""}${cfg.wallMount ? ", wall-mount" : ""}${cfg.gland ? ", M12 bottom gland" : ""}.</div>
        <div><span class="ov-badge">ENCLOSURE MODE</span><span class="ov-badge">${state.enc.plan.w.toFixed(0)}×${state.enc.plan.d.toFixed(0)}×${state.enc.plan.h.toFixed(0)} MM</span></div>
      </div></div>
      ${complexityCard()}
      ${gateStrip()}
      <div class="ov-section"><h3>RENDER</h3><div class="ov-render">${state.renderURL ? `<img src="${state.renderURL}">` : ""}</div></div>
      <div class="ov-section"><h3>DIMENSIONED DRAWING</h3>
        <div class="svg-holder">${partDrawingSVG("Enclosure assembly", 1, "PETG", "FDM printing", state.enc.plan)}</div></div>`;
  } else if (state.mode === "woodworking" && state.wood) {
    renderWoodOverview();
  } else if (state.mode === "repair" && state.repair) {
    renderRepairOverview();
  } else {
    pane.innerHTML = `<div class="doc"><h2>THE FORGE</h2><p>Describe what you need, pick a mode, and hit FORGE IT. The pipeline converts plain language into requirements, rates the design complexity, generates bounded parametric CAD, validates manufacturability, and produces the files and instructions needed to build it.</p></div>`;
  }
  pane.querySelectorAll("[data-concept]").forEach(b => b.onclick = () => chooseConcept(+b.dataset.concept));
}
const stat = (l, v, sub) => `<div class="stat-card"><div class="st-label">${l}</div><div class="st-value">${v}</div><div class="st-sub">${sub}</div></div>`;

// ================================================================ requirements pane
function renderRequirements() {
  const P = state.project;
  const pane = $("#pane-requirements");
  if (!P.requirements.length) { pane.innerHTML = `<div class="doc"><p>Forge something first.</p></div>`; return; }
  const crit = criticalUnknowns(P.requirements);
  const confl = state.spec ? conflicts(P.requirements, state.spec) : [];
  const tests = acceptanceTests(P.requirements);
  let html = `<div class="doc"><h2>Requirements — ${P.requirements.filter(r => r.status === "confirmed").length} confirmed · ${P.requirements.filter(r => r.status === "assumption").length} assumptions · ${P.requirements.filter(r => r.status === "unknown").length} unknown</h2>
  <p class="hint">A design cannot reach manufacturing-ready status while critical unknowns remain (${crit.length} open — Gate 1).</p></div>`;
  for (const c of confl) html += `<div class="conflict-box">⚠ ${esc(c)}</div>`;
  for (const cat of CATEGORIES) {
    const rows = P.requirements.filter(r => r.cat === cat);
    if (!rows.length) continue;
    html += `<div class="ov-section"><h3>${cat.toUpperCase()}</h3>`;
    for (const r of rows) {
      html += `<div class="req-row">
        <span class="req-status ${r.status}">${r.status.toUpperCase()}${r.critical && r.status === "unknown" ? " · CRITICAL" : ""}</span>
        <div style="flex:1">${esc(r.text)}${r.answer ? ` — <b>${esc(r.answer)}</b>` : ""}
          ${r.status === "unknown" && r.question ? `<div class="req-q">${esc(r.question)}<br>${r.options.map(o => `<button class="q-opt" data-req="${r.id}" data-a="${esc(o)}">${esc(o)}</button>`).join("")}</div>` : ""}
        </div>
      </div>`;
    }
    html += `</div>`;
  }
  if (tests.length) {
    html += `<div class="ov-section"><h3>ACCEPTANCE TESTS — derived directly from requirements</h3>
    <table class="grid"><tr><th>REQUIREMENT</th><th>TEST</th></tr>
    ${tests.map(t => `<tr><td>${esc(t.req)}</td><td>${esc(t.test)}</td></tr>`).join("")}</table></div>`;
  }
  pane.innerHTML = html;
  pane.querySelectorAll(".q-opt").forEach(b => b.onclick = () => answerRequirement(b.dataset.req, b.dataset.a));
}

async function answerRequirement(reqId, answer) {
  const P = state.project;
  const r = P.requirements.find(x => x.id === reqId);
  if (!r) return;
  r.status = "confirmed";
  r.answer = answer;
  if (r.apply && state.spec) r.apply(state.spec, answer);
  toast(`Requirement confirmed: ${answer}`, "ok");
  if (isDeckMode() && state.spec?.derived?.deck) {
    await rebuildDeck({ animate: false });
  } else { refreshGates(); }
  renderRequirements(); renderOverview();
}

// ================================================================ engineering pane
function renderEngineering() {
  const P = state.project;
  const pane = $("#pane-engineering");
  if (!P.checks.length && !P.calcs.length) { pane.innerHTML = `<div class="doc"><p>Forge something first — validation runs automatically.</p></div>`; return; }
  const areas = [...new Set(P.checks.map(c => c.area))];
  const warnCount = P.checks.filter(c => c.sev === "warn").length;
  let html = `<div class="doc"><h2>Engineering validation</h2>
    <p class="hint">Values are labelled by how they were obtained. The Forge never fabricates a calculation to make a design look complete — unknown inputs are named instead.</p></div>`;
  if (P.complexity?.level === 3 && !P.reviewAcknowledged) {
    html += `<div class="l4-banner" style="border-color:#ffcc4d66;color:#ffe9b0">
      GATE 6 — DESIGN REVIEW CHECKPOINT (Level 3): read the checks and calculations below, then
      <button id="btn-review-ok" class="bar-btn accent" style="margin-left:8px">Confirm design review</button></div>`;
  }
  if (P.complexity?.level === 3 && P.reviewAcknowledged) html += `<div class="hint" style="margin-bottom:10px">✓ Design review confirmed for rev ${state.spec?.rev ?? "—"}.</div>`;
  for (const a of areas) {
    const rows = P.checks.filter(c => c.area === a);
    html += `<div class="ov-section"><h3>${a.toUpperCase()} — ${rows.filter(r => r.sev === "pass").length}/${rows.length} pass</h3>`;
    for (const c of rows) html += `<div class="check-row"><span class="check-dot ${c.sev}"></span><span>${esc(c.text)}</span><span class="check-basis">${esc(c.basis)}</span></div>`;
    html += `</div>`;
  }
  if (warnCount && !P.dfmAcked) {
    html += `<div style="margin:12px 0"><button id="btn-dfm-ack" class="bar-btn">Acknowledge ${warnCount} warning(s) (Gate 4)</button></div>`;
  }
  if (P.calcs.length) {
    html += `<div class="ov-section"><h3>ENGINEERING CALCULATIONS</h3>`;
    for (const c of P.calcs) {
      html += `<div class="calc-card ${c.status === "review" ? "review" : ""}">
        <h4>${esc(c.name)} ${c.status === "review" ? "· NEEDS ATTENTION" : ""}</h4>
        <div class="calc-val">${esc(c.value)}</div>
        <div class="calc-how">${esc(c.how)}</div>
        <ul>${c.assumptions.map(a => `<li>${esc(a)}</li>`).join("")}</ul>
        <div class="calc-note">${esc(c.note)}</div>
      </div>`;
    }
    html += `</div>`;
  }
  pane.innerHTML = html;
  $("#btn-review-ok")?.addEventListener("click", () => { P.reviewAcknowledged = true; refreshGates(); renderEngineering(); renderOverview(); toast("Design review confirmed — Gate 6 passed", "ok"); });
  $("#btn-dfm-ack")?.addEventListener("click", () => { P.dfmAcked = true; refreshGates(); renderEngineering(); renderOverview(); toast("DFM warnings acknowledged — Gate 4", "ok"); });
}

// ================================================================ deck panes (electronics/pcb/firmware/bom/assembly)
function renderAllPanes() {
  renderOverview();
  renderRequirements();
  renderEngineering();
  if (isDeckMode() && state.spec?.derived?.elec) {
    renderElectronicsPane(); renderPCBPane(); renderFirmwarePane(); renderBOMPane(); renderAssemblyPane();
  }
  paintVersions();
}

function renderElectronicsPane() {
  $("#pane-electronics").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn" id="dl-schematic">⬇ schematic.svg</button>
      <span class="hint">Nets labelled with real ESP32-S3 GPIO — strapping/PSRAM/USB pins excluded by the pin allocator and enforced by validation.</span>
    </div>
    <div class="svg-holder">${schematicSVG(state.spec)}</div>`;
  $("#dl-schematic").onclick = () => download(fname("schematic.svg"), schematicSVG(state.spec), "image/svg+xml");
}
function renderPCBPane() {
  $("#pane-pcb").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn accent" id="dl-gerber">⬇ Gerber + drill (.zip)</button>
      <span class="hint">2-layer · red = F.Cu columns · blue = B.Cu rows · comb-autorouted v1 — run KiCad DRC before fab (tracked as a Gate 4 warning).</span>
    </div>
    <div class="svg-holder">${pcbSVG(state.spec)}</div>`;
  $("#dl-gerber").onclick = () => download(fname("gerbers.zip"), makeZip(gerberFiles(state.spec)));
}
function renderFirmwarePane() {
  const lines = state.firmware.split("\n").length;
  const fwChecks = state.project.checks.filter(c => c.area === "Firmware");
  $("#pane-firmware").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn accent" id="dl-fw">⬇ ${fname("firmware.ino")}</button>
      <span class="hint">${lines} lines · TinyUSB HID · ${state.spec.profiles.length} profiles · hardware-consistency: ${fwChecks.every(c => c.sev === "pass") ? "✓ pins match schematic" : "✗ MISMATCH"}</span>
    </div>
    <pre class="code">${highlightC(state.firmware)}</pre>`;
  $("#dl-fw").onclick = () => download(fname("firmware.ino"), state.firmware, "text/plain");
}
function renderBOMPane() {
  const s = state.spec;
  const rows = buildBOM(s);
  $("#pane-bom").innerHTML = `
    <div class="pane-toolbar">
      <button class="bar-btn accent" id="dl-bom">⬇ ${fname("bom.csv")}</button>
      <span class="spacer"></span>
      <span class="hint">Real orderable parts with MPNs. ${s.budgetUSD ? `Budget $${s.budgetUSD} — currently ${money(bomTotal(rows))}.` : ""}</span>
    </div>
    <table class="grid">
      <tr><th>#</th><th>REF</th><th>QTY</th><th>PART</th><th>MPN</th><th>SUPPLIER</th><th class="right">UNIT</th><th class="right">EXT</th></tr>
      ${rows.map((r, i) => `<tr>
        <td class="mono">${i + 1}</td><td class="mono">${r.part.ref}</td><td class="mono">${r.qty}</td>
        <td>${r.part.name}<div class="hint" style="margin:2px 0 0">${r.part.note}</div></td>
        <td class="mono">${r.part.mpn}</td>
        <td><a href="${r.part.url}" target="_blank" rel="noopener">${r.part.supplier} ↗</a></td>
        <td class="right mono">${money(r.part.unit)}</td><td class="right mono">${money(r.ext)}</td>
      </tr>`).join("")}
      <tr><td colspan="7"><b>TOTAL — prototype qty 1</b></td><td class="right mono"><b>${money(bomTotal(rows))}</b></td></tr>
      <tr><td colspan="7">Estimated qty 10 (parts only, ~12 % volume discount)</td><td class="right mono">${money(bomTotal(rows) * 10 * 0.88)}</td></tr>
    </table>`;
  $("#dl-bom").onclick = () => download(fname("bom.csv"), bomCSV(s), "text/csv");
}
function renderAssemblyPane() {
  const s = state.spec;
  const steps = assemblySteps(s);
  const tests = testProcedure(s);
  const atests = acceptanceTests(state.project.requirements);
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
      <h2>Wiring diagram</h2><div class="svg-holder">${wiringSVG(s)}</div>
      <h2>Functional test procedure</h2><ol>${tests.map(t => `<li>${t}</li>`).join("")}</ol>
      <h2>Acceptance tests (from requirements)</h2>
      <table class="grid"><tr><th>REQUIREMENT</th><th>TEST</th></tr>${atests.map(t => `<tr><td>${esc(t.req)}</td><td>${esc(t.test)}</td></tr>`).join("")}</table>
    </div>`;
  $("#dl-manual").onclick = () => download(fname("manual.html"), manualHTML(s), "text/html");
  $("#dl-wiring").onclick = () => download(fname("wiring.svg"), wiringSVG(s), "image/svg+xml");
}

// ================================================================ wood / repair / enclosure panes
function renderWoodOverview() {
  const { cfg, plan } = state.wood;
  $("#pane-overview").innerHTML = `
    <div class="ov-hero"><div class="ov-title">
      <h2>${esc(plan.name)}</h2>
      <div class="ov-tagline">${cfg.type === "jig" ? "Repeatable shop fixture with drill bushing guides." : `Designed around your ${cfg.l}×${cfg.w}×${cfg.t} mm ${plan.species.name.toLowerCase()} stock.`}</div>
      <div><span class="ov-badge">WOODWORKING</span><span class="ov-badge">${plan.bf} BF NET</span></div>
    </div></div>
    ${complexityCard()}
    ${gateStrip()}
    <div class="stat-grid">
      ${stat("MATERIALS", money(plan.materials), plan.bfBuy + " BF w/ waste")}
      ${stat("SHOP TIME", plan.hours + " h", "make + finish")}
      ${stat("SUGGESTED PRICE", plan.priceStr, "materials×1.15 + $65/h")}
      ${stat("WEIGHT", "~" + plan.weightKg + " kg", "wood only")}
    </div>
    <div class="ov-section"><h3>CLIENT RENDER</h3><div class="ov-render">${state.renderURL ? `<img src="${state.renderURL}">` : ""}</div></div>
    <div class="ov-section"><h3>MACHINE GUIDANCE</h3><div class="doc"><p>${plan.cncNote}</p></div></div>`;
}
function renderWoodPanes() {
  renderWoodOverview();
  const { plan } = state.wood;
  $("#pane-bom").innerHTML = `
    <div class="pane-toolbar"><span class="hint">Cut list — mm, ${plan.species.name} @ ${money(plan.species.bf)}/BF</span></div>
    <table class="grid"><tr><th>PIECE</th><th>QTY</th><th class="right">L</th><th class="right">W</th><th class="right">T</th><th>MATERIAL</th><th>NOTE</th></tr>
    ${plan.cuts.map(c => `<tr><td>${c.name}</td><td class="mono">${c.qty}</td><td class="right mono">${c.l}</td><td class="right mono">${c.w}</td><td class="right mono">${c.t}</td><td>${c.mat}</td><td class="hint">${c.note}</td></tr>`).join("")}</table>`;
  $("#pane-assembly").innerHTML = `<div class="doc"><h2>Joinery & finishing</h2>
    ${plan.joinery.map((j, i) => `<div class="step"><h4>${i + 1}.</h4><p>${j}</p></div>`).join("")}
    <h2>Exploded view</h2><p>Use the 3D tab's EXPLODE slider for the walkthrough.</p></div>`;
  paintVersions();
}
function renderRepairOverview() {
  const { plan } = state.repair;
  $("#pane-overview").innerHTML = `
    <div class="ov-hero"><div class="ov-title">
      <h2>Replacement: ${esc(plan.name)}</h2>
      <div class="ov-tagline">Recreated from reference dimension ${plan.refMM.toFixed(1)} mm. Non-safety-critical replacement parts only.</div>
      <div><span class="ov-badge">REPAIR MODE</span><span class="ov-badge">${plan.material}</span></div>
    </div></div>
    ${complexityCard()}
    ${gateStrip()}
    <div class="stat-grid">
      ${stat("MATERIAL", plan.grams + " g", plan.material)}
      ${stat("PRINT TIME", plan.minutes + " min", "0.2 mm layers")}
      ${stat("COST", money(plan.cost), "vs buying: usually 10-50×")}
      ${stat("REF DIM", plan.refMM + " mm", plan.ref)}
    </div>
    <div class="ov-section"><h3>RENDER</h3><div class="ov-render">${state.renderURL ? `<img src="${state.renderURL}">` : ""}</div></div>
    <div class="ov-section"><h3>REPAIR PLAN</h3><div class="doc">${plan.steps.map((s, i) => `<div class="step"><h4>${i + 1}.</h4><p>${s}</p></div>`).join("")}</div></div>`;
}
function renderRepairPanes() { renderRepairOverview(); paintVersions(); }

function renderEnclosureBOM() {
  const rows = enclosureBOM(state.enc.cfg);
  const total = rows.reduce((s, r) => s + r.ext, 0);
  $("#pane-bom").innerHTML = `
    <div class="pane-toolbar"><span class="hint">Enclosure hardware — printed parts excluded (filament listed)</span></div>
    <table class="grid"><tr><th>REF</th><th>QTY</th><th>PART</th><th>SUPPLIER</th><th class="right">EXT</th></tr>
    ${rows.map(r => `<tr><td class="mono">${r.part.ref}</td><td class="mono">${r.qty}</td><td>${r.part.name}<div class="hint">${r.part.note}</div></td><td><a href="${r.part.url}" target="_blank" rel="noopener">${r.part.supplier} ↗</a></td><td class="right mono">${money(r.ext)}</td></tr>`).join("")}
    <tr><td colspan="4"><b>TOTAL</b></td><td class="right mono"><b>${money(total)}</b></td></tr></table>`;
}
function renderEnclosureAssembly() {
  const cfg = state.enc.cfg;
  const steps = [
    ["Print base and lid", "PETG, 0.2 mm layers, flat orientation, no supports. 4 perimeters for gland/wall-mount variants."],
    ["Install inserts", "4× M3 heat-set inserts into the lid bosses at 240 °C."],
    cfg.board !== "none" ? [`Mount the ${BOARDS[cfg.board].name}`, BOARDS[cfg.board].insert === "slot" ? "Slide the DevKit into the printed rails, USB toward the port opening." : `Screw to the standoffs (${BOARDS[cfg.board].insert}).`] : null,
    cfg.gland ? ["Fit the cable gland", "M12 gland through the floor hole, nut torqued inside, drip loop outside."] : null,
    cfg.fan ? ["Mount the fan", `${cfg.fan} mm fan under the lid grille, M3 self-tappers into the pilot holes, blowing OUT.`] : null,
    ["Route cables and close", "Dress cables clear of standoffs; drive the 4 lid screws."],
    cfg.wallMount ? ["Wall-mount", "2× #8 screws into studs/anchors through the keyhole tabs; hang and lock down."] : null,
  ].filter(Boolean);
  $("#pane-assembly").innerHTML = `<div class="doc"><h2>Assembly</h2>
    ${steps.map((s, i) => `<div class="step"><h4>${i + 1}. ${s[0]}</h4><p>${s[1]}</p></div>`).join("")}
    <h2>Checks</h2><ol>
    <li>All mating connectors insert with the lid closed.</li>
    ${cfg.fan ? "<li>Fan spins free; airflow exits the grille.</li>" : ""}
    ${cfg.gland ? "<li>Gland grips the cable — a firm tug must not move it.</li>" : ""}
    </ol></div>`;
}

// ================================================================ versions
function paintVersions() {
  const strip = $("#ver-strip");
  strip.innerHTML = state.versions.map(v =>
    `<span class="ver-pill ${state.spec && v.rev === state.spec.rev ? "current" : ""}" data-rev="${v.rev}">rev ${v.rev}</span>`).join("");
  strip.querySelectorAll(".ver-pill").forEach(p => p.onclick = () => restoreRev(+p.dataset.rev));
  $("#pane-versions").innerHTML = `
    <div class="doc"><h2>Revision history</h2><p class="hint">Every change records the request, affected artifacts, and cost impact. Restoring re-generates the full package from the stored specification.</p></div>
    ${[...state.versions].reverse().map(v => `
      <div class="ver-card ${state.spec && v.rev === state.spec.rev ? "current" : ""}">
        <div class="ver-num">R${v.rev}</div>
        <div class="ver-body">
          <h4>${esc(v.name)}</h4>
          <div class="ver-date">${v.date}${v.reason ? " · " + esc(v.reason) : ""}</div>
          <ul>${v.changes.map(c => `<li>${esc(c)}</li>`).join("")}</ul>
          ${v.impact ? `<div class="hint" style="margin-top:5px">Affected: ${v.impact.affected.join(", ")}${v.impact.costDelta != null ? ` · cost ${v.impact.costDelta >= 0 ? "+" : ""}${money(v.impact.costDelta)}` : ""}</div>` : ""}
        </div>
        <button class="bar-btn ver-restore" data-rev="${v.rev}">${state.spec && v.rev === state.spec.rev ? "current" : "restore"}</button>
      </div>`).join("")}`;
  $("#pane-versions").querySelectorAll(".ver-restore").forEach(b => b.onclick = () => restoreRev(+b.dataset.rev));
}
async function restoreRev(rev) {
  const v = state.versions.find(x => x.rev === rev);
  if (!v || (state.spec && state.spec.rev === rev)) return;
  state.spec = structuredClone(v.clone);
  await rebuildDeck({ animate: false });
  syncModulePanel(); syncParamPanel();
  toast(`Restored rev ${rev} — full package regenerated`, "ok");
}

// ================================================================ inspection (unchanged mechanics, revision impact added)
function wireInspection() {
  const modal = $("#inspect-modal");
  $("#btn-inspect").onclick = () => {
    if (!state.spec?.derived?.deck) return toast("Forge a product first", "err");
    resetInspect(); modal.showModal();
  };
  $("#inspect-close").onclick = () => modal.close();
  const drop = $("#inspect-drop"), fileIn = $("#inspect-file");
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
  $("#inspect-run").disabled = false;
}
function loadInspectFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    state.inspectImage = { dataURL: rd.result, b64: rd.result.split(",")[1], mediaType: file.type || "image/jpeg" };
    $("#inspect-preview").innerHTML = `<img src="${rd.result}">`;
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
  } catch (e) { toast("Inspection failed: " + e.message, "err"); }
  finally { btn.disabled = false; btn.textContent = "🔍 Inspect"; }
}
async function generateRevision() {
  const report = state.lastReport;
  if (!report) return;
  const prevTotal = state.spec.derived?.bomTotal;
  const applied = applyPatches(state.spec, report.findings);
  $("#inspect-modal").close();
  if (!applied.length) return toast("Nothing to change — design already optimal", "ok");
  state.spec.rev -= 1;             // applyPatches bumped; recordRevision will re-bump with impact
  paintStages(state.mode);
  await rebuildDeck({ animate: true, fromStage: 5 });
  recordRevision("Prototype inspection findings", applied);
  state.project.reviewAcknowledged = false;   // a new rev needs a fresh review at L3
  refreshGates(); renderOverview();
  toast(`⚒ Revision ${state.spec.rev} generated — ${applied.length} design changes`, "ok");
  selectTab("versions");
}

// ================================================================ exports
async function doExport(kind) {
  const s = state.spec;
  const model = getModel();
  const P = state.project;
  const pol = P.complexity ? exportPolicy(P.complexity.level) : { allowed: true };
  const need = m => toast(m, "err");
  if (!pol.allowed) return need("Export blocked: unsupported design class (Level 5)");
  const prelim = P.complexity?.level === 4 ? "PRELIMINARY-" : "";

  switch (kind) {
    case "stl": {
      if (!model) return need("Nothing to export yet");
      const filter = isDeckMode() ? printedPartFilter : () => true;
      return download(prelim + fname("print.stl"), toSTL(model, filter));
    }
    case "3mf": {
      if (!model) return need("Nothing to export yet");
      const filter = isDeckMode() ? printedPartFilter : () => true;
      return download(prelim + fname("print.3mf"), makeZip(to3MF(model, filter, fname(""))));
    }
    case "step": {
      if (!model) return need("Nothing to export yet");
      const filter = isDeckMode() ? printedPartFilter : () => true;
      return download(prelim + fname("model.step"), toSTEP(model, filter, fname("").replace(/-+$/, "").toUpperCase()), "text/plain");
    }
    case "dxf": {
      if (isDeckMode() && s?.derived?.deck) return download(fname("plate.dxf"), plateDXF(s), "application/dxf");
      if (state.mode === "part" && state.part.plan) {
        const pl = state.part.plan;
        const ents = [{ type: "poly", closed: true, pts: pl.outline || [[0, 0], [pl.w, 0], [pl.w, pl.d], [0, pl.d]] },
          ...(pl.holes || []).map(h => ({ type: "circle", x: h.x, y: h.y, r: h.r }))];
        return download(fname("flat.dxf"), toDXF(ents), "application/dxf");
      }
      return need("DXF export needs a plate or flat part");
    }
    case "drawing": {
      if (isDeckMode() && s?.derived?.deck) return download(fname("drawing.svg"), deckDrawingSVG(s), "image/svg+xml");
      if (state.mode === "part" && state.part.plan) {
        const t = PART_TYPES[state.part.type];
        return download(fname("drawing.svg"), partDrawingSVG(t.name, 1, t.material, t.process, state.part.plan), "image/svg+xml");
      }
      if (state.mode === "enclosure" && state.enc.plan)
        return download(fname("drawing.svg"), partDrawingSVG("Enclosure assembly", 1, "PETG", "FDM", state.enc.plan), "image/svg+xml");
      return need("Nothing to draw yet");
    }
    case "gerber": return s?.derived?.pcb ? download(fname("gerbers.zip"), makeZip(gerberFiles(s))) : need("Forge a product first");
    case "firmware": return state.firmware ? download(fname("firmware.ino"), state.firmware, "text/plain") : need("Forge a product first");
    case "bom": return s?.derived?.deck ? download(fname("bom.csv"), bomCSV(s), "text/csv") : need("Forge a product first");
    case "manual": return s?.derived?.elec ? download(fname("manual.html"), manualHTML(s), "text/html") : need("Forge a product first");
    case "wiring": return s?.derived?.elec ? download(fname("wiring.svg"), wiringSVG(s), "image/svg+xml") : need("Forge a product first");
    case "schematic": return s?.derived?.elec ? download(fname("schematic.svg"), schematicSVG(s), "image/svg+xml") : need("Forge a product first");
    case "site": return s ? download(fname("site.html"), productSiteHTML(s, state.renderURL), "text/html") : need("Forge a product first");
    case "all": {
      if (!s?.derived?.elec || !model) return need("Forge a product first");
      refreshGates();
      if (pol.review && !P.reviewAcknowledged) {
        selectTab("engineering");
        return need("Gate 6: confirm the design review checkpoint before the manufacturing package export");
      }
      const openGates = P.gates.filter(g => !g.pass && g.n < 7);
      if (openGates.length) {
        selectTab("overview");
        return need(`Gates open: ${openGates.map(g => g.n + " " + g.name).join(" · ")}`);
      }
      const files = {
        [fname("print.stl")]: toSTL(model, printedPartFilter),
        [fname("print.3mf-model.step")]: toSTEP(model, printedPartFilter, "FORGE-DECK"),
        [fname("plate.dxf")]: plateDXF(s),
        [fname("drawing.svg")]: deckDrawingSVG(s),
        [fname("firmware.ino")]: generateFirmware(s),
        [fname("bom.csv")]: bomCSV(s),
        [fname("manual.html")]: manualHTML(s),
        [fname("wiring.svg")]: wiringSVG(s),
        [fname("schematic.svg")]: schematicSVG(s),
        [fname("site.html")]: productSiteHTML(s, state.renderURL),
      };
      for (const [n, c] of Object.entries(gerberFiles(s))) files["gerber/" + n] = c;
      download(prelim + fname("manufacturing-package.zip"), makeZip(files));
      P.exportedOnce = true;
      refreshGates(); renderOverview();
      toast("Manufacturing package exported — Gate 7 complete ✓", "ok");
      break;
    }
  }
}
function fname(suffix) {
  const base = isDeckMode() && state.spec ? state.spec.name
    : state.mode === "part" ? PART_TYPES[state.part.type].name
    : state.mode === "enclosure" ? "enclosure"
    : state.mode === "woodworking" ? (state.wood?.plan.name || "wood")
    : state.mode === "repair" ? "repair-part" : "forge";
  return (base.toLowerCase().replace(/\W+/g, "-") + "-rev" + (state.spec?.rev || 1) + (suffix ? "-" + suffix : "")).replace(/--+/g, "-");
}

// ================================================================ sidebar: modules / params / edit / part / enclosure
function syncModulePanel() {
  const s = state.spec;
  if (!s) return;
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
    el.onclick = ev => mutateModule(el.dataset.id, !!ev.target.dataset?.q);
  });
}
async function mutateModule(id, bumpQty) {
  const m = state.spec.modules;
  const bump = (v, max, min = 0) => (v + 1 > max ? min : v + 1);
  const before = describeModules(m);
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
  await rebuildDeck({ animate: false });
  recordRevision("Module change", [`${before} → ${describeModules(m)}`]);
}
const describeModules = m => `${m.keys.count}K/${m.encoders.count}E/${m.pedals.count}P${m.trackball.present ? "+TB" : ""}${m.oled.present ? "+OLED" : ""}`;

const DECK_PARAMS = [
  { key: "wallMM", label: "Wall (mm)", min: 1.2, max: 5, step: 0.2 },
  { key: "plateMM", label: "Plate (mm)", min: 2, max: 6, step: 0.5 },
  { key: "deckHeightMM", label: "Height (mm)", min: 14, max: 45, step: 1 },
  { key: "dialClearanceMM", label: "Dial clearance (mm)", min: 2, max: 12, step: 0.5 },
];
function syncParamPanel() {
  const s = state.spec;
  if (!s) return;
  $("#param-rows").innerHTML = DECK_PARAMS.map(p =>
    `<div class="param-row"><label>${p.label}</label>
     <input type="number" data-p="${p.key}" value="${s.geometry[p.key]}" min="${p.min}" max="${p.max}" step="${p.step}"></div>`).join("") +
    `<div class="param-row"><label>Jack edge</label>
      <select data-p="jackEdge"><option value="rear" ${s.geometry.jackEdge === "rear" ? "selected" : ""}>rear</option><option value="side" ${s.geometry.jackEdge === "side" ? "selected" : ""}>side</option></select></div>
     <div class="param-row"><label class="chk"><input type="checkbox" data-p="snapFit" ${s.geometry.snapFit ? "checked" : ""}> Snap-fit lid</label>
      <label class="chk"><input type="checkbox" data-p="usbRibs" ${s.geometry.usbRibs ? "checked" : ""}> USB ribs</label></div>`;
  $("#param-rows").querySelectorAll("[data-p]").forEach(el => {
    el.onchange = async () => {
      const k = el.dataset.p;
      const g = state.spec.geometry;
      const old = g[k];
      g[k] = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? el.value : +el.value;
      await rebuildDeck({ animate: false });
      recordRevision("Parameter edit", [`${k}: ${old} → ${g[k]}`]);
    };
  });
}

async function applyConversationalEdit() {
  const text = $("#edit-input").value.trim();
  if (!text || !state.spec) return;
  const btn = $("#edit-apply");
  btn.disabled = true; btn.textContent = "Parsing…";
  try {
    let result;
    if (hasKey()) {
      try { result = await parseEditAI(text, state.spec); }
      catch { result = parseEditOffline(text); }
    } else result = parseEditOffline(text);
    if (!result.ops?.length) return toast(result.explanation || "No recognized edit", "err");
    const applied = applyEditOps(state.spec, result.ops);
    await rebuildDeck({ animate: false });
    recordRevision(`Edit: “${text}”`, applied);
    syncModulePanel(); syncParamPanel();
    toast(`✏ ${applied.join(" · ")} — validation re-run, rev ${state.spec.rev}`, "ok");
    $("#edit-input").value = "";
  } finally { btn.disabled = false; btn.textContent = "Apply edit"; }
}

function syncPartPanel() {
  const sel = $("#part-type");
  if (!sel.options.length) {
    sel.innerHTML = Object.entries(PART_TYPES).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join("");
    sel.value = state.part.type;
    sel.onchange = () => { state.part.type = sel.value; syncPartPanel(); };
  }
  const t = PART_TYPES[state.part.type];
  $("#part-params").innerHTML = t.params.map(p =>
    `<div class="param-row"><label>${p.label}</label>
     <input type="number" data-pp="${p.key}" value="${state.part.params[p.key] ?? p.def}" min="${p.min}" max="${p.max}" step="${p.step}"></div>`).join("");
  $("#part-meta").textContent = `${t.material} · ${t.process}`;
  $("#part-params").querySelectorAll("[data-pp]").forEach(el => {
    el.onchange = () => { state.part.params[el.dataset.pp] = +el.value; if (state.part.model) guard(forgePart); };
  });
}
function readPartParams() {
  const t = PART_TYPES[state.part.type];
  const p = {};
  for (const par of t.params) p[par.key] = state.part.params[par.key] ?? par.def;
  return p;
}
function readEnclosureCfg() {
  return {
    w: +$("#enc-w").value || 105, d: +$("#enc-d").value || 76, h: +$("#enc-h").value || 40,
    wall: +$("#enc-wall").value || 2.4, board: $("#enc-board").value,
    vents: $("#enc-vents").checked, wallMount: $("#enc-wallmount").checked,
    gland: $("#enc-gland").checked, fan: +$("#enc-fan").value,
    ports: $("#enc-board").value === "pi4"
      ? [{ type: "rj45", edge: "right", at: 0 }, { type: "usbc", edge: "rear", at: -28 }, { type: "usba", edge: "rear", at: 8 }]
      : $("#enc-board").value === "none" ? [] : [{ type: "usbc", edge: "rear", at: 0 }],
  };
}
function applyEnclosurePreset(id) {
  const p = ENCLOSURE_PRESETS[id];
  if (!p) return;
  const c = p.cfg;
  $("#enc-w").value = c.w; $("#enc-d").value = c.d; $("#enc-h").value = c.h;
  $("#enc-wall").value = c.wall; $("#enc-board").value = c.board;
  $("#enc-vents").checked = c.vents; $("#enc-wallmount").checked = c.wallMount;
  $("#enc-gland").checked = c.gland; $("#enc-fan").value = String(c.fan);
}

// ================================================================ misc wiring
function wireUI() {
  $$(".mode-tab").forEach(b => b.onclick = () => { setMode(b.dataset.mode); $("#prompt-input").value = ""; });
  $("#btn-forge").onclick = forge;
  const inp = $("#prompt-input");
  inp.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); forge(); } });
  inp.addEventListener("input", () => { inp.style.height = "auto"; inp.style.height = Math.min(120, inp.scrollHeight) + "px"; });

  $("#example-chips").innerHTML = EXAMPLES.map((e, i) => `<button class="chip" data-i="${i}">${e.slice(0, 64)}…</button>`).join("");
  $$(".chip").forEach(c => c.onclick = () => { $("#prompt-input").value = EXAMPLES[+c.dataset.i]; forge(); });

  // ability
  $("#seg-hand").querySelectorAll("button").forEach(b => b.onclick = () => {
    $("#seg-hand").querySelectorAll("button").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); liveRelayout();
  });
  $("#finger-picker").querySelectorAll("button").forEach(b => b.onclick = () => { b.classList.toggle("active"); liveRelayout(); });
  $("#reach-range").oninput = () => { $("#reach-val").textContent = $("#reach-range").value + " mm"; liveRelayoutDebounced(); };

  // wood / repair / enclosure inputs
  $("#wood-photo").onchange = e => $("#wood-photo-name").textContent = e.target.files[0]?.name || "";
  $("#repair-photo").onchange = e => $("#repair-photo-name").textContent = e.target.files[0]?.name || "";
  ["repair-type", "repair-ref"].forEach(id => $("#" + id).addEventListener("change", () => state.repair && guard(forgeRepair)));
  $("#enc-preset").onchange = () => { applyEnclosurePreset($("#enc-preset").value); if (state.enc.model) guard(forgeEnclosure); };
  ["enc-w", "enc-d", "enc-h", "enc-wall", "enc-board", "enc-vents", "enc-wallmount", "enc-gland", "enc-fan"]
    .forEach(id => $("#" + id).addEventListener("change", () => state.enc.model && guard(forgeEnclosure)));

  $("#edit-apply").onclick = applyConversationalEdit;
  $("#edit-input").addEventListener("keydown", e => { if (e.key === "Enter") applyConversationalEdit(); });

  // workspace tabs / HUD / footer / settings
  $$(".ws-tab").forEach(t => t.onclick = () => selectTab(t.dataset.tab));
  $("#explode-range").oninput = e => setExplode(+e.target.value / 100);
  const modes = { "btn-view-solid": "solid", "btn-view-xray": "xray", "btn-view-wire": "wire" };
  for (const [id, m] of Object.entries(modes)) {
    $("#" + id).onclick = () => {
      ["btn-view-solid", "btn-view-xray", "btn-view-wire"].forEach(x => $("#" + x).classList.remove("active"));
      $("#" + id).classList.add("active"); setViewMode(m);
    };
  }
  $("#btn-view-spin").onclick = () => { setSpin(!isSpin()); $("#btn-view-spin").classList.toggle("active", isSpin()); };

  const dd = $(".dropdown");
  $("#btn-export").onclick = e => { e.stopPropagation(); dd.classList.toggle("open"); };
  document.addEventListener("click", () => dd.classList.remove("open"));
  $("#export-menu").querySelectorAll("button").forEach(b => b.onclick = e => { e.stopPropagation(); dd.classList.remove("open"); doExport(b.dataset.x); });

  const modal = $("#settings-modal");
  $("#btn-settings").onclick = () => { const s = getSettings(); $("#set-apikey").value = s.apiKey; $("#set-model").value = s.model; modal.showModal(); };
  $("#set-cancel").onclick = () => modal.close();
  $("#set-save").onclick = () => {
    saveSettings({ apiKey: $("#set-apikey").value.trim(), model: $("#set-model").value });
    modal.close(); refreshAIStatus();
    toast(hasKey() ? "Claude connected — generation, editing & inspection AI-powered" : "Running on the offline engine", "ok");
  };

  // visual selection
  onPick(hit => {
    const el = $("#viewer-dims");
    if (!hit) { updateViewerDims(); return; }
    const extra = hit.name.includes("(printed)") ? "printed part — exported in STL/3MF/STEP" :
      hit.name.includes("PCB") ? "custom PCB — see PCB tab + Gerbers" : "purchased component — see BOM";
    el.innerHTML = `<b style="color:var(--accent2)">▣ ${esc(hit.name)}</b><br>${extra}<br><span style="color:#6a7180">edit via Parameters or “make …” in the edit box</span>`;
  });

  window.addEventListener("unhandledrejection", e => toast("Error: " + (e.reason?.message || e.reason), "err"));
  window.addEventListener("error", e => toast("Error: " + e.message, "err"));
}

let relayoutT = null;
function liveRelayoutDebounced() { clearTimeout(relayoutT); relayoutT = setTimeout(liveRelayout, 250); }
async function liveRelayout() {
  if (!isDeckMode() || !state.spec?.derived?.deck) return;
  state.spec.ability = readAbilityPanel(state.spec.ability);
  await rebuildDeck({ animate: false });
}
function readAbilityPanel(cur) {
  const hand = $("#seg-hand button.active")?.dataset.v || cur.hand;
  const fingers = {};
  $("#finger-picker").querySelectorAll("button").forEach(b => fingers[b.dataset.f] = b.classList.contains("active"));
  return { hand, fingers, reachMM: +$("#reach-range").value };
}

function selectTab(id) {
  $$(".ws-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === id));
  $$(".ws-pane").forEach(p => p.classList.toggle("active", p.id === "pane-" + id));
}
function activeTab() { return $(".ws-tab.active")?.dataset.tab || "overview"; }

function updateViewerDims() {
  const s = state.spec;
  if (!s?.derived?.deck || !isDeckMode()) { $("#viewer-dims").innerHTML = ""; return; }
  const d = s.derived;
  $("#viewer-dims").innerHTML =
    `${esc(s.name)} · rev ${s.rev}<br>` +
    `${d.deck.w.toFixed(1)} × ${d.deck.d.toFixed(1)} × ${(d.deck.h + s.geometry.plateMM).toFixed(1)} mm<br>` +
    `${d.keyTotal} keys · ${s.modules.encoders.count} dials · ${d.matrix.rows}×${d.matrix.cols} matrix<br>` +
    `<span style="color:#6a7180">click any component to inspect it</span>`;
}

function refreshAIStatus() {
  const el = $("#ai-status");
  if (hasKey()) { el.textContent = getSettings().model.replace("claude-", "").toUpperCase(); el.classList.add("online"); }
  else { el.textContent = "OFFLINE ENGINE"; el.classList.remove("online"); }
}

function toast(msg, cls = "") {
  const t = document.createElement("div");
  t.className = "toast " + cls;
  t.textContent = msg;
  $("#toasts").appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .4s"; }, 4200);
  setTimeout(() => t.remove(), 4800);
}

// ================================================================ boot
initViewer($("#viewer-canvas"));
wireUI();
wireInspection();
syncPartPanel();
refreshAIStatus();
setMode("product");
// flagship demo: full pipeline; concept auto-selected and labelled as such,
// requirements interview intentionally left open so Gate 1 shows real blockers.
forgeDeck(EXAMPLES[0], { silent: true, autoConcept: true });
