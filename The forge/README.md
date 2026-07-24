# ⚒ THE FORGE

**From one sentence to a manufacturable product.**

THE FORGE is a bounded invention platform. Describe a product, part, enclosure,
tool, fixture, adapter, furniture component, electronics project, or
accessibility device in plain language and get a real engineering package —
requirements, a design-complexity rating, parametric CAD, manufacturability
validation, and the files and instructions needed to build, assemble, and test
it.

> The Forge is not an image generator. Renders visualize the parametric CAD;
> the CAD is the source of truth. Exports open in real manufacturing software.

## Run it

```bash
python serve.py
```

Open **http://127.0.0.1:8137**. No build step, no Node, no external dependencies
(Three.js is vendored in `/vendor`).

## Seven modes — one engineering pipeline

| Mode | For | Typical level |
|---|---|---|
| ⌨ **Product** | Command decks, control surfaces, finished devices | L3 |
| 🔩 **Part** | Brackets, spacers, adapters, covers, clips, drill jigs | L1 |
| 📦 **Enclosure** | Pi/ESP32/sensor housings, control panels, project boxes | L2 |
| ⚡ **Electronics** | Button panels, low-voltage microcontroller projects | L2–L3 |
| 🪵 **Wood** | Live-edge furniture, shelving, shop jigs & fixtures | L2 |
| 🔧 **Repair** | Non-critical replacement knobs, gears, brackets, clips | L1 |
| ♿ **Access** | One-handed decks, low-force interfaces, foot controls | L3 |

All modes share: safety screen → requirements → complexity rating → concepts →
parametric CAD → validation → gated export.

## Bounded complexity (L1–L5)

Every project gets a **Design Complexity Rating** computed from real factors
(part count, moving subsystems, electronics, voltage/current, loads, safety
impact, process), shown *with its reasons* before detailed generation.

- **L1 Single Part / L2 Simple Assembly** — fully automated.
- **L3 Moderate Product** — automated, but a formal design-review checkpoint
  (Gate 6) is required before the manufacturing-package export.
- **L4 Expert-Assisted** — preliminary only; files export watermarked
  `PRELIMINARY-` and the UI states "expert review required before manufacturing."
- **L5 Unsupported** — weapons, safety-critical automotive/aircraft, medical
  implants, mains equipment, load-bearing structure, covert surveillance, and
  safety-bypass designs are **refused**. The Forge returns a safe requirements
  outline instead of falsely-certified files, and export is blocked.

## Seven review gates

The footer/overview shows live gate status and blockers:

1. Requirements complete (critical unknowns resolved)
2. Concept approved
3. Geometry valid (interference/clearance checks pass)
4. Manufacturability valid (process DFM passes or warnings acknowledged)
5. Electronics valid (pin conflicts, reserved pins, power budget, firmware↔schematic)
6. Safety / design review (per complexity level)
7. Manufacturing package (files + drawings + BOM + instructions + tests complete)

The **Manufacturing package** export is blocked until every gate passes.

## Real validation (nothing fabricated)

Every check is labelled by how the number was obtained — *calculated*, *rule*,
*datasheet*, or *assumption* — and unknown inputs are named rather than invented:

- **DFM/FDM**: wall/plate minimums, bed fit, bridge length, warp, inserts.
- **Interference**: 2-D footprint clearance computed from the actual placements
  (component gaps, edge margin, connector spacing, tool access).
- **Electrical**: GPIO conflict detection, ESP32-S3 strapping/PSRAM/USB
  reserved-pin enforcement, I²C address conflicts, 500 mA USB power budget.
- **Firmware↔hardware**: parses the generated sketch and confirms the pin arrays
  match the schematic.
- **Engineering calcs**: plate deflection (beam theory), tip-over (moment
  balance), fastener margin, tolerance stack (RSS), power/runtime — each with its
  formula and assumptions listed.

## Requirements interview

