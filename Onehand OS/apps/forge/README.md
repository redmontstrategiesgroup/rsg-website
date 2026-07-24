# ⚒ THE FORGE

**Describe the problem. Manufacture the solution.**

THE FORGE turns one sentence into a real, manufacturable invention: interactive 3D
model, electronics schematic, custom PCB, microcontroller firmware, printable
enclosure, exact parts with supplier links, assembly manual, wiring diagram,
testing procedure, product renders and version history — then it inspects the
physical prototype you built and designs the next revision.

## Run it

```bash
python serve.py
```

Open **http://127.0.0.1:8137**. No build step, no Node, no dependencies beyond
Python (for the static server) and a browser. Three.js is vendored in `/vendor`.

## The four modes

| Mode | Input | Output |
|---|---|---|
| **⌨ Product** | One sentence ("a one-handed control deck…") | Full manufacturing package: 3D model, schematic, PCB, firmware, BOM, manual, website |
| **🪵 Woodworking** | Slab dimensions + species (+ photo) | Furniture design, cut list, joinery plan, material estimate, CNC notes, client render, pricing |
| **🔧 Repair** | Broken-part type + one caliper measurement | Parametric replacement part, print plan, STL |
| **💡 Inventor** | A problem, not a product | 3 competing physical solutions, scored for usability/cost/manufacturability; forge or merge them |

## The loop that makes it interesting

1. **FORGE IT** — the pipeline runs: intent → ergonomic layout → mechanical →
   electronics → PCB → firmware → BOM → docs. In Product mode the layout is
   generated from a **physical-ability profile** (hand, usable fingers,
   comfortable reach) — the hardware itself is rearranged around your hand
   before the enclosure is generated.
2. **Build it** — export STL (binary, mm, validated), Gerber X2 + Excellon,
   ESP32-S3 Arduino firmware, BOM CSV with real MPNs, assembly manual.
3. **📷 Inspect Prototype** — point a camera at what you built. With a Claude
   API key, Fable 5 visually examines the photo against the design data; without
   one, a simulated inspection demonstrates the loop. Findings map onto
   *parametric CAD patches* (dial clearance, USB ribs, jack placement, snap-fit
   lid…).
4. **⚒ Generate Revision** — the spec mutates, the whole package regenerates,
   and version history records the diff. Repeat until it's right.

## AI engine (optional)

⚙ Settings → paste a Claude API key (stored in localStorage only, sent only to
`api.anthropic.com`). This powers:

- **Invention interpretation** — Fable 5 fills the design schema from your sentence
- **Inventor-mode concepts** — three genuinely different architectures, scored
- **Prototype inspection** — vision analysis of your photo vs. the CAD data

Fable 5 requests opt into the server-side refusal fallback, so declines are
transparently re-served by Opus 4.8. Without a key, an offline parametric
interpreter runs the whole pipeline locally.

## Architecture

```
js/spec.js         one sentence → design spec (offline interpreter + AI schema)
js/layout.js       ability profile → component placements (staggered columns, thumb cluster)
js/geometry.js     spec → printable three.js geometry (extruded shapes with real cutouts)
js/electronics.js  spec → GPIO map, netlist, schematic SVG, wiring SVG
js/pcb.js          spec → 2-layer board, Gerber X2 + Excellon export
js/firmware.js     spec → ESP32-S3 Arduino sketch (TinyUSB HID, matrix, encoders, I²C)
js/exports.js      binary STL, ZIP (store), BOM CSV, manual, product site
js/claude.js       Claude API bridge + inspection patch engine
js/modes.js        woodworking / repair / inventor engines
js/viewer.js       three.js viewer: explode, x-ray, wireframe, turntable, renders
js/main.js         app shell, pipeline animation, panes, versions
```

Everything downstream derives from one JSON **spec** — that's what makes
"Generate Revision 2" a real regeneration instead of a mock.

## Honest limitations (v1)

- The PCB is comb-autorouted: structurally valid Gerbers, but run a DRC pass in
  KiCad before fabbing.
- The enclosure STL is a multi-solid file (shell + plate); slicers union it fine,
  print the two parts separately using the placement.
- Firmware compiles against ESP32 Arduino core 3.x conventions; keymaps beyond
  the macro layer are seeded, not curated.
