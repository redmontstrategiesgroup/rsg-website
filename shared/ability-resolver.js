/* ============================================================
   RSG // ability-resolver.js — capability profile → layout specification.

   PURE. (capability, application) → layout. No I/O, no clock, no randomness,
   no network, no model. Same input, same output, every run.

   That is not fastidiousness: a person builds motor memory around control
   positions, so a layout that drifts between sessions damages the very
   accommodation it exists to provide. Determinism is the feature.

   Input describes FUNCTION (what the person can comfortably do), never a
   diagnosis — a diagnosis predicts need worse and raises the data's
   sensitivity tier for nothing.

   Consumed by: Onehand OS shell (writes rsg.ability.v1), GHOST (PHANTOM HAND
   dock). Exposed as window.RSGAbility; consumers guard for its absence so
   standalone serving degrades instead of breaking.
   ============================================================ */
(function (root) {
  "use strict";

  /* ---------- stated constants (not per-device tuning) ---------- */
  var PX_PER_MM   = 3.0;   // CSS px per mm of comfortable thumb sweep
  var BASE_TARGET = 44;    // floor for any target, before ability scaling
  var BASE_GAP    = 8;     // floor for clear space between neighbours
  var STRETCH_K   = 1.35;  // stretch zone extends to 1.35× the comfortable radius
  var MARGIN      = 14;    // surface edge inset

  var FINGERS = ["thumb", "index", "middle", "ring", "pinky"];

  /* Gesture taxonomy. The resolver never emits a gesture outside SINGLE_OK. */
  var SINGLE_OK   = ["tap", "stepper", "menu", "button", "switch", "voice", "foot"];
  var MULTI       = ["pinch", "two-finger-scroll", "modifier-click"];
  var TIMED       = ["double-tap", "timed-hold"];
  var DRAGGING    = ["drag", "slider"];

  /* Every excluded gesture has a single-contact, untimed replacement. */
  var SUBSTITUTION = {
    "drag":              "stepper",
    "slider":            "stepper",
    "pinch":             "button",
    "two-finger-scroll": "button",
    "modifier-click":    "menu",
    "long-press":        "menu",
    "double-tap":        "tap",
    "timed-hold":        "tap"
  };

  /* Conservative fallbacks. Used ONLY alongside an `unresolved` entry — the
     engine never silently substitutes a default and calls the job done. */
  var CONSERVATIVE = {
    hand: "right", reachMM: 70, grip: "weak", fatigue: "high",
    precision: "low", permanence: "changing", inputs: []
  };

  function has(o, k) { return o && Object.prototype.hasOwnProperty.call(o, k) && o[k] != null; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function oneOf(v, list, fallback) { return list.indexOf(v) >= 0 ? v : fallback; }

  /* ============================================================
     1. Normalize the capability profile.
     Anything absent is recorded in `unresolved` and filled conservatively,
     so the caller can ask rather than be quietly misserved.
     ============================================================ */
  function normalize(cap) {
    cap = cap || {};
    var unresolved = [], why = [];

    function take(key, list) {
      if (!has(cap, key)) {
        unresolved.push(key);
        why.push({ decision: key + "=" + CONSERVATIVE[key], because: "not supplied — most conservative value used", input: null });
        return CONSERVATIVE[key];
      }
      return list ? oneOf(cap[key], list, CONSERVATIVE[key]) : cap[key];
    }

    var fingers = {};
    var fingersGiven = has(cap, "fingers") && typeof cap.fingers === "object";
    if (!fingersGiven) {
      unresolved.push("fingers");
      why.push({ decision: "fingers=thumb only", because: "not supplied — most conservative value used", input: null });
    }
    FINGERS.forEach(function (f) {
      fingers[f] = fingersGiven ? !!cap.fingers[f] : (f === "thumb");
    });
    var fingerCount = FINGERS.filter(function (f) { return fingers[f]; }).length || 1;

    var reach = has(cap, "reachMM") && typeof cap.reachMM === "number"
      ? clamp(cap.reachMM, 40, 160) : take("reachMM");

    return {
      hand:       take("hand", ["left", "right"]),
      fingers:    fingers,
      fingerCount: fingerCount,
      reachMM:    reach,
      grip:       take("grip", ["weak", "moderate", "strong"]),
      fatigue:    take("fatigue", ["low", "med", "high"]),
      precision:  take("precision", ["low", "moderate", "high"]),
      permanence: take("permanence", ["temporary", "permanent", "changing"]),
      inputs:     has(cap, "inputs") && Array.isArray(cap.inputs) ? cap.inputs.slice() : take("inputs"),
      _unresolved: unresolved,
      _why: why
    };
  }

  /* ============================================================
     2. Target sizing. Precision is the dominant driver (it is what makes a
     target hard to hit); grip and fatigue add on top. Kept separate so a
     differential test can move one and see only its own contribution.
     ============================================================ */
  function sizing(p, why) {
    var precAdd  = { low: 20, moderate: 8,  high: 0 }[p.precision];
    var gripAdd  = { weak: 8,  moderate: 4, strong: 0 }[p.grip];
    var fatAdd   = { high: 12, med: 6,      low: 0 }[p.fatigue];
    var permAdd  = p.permanence === "changing" ? 4 : 0;  // headroom for a worse day

    var minPx = BASE_TARGET + precAdd + gripAdd + fatAdd + permAdd;

    /* Spacing matters more than size: a mis-hit costs an undo, a miss costs a
       retry. Low precision widens the gap faster than it widens the target. */
    var gapPx = BASE_GAP + { low: 12, moderate: 4, high: 0 }[p.precision]
                         + { high: 6, med: 3, low: 0 }[p.fatigue];

    why.push({ decision: "target " + minPx + "px", because: "precision=" + p.precision + " (+" + precAdd + "), grip=" + p.grip + " (+" + gripAdd + "), fatigue=" + p.fatigue + " (+" + fatAdd + ")" + (permAdd ? ", permanence=changing (+" + permAdd + ")" : ""), input: "precision,grip,fatigue,permanence" });
    why.push({ decision: "gap " + gapPx + "px", because: "spacing scales with precision=" + p.precision + " and fatigue=" + p.fatigue, input: "precision,fatigue" });

    return { minPx: minPx, gapPx: gapPx };
  }

  /* ============================================================
     3. Reach zones, mirrored by handedness. Radii come straight from the
     person's own reported sweep, so a smaller reach genuinely shrinks the
     comfortable region rather than restyling it.
     ============================================================ */
  function zones(p, surface, why) {
    var comfortableR = p.reachMM * PX_PER_MM;
    var corner = p.hand === "left" ? "bottom-left" : "bottom-right";
    why.push({ decision: "anchor " + corner, because: "hand=" + p.hand, input: "hand" });
    why.push({ decision: "comfortable radius " + Math.round(comfortableR) + "px", because: "reachMM=" + p.reachMM + " × " + PX_PER_MM + "px/mm", input: "reachMM" });
    return {
      anchor: { corner: corner, x: p.hand === "left" ? MARGIN : surface.width - MARGIN, y: surface.height - MARGIN },
      comfortable: { rMax: comfortableR },
      stretch:     { rMin: comfortableR, rMax: comfortableR * STRETCH_K },
      avoid:       { rMin: comfortableR * STRETCH_K }
    };
  }

  function zoneAt(z, dist) {
    if (dist <= z.comfortable.rMax) return "comfortable";
    if (dist <= z.stretch.rMax) return "stretch";
    return "avoid";
  }

  /* ============================================================
     4. Placement. Slots are laid out from the anchor corner outward; distance
     from the anchor decides the zone. Frequent actions claim the nearest
     slots; destructive actions are pushed past the comfortable radius AND
     away from any frequent neighbour.
     ============================================================ */
  function slotGeometry(i, cols, pitch, z, surface) {
    var col = i % cols, row = Math.floor(i / cols);
    var dx = (col + 0.5) * pitch, dy = (row + 0.5) * pitch;
    return {
      col: col, row: row,
      x: z.anchor.corner === "bottom-left" ? z.anchor.x + dx : z.anchor.x - dx,
      y: z.anchor.y - dy,
      dist: Math.sqrt(dx * dx + dy * dy)
    };
  }
  function adjacent(a, b) { return Math.abs(a.col - b.col) <= 1 && Math.abs(a.row - b.row) <= 1; }

  function place(p, app, size, z, surface, why) {
    var pitch = size.minPx + size.gapPx;
    var usable = surface.width - MARGIN * 2;
    var cols = Math.max(1, Math.floor((usable + size.gapPx) / pitch));

    /* Fewer usable fingers and higher fatigue mean fewer things on screen at
       once — the count is an ability output, not a design preference. */
    var cap = p.fatigue === "high" ? 5 : p.fingerCount <= 1 ? 6 : 8;
    var actions = (app.actions || []).slice();
    var rank = { high: 0, medium: 1, low: 2 };

    /* The cap drops the LEAST FREQUENT, never whatever happens to be declared
       last. Destructive actions are always placed: they live in the avoid zone
       and cost no comfortable real estate, and silently hiding a stop control
       behind a submenu because a person is tired is not a safe trade. */
    var frequent = actions.filter(function (a) { return !a.destructive; })
      .sort(function (a, b) { return (rank[a.frequency] || 1) - (rank[b.frequency] || 1); });
    var destructive = actions.filter(function (a) { return a.destructive; });
    var deferred = frequent.slice(cap).map(function (a) { return a.id; });
    frequent = frequent.slice(0, cap);
    if (deferred.length) why.push({ decision: "defer " + deferred.length + " action(s) to a submenu", because: "fatigue=" + p.fatigue + ", usable fingers=" + p.fingerCount + " → cap " + cap + "; least-frequent deferred first", input: "fatigue,fingers" });

    var placements = [], used = [];
    frequent.forEach(function (a, i) {
      var g = slotGeometry(i, cols, pitch, z, surface);
      placements.push({ actionId: a.id, zone: zoneAt(z, g.dist), order: i, col: g.col, row: g.row, x: Math.round(g.x), y: Math.round(g.y), dist: Math.round(g.dist) });
      used.push(g);
    });

    /* A destructive action must clear the comfortable zone and must not touch
       a frequent one. Walk outward until both hold — never place and hope. */
    destructive.forEach(function (a) {
      var i = frequent.length, g, ok = false, guard = 0;
      while (!ok && guard++ < 400) {
        g = slotGeometry(i, cols, pitch, z, surface);
        var clearsComfort = zoneAt(z, g.dist) !== "comfortable";
        var noFrequentNeighbour = used.every(function (u) { return !adjacent(g, u); });
        if (clearsComfort && noFrequentNeighbour) ok = true; else i++;
      }
      placements.push({ actionId: a.id, zone: zoneAt(z, g.dist), order: i, col: g.col, row: g.row, x: Math.round(g.x), y: Math.round(g.y), dist: Math.round(g.dist), destructive: true });
      used.push(g);
      why.push({ decision: a.id + " placed in the " + zoneAt(z, g.dist) + " zone", because: "destructive actions are kept out of the comfortable zone and away from frequent ones", input: "destructive" });
    });

    return { placements: placements, cols: cols, pitch: pitch, deferred: deferred, cap: cap };
  }

  /* ============================================================
     5. Interaction substitutions, voice, sequential order, safeguards.
     ============================================================ */
  function substitutions(app, why) {
    var subs = [];
    (app.actions || []).forEach(function (a) {
      var g = a.gesture || "tap";
      if (SINGLE_OK.indexOf(g) >= 0) return;
      var to = SUBSTITUTION[g] || "tap";
      subs.push({ actionId: a.id, from: g, to: to });
      why.push({ decision: a.id + ": " + g + " → " + to, because: g + " needs two contacts, sustained precision, or timing", input: "gesture" });
    });
    return subs;
  }

  function voiceFor(p, app, why) {
    var enabled = p.inputs.indexOf("voice") >= 0;
    if (!enabled) return { enabled: false, mappings: {} };
    var m = {};
    (app.actions || []).forEach(function (a) {
      /* The spoken name must be what is written on the control — a voice user
         says what they see, not what an aria-label says. */
      var phrases = [String(a.label || a.id).toLowerCase()];
      (a.voice || []).forEach(function (v) { if (phrases.indexOf(v) < 0) phrases.push(v); });
      m[a.id] = phrases;
    });
    why.push({ decision: "voice mappings for " + Object.keys(m).length + " actions", because: "inputs include voice", input: "inputs" });
    return { enabled: true, mappings: m };
  }

  function sequential(p, app, why) {
    var rank = { high: 0, medium: 1, low: 2 };
    var order = (app.actions || []).slice()
      .sort(function (a, b) {
        if (!!a.destructive !== !!b.destructive) return a.destructive ? 1 : -1;  // destructive last
        return (rank[a.frequency] || 1) - (rank[b.frequency] || 1);
      })
      .map(function (a) { return a.id; });

    var freq = (app.actions || []).filter(function (a) { return a.frequency === "high" && !a.destructive; });
    var stepsToFrequent = freq.length ? Math.max.apply(null, freq.map(function (a) { return order.indexOf(a.id) + 1; })) : 0;
    var scanning = p.inputs.indexOf("switch") >= 0 || p.inputs.indexOf("foot") >= 0;
    if (scanning) why.push({ decision: "sequential order fixed, frequent actions within " + stepsToFrequent + " steps", because: "inputs include switch/foot — traversal cost is the real cost", input: "inputs" });
    return { order: order, stepsToFrequent: stepsToFrequent, optimizedForScanning: scanning };
  }

  function safeguards(app, placements, size, why) {
    var out = {};
    (app.actions || []).filter(function (a) { return a.destructive; }).forEach(function (a) {
      var pl = placements.filter(function (x) { return x.actionId === a.id; })[0];
      out[a.id] = {
        /* Untimed on purpose: an expiring confirm window punishes exactly the
           slower, less predictable movement this engine exists to serve. */
        confirm: "two-step-untimed",
        separationPx: size.gapPx * 2,
        undo: true,
        zone: pl ? pl.zone : "avoid"
      };
      why.push({ decision: a.id + " guarded by an untimed two-step confirm with undo", because: "destructive action", input: "destructive" });
    });
    return out;
  }

  function fatiguePlan(p, cap, why) {
    var plan = {
      maxActions: cap,
      persistPartial: p.fatigue !== "low",
      targetBonus: { high: 12, med: 6, low: 0 }[p.fatigue],
      revisitPrompt: p.permanence === "changing",
      preservePriorLayout: p.permanence === "temporary"
    };
    if (plan.persistPartial) why.push({ decision: "partial progress persisted", because: "fatigue=" + p.fatigue + " — sessions get interrupted", input: "fatigue" });
    if (plan.revisitPrompt) why.push({ decision: "prompt to revisit the profile", because: "permanence=changing", input: "permanence" });
    if (plan.preservePriorLayout) why.push({ decision: "prior layout preserved for return", because: "permanence=temporary", input: "permanence" });
    return plan;
  }

  /* ============================================================
     6. Resolve.
     ============================================================ */
  function resolve(capability, application) {
    var app = application || { id: "unknown", actions: [] };
    var surface = app.surface || { width: 360, height: 720 };
    var p = normalize(capability);
    var why = p._why.slice();

    var size = sizing(p, why);
    var z = zones(p, surface, why);
    var pl = place(p, app, size, z, surface, why);

    return {
      app: app.id,
      surface: surface,
      zones: z,
      target: { minPx: size.minPx, gapPx: size.gapPx },
      columns: pl.cols,
      placements: pl.placements,
      deferred: pl.deferred,
      substitutions: substitutions(app, why),
      voice: voiceFor(p, app, why),
      sequential: sequential(p, app, why),
      safeguards: safeguards(app, pl.placements, size, why),
      fatigue: fatiguePlan(p, pl.cap, why),   /* cap comes from place(), never recomputed */
      unresolved: p._unresolved,
      why: why
    };
  }

  /* ============================================================
     7. Invariants. Asserted on every generated layout — these are not advice
     to whoever writes the rules, they are a gate the generator cannot pass
     while violating them.
     ============================================================ */
  function checkInvariants(layout, application) {
    var app = application || { actions: [] };
    var actions = app.actions || [];
    var v = [];
    var subFor = {};
    layout.substitutions.forEach(function (s) { subFor[s.actionId] = s.to; });

    actions.forEach(function (a) {
      var effective = subFor[a.id] || a.gesture || "tap";

      if (MULTI.indexOf(effective) >= 0)
        v.push({ rule: 1, actionId: a.id, msg: "requires two simultaneous contact points: " + effective });

      if (DRAGGING.indexOf(effective) >= 0)
        v.push({ rule: 2, actionId: a.id, msg: "drag is the only path: " + effective });

      if (TIMED.indexOf(effective) >= 0)
        v.push({ rule: 3, actionId: a.id, msg: "depends on timing: " + effective });

      /* 5 — reachable by every declared input method.
         Only what this layer can actually back is asserted here: a spoken name
         when voice is declared, a place in the traversal order, and an
         on-screen route (placed, or deferred to a submenu). Reachability by
         *hardware* — pedal, switch — is not knowable from a layout: it depends
         on a device being present and bound, which input-devices.js enforces
         separately by refusing to bind any action lacking a non-hardware path.
         Asserting it here would be claiming a guarantee this layer cannot
         keep, which is how the "foot-pedal = confirm" label came to be shown
         for people who had never connected a pedal. */
      if (layout.voice.enabled && !layout.voice.mappings[a.id])
        v.push({ rule: 5, actionId: a.id, msg: "voice is available but this action has no spoken name" });
      if (layout.sequential.order.indexOf(a.id) < 0)
        v.push({ rule: 5, actionId: a.id, msg: "absent from the sequential traversal order" });
      var onScreen = layout.placements.some(function (x) { return x.actionId === a.id; })
                  || layout.deferred.indexOf(a.id) >= 0;
      if (!onScreen)
        v.push({ rule: 5, actionId: a.id, msg: "no on-screen route: neither placed nor deferred to a submenu" });

      // 6 — reversible
      if (a.destructive && !(layout.safeguards[a.id] && layout.safeguards[a.id].undo))
        v.push({ rule: 6, actionId: a.id, msg: "destructive action without undo" });
    });

    // 3 — no safeguard may be timed
    Object.keys(layout.safeguards).forEach(function (id) {
      if (/timed(?!-)/.test(layout.safeguards[id].confirm) && layout.safeguards[id].confirm !== "two-step-untimed")
        v.push({ rule: 3, actionId: id, msg: "timed confirmation: " + layout.safeguards[id].confirm });
    });

    // 4 — destructive never adjacent to frequent, never in the comfortable zone
    var byId = {};
    layout.placements.forEach(function (x) { byId[x.actionId] = x; });
    var freqIds = actions.filter(function (a) { return a.frequency === "high" && !a.destructive; }).map(function (a) { return a.id; });
    actions.filter(function (a) { return a.destructive; }).forEach(function (a) {
      var d = byId[a.id];
      if (!d) return;
      if (d.zone === "comfortable")
        v.push({ rule: 4, actionId: a.id, msg: "destructive action sits in the comfortable zone" });
      freqIds.forEach(function (fid) {
        var f = byId[fid];
        if (f && Math.abs(f.col - d.col) <= 1 && Math.abs(f.row - d.row) <= 1)
          v.push({ rule: 4, actionId: a.id, msg: "destructive action is adjacent to frequent action " + fid });
      });
    });

    return { ok: v.length === 0, violations: v };
  }

  var API = {
    resolve: resolve,
    checkInvariants: checkInvariants,
    normalize: normalize,
    constants: { PX_PER_MM: PX_PER_MM, BASE_TARGET: BASE_TARGET, BASE_GAP: BASE_GAP, STRETCH_K: STRETCH_K, MARGIN: MARGIN },
    FINGERS: FINGERS
  };

  root.RSGAbility = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : this);