One sentence starts the design; The Forge derives categorized requirements
(Functional, Physical, Interface, Manufacturing, Material, Electrical,
Environmental, Accessibility, Cost, Safety, Testing, Appearance), each marked
**confirmed / assumption / unknown**. It asks only the high-value questions
(printer bed size, budget, wireless, appearance). **Critical unknowns block
Gate 1.** Acceptance tests are generated directly from the requirements.

## Editing — three synchronized methods

- **Conversational**: `"make the wall 3mm"`, `"put the jacks on the side"`,
  `"snap-fit lid"`, `"8 keys and 2 dials"`, `"easier with one hand"`.
- **Parameter**: safe numeric editors (wall, plate, height, dial clearance,
  jack edge, snap-fit, ribs) and per-part parameters in Part mode.
- **Visual**: click any component in the 3D view to inspect what it is and how
  it exports.

Every edit updates the spec, regenerates affected geometry, re-runs validation,
and records a revision with affected artifacts + cost impact.

## Exports (open in real tools)

STL · **3MF** · **STEP (AP242, tessellated)** · **DXF (R12, laser/CNC)** ·
**dimensioned drawing (title block, section view, GD&T-style callouts)** ·
Gerber X2 + Excellon · ESP32-S3 Arduino firmware · BOM CSV (real MPNs) ·
assembly + test manual · wiring/schematic SVG · product website · and the gated
**manufacturing-package.zip** bundling all of it.

## Prototype inspection loop

Manufacture the first unit, then 📷 **Inspect Prototype** — point a camera at it
(Fable 5 vision analysis with a key, simulated without one). Findings map onto
parametric CAD patches; **Generate Revision** mutates the spec, regenerates the
full package, records the diff, and re-opens the L3 design review.

## AI engine (optional)

⚙ Settings → paste a Claude API key (localStorage only; sent only to
`api.anthropic.com`). Powers invention interpretation, conversational-edit
parsing, and vision inspection. Fable 5 requests include a server-side Opus 4.8
refusal fallback. Everything works offline without a key.

## Architecture

```
complexity.js   L1–L5 rating + L5 safety policy/refusal
requirements.js requirement derivation, interview, conflicts, acceptance tests
validation.js   DFM / interference / electrical / firmware / calcs / gate engine
spec.js         sentence → spec; design concepts (structurally different)
layout.js       ability profile → placements (ergonomic fan or grid panel)
geometry.js     spec → printable three.js geometry (extruded solids w/ cutouts)
partlib.js      Part-mode parametric library (bracket, spacer, adapter, jig…)
enclosure.js    Enclosure-mode generator (Pi node, sensor box, panel)
electronics.js  GPIO map (reserved-pin-safe), schematic, wiring
pcb.js          2-layer PCB + Gerber X2 / Excellon
firmware.js     ESP32-S3 Arduino sketch (TinyUSB HID)
drawings.js     dimensioned drawings, DXF, 3MF, STEP AP242
exports.js      binary STL, ZIP, BOM CSV, manual, product site
claude.js       Claude bridge + conversational edit ops + inspection patches
modes.js        woodworking / repair engines
viewer.js       three.js viewer: explode, x-ray, wireframe, turntable, picking
main.js         app shell: gated pipeline, panes, editing, revisions
```

Everything downstream derives from one JSON **spec**, which is why "generate a
revision" is a real regeneration, not a mock.

## Honest limitations

- PCB is comb-autorouted: valid Gerbers, but run a KiCad DRC pass before fab
  (tracked as a Gate 4 warning).
- STEP/3MF are **tessellated** (triangle mesh), not B-rep — they import into any
  MCAD viewer and slicer; they are not editable solids.
- The enclosure/deck STL is multi-solid (shell + lid/plate); slicers union it,
  print the parts using the placement.
- Engineering calcs are first-order with stated assumptions — L4 designs
  explicitly require expert review before manufacturing.
