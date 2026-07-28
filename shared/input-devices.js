/* ============================================================
   RSG // input-devices.js — capability-based input hardware layer.

   Designed against one assumption: THE DEVICE WILL DISCONNECT AT THE WORST
   MOMENT, and for some people it is their only way to operate the software.
   A silent drop is not an inconvenience, it is a lockout they may not be able
   to resolve unaided.

   So: detect disconnects immediately, say so unmistakably, preserve state, and
   never let hardware be the only path to any action — `bind()` refuses to map
   an action that has no non-hardware fallback registered.

   Devices are described by CAPABILITIES (button/axis counts, analog, haptics),
   never by model name, so an unfamiliar pedal or switch works on first
   connection.

   The device source and the clock are injected, so every failure path —
   disconnect mid-action, reconnect, reduced capabilities, permission denial —
   is exercisable without real hardware. See input-devices-test.html.

   Exposed as window.RSGInput.
   ============================================================ */
(function (root) {
  "use strict";

  var STATES = ["unsupported", "no-device", "connected", "disconnected", "denied"];

  /* ---------- default source: the Gamepad API ----------
     Chosen because it needs no permission prompt and is what most assistive
     pedals/switches that aren't keyboard-emulating present as. Pedals that
     emulate a keyboard need no source at all — they arrive as key events, and
     the keyboard fallback already covers them. */
  function gamepadSource() {
    return {
      supported: function () {
        return typeof navigator !== "undefined" && typeof navigator.getGamepads === "function";
      },
      list: function () {
        if (!this.supported()) return [];
        var pads = [];
        try { pads = Array.prototype.slice.call(navigator.getGamepads() || []); } catch (e) { return []; }
        return pads.filter(Boolean).map(function (g) {
          return {
            id: "gp:" + g.index,
            /* Ask the device what it has. Never infer from the class — a
               one-button pedal and a 16-button controller both arrive here. */
            capabilities: {
              buttons: (g.buttons || []).length,
              axes: (g.axes || []).length,
              analog: (g.buttons || []).some(function (b) { return b && typeof b.value === "number" && b.value > 0 && b.value < 1; }),
              haptics: !!(g.vibrationActuator || (g.hapticActuators && g.hapticActuators.length))
            },
            buttons: (g.buttons || []).map(function (b) { return !!(b && b.pressed); }),
            axes: (g.axes || []).slice()
          };
        });
      },
      /* Connect/disconnect arrive as window events; polling `list()` also
         catches them, so both paths converge on reconcile(). */
      subscribe: function (onChange) {
        if (typeof root.addEventListener !== "function") return function () {};
        var f = function () { onChange(); };
        root.addEventListener("gamepadconnected", f);
        root.addEventListener("gamepaddisconnected", f);
        return function () {
          root.removeEventListener("gamepadconnected", f);
          root.removeEventListener("gamepaddisconnected", f);
        };
      }
    };
  }

  /* ============================================================
     HID report parsing — pure helpers, exported for test.

     WebHID hands back raw report bytes plus a descriptor of what the bits
     mean. Usage pages identify what an input IS: 0x09 = Button,
     0x01 = Generic Desktop (0x30..0x38 are the axes). Reading the descriptor
     rather than hard-coding byte offsets is what lets an unfamiliar pedal work
     on first connection.
     ============================================================ */
  var USAGE_BUTTON = 0x09, USAGE_DESKTOP = 0x01;
  function pageOf(usage) { return (usage >>> 16) & 0xffff; }
  function idOf(usage) { return usage & 0xffff; }

  /* Usages are either an explicit list or an inclusive range. */
  function itemUsages(item, limit) {
    if (item.isRange && item.usageMinimum != null && item.usageMaximum != null) {
      var out = [], n = Math.min(item.usageMaximum - item.usageMinimum + 1, limit || 64);
      for (var i = 0; i < n; i++) out.push(item.usageMinimum + i);
      return out;
    }
    return (item.usages || []).slice();
  }

  /* Little-endian bit read, LSB-first within each byte — how HID packs fields. */
  function readBits(view, bitOffset, bitLength) {
    var v = 0;
    for (var i = 0; i < bitLength; i++) {
      var b = bitOffset + i, byteIndex = b >> 3;
      if (byteIndex >= view.byteLength) return v;      // report shorter than the descriptor claims
      v |= ((view.getUint8(byteIndex) >> (b & 7)) & 1) << i;
    }
    return v;
  }
  function signed(raw, size, min) {
    if (min >= 0 || size <= 0) return raw;
    var half = Math.pow(2, size - 1);
    return raw >= half ? raw - Math.pow(2, size) : raw;
  }

  /* Walk the descriptor once and record where each button/axis lives.
     Bit cursors are kept PER REPORT ID: items in different reports each start
     at bit 0 of their own report. */
  function layoutFor(device) {
    var byReport = {}, cursor = {};
    (device.collections || []).forEach(function (c) {
      (c.inputReports || []).forEach(function (rep) {
        var id = rep.reportId || 0;
        var entry = byReport[id] || (byReport[id] = { buttons: [], axes: [] });
        if (cursor[id] == null) cursor[id] = 0;
        (rep.items || []).forEach(function (item) {
          var size = item.reportSize || 0, count = item.reportCount || 0;
          var us = itemUsages(item, count);
          var page = us.length ? pageOf(us[0]) : (item.usagePage || 0);
          for (var i = 0; i < count; i++) {
            var off = cursor[id] + i * size;
            if (page === USAGE_BUTTON) entry.buttons.push({ bit: off, size: size });
            else if (page === USAGE_DESKTOP) {
              var u = us[i] != null ? idOf(us[i]) : 0;
              if (u >= 0x30 && u <= 0x38)
                entry.axes.push({ bit: off, size: size, min: item.logicalMinimum || 0, max: item.logicalMaximum || 0 });
            }
          }
          cursor[id] += size * count;
        });
      });
    });
    return byReport;
  }

  /* Capabilities come from the descriptor, never from vendor/product IDs. */
  function describeHID(device) {
    var lay = layoutFor(device), buttons = 0, axes = 0, analog = false;
    Object.keys(lay).forEach(function (id) {
      buttons += lay[id].buttons.length;
      axes += lay[id].axes.length;
      if (lay[id].axes.some(function (a) { return a.size > 1; })) analog = true;
    });
    return {
      buttons: buttons, axes: axes, analog: analog,
      /* HID haptics need an output-report handshake we do not perform, so this
         is reported false rather than guessed from the presence of output
         reports. Under-claiming beats a capability that isn't there. */
      haptics: false
    };
  }

  /* ============================================================
     WebHID source. Chromium-only, secure-context-only.
     ============================================================ */
  function hidSource(opts) {
    opts = opts || {};
    /* hasOwnProperty, not `||`: passing hid:null must mean "there is no HID
       here", not "fall back to navigator.hid". Otherwise the unsupported path
       can never be reached on a browser that happens to have WebHID. */
    var hid = Object.prototype.hasOwnProperty.call(opts, "hid")
      ? opts.hid
      : (typeof navigator !== "undefined" ? navigator.hid : null);
    var tracked = [], subs = [], bootstrapped = false, seq = 0;

    function fire() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
    function find(device) {
      for (var i = 0; i < tracked.length; i++) if (tracked[i].device === device) return tracked[i];
      return null;
    }
    function onInputReport(e) {
      var t = find(e.device || (e.target));
      if (!t) return;
      var lay = t.layout[e.reportId || 0];
      if (!lay || !e.data) return;
      lay.buttons.forEach(function (b, i) { t.buttons[i] = readBits(e.data, b.bit, b.size) !== 0; });
      lay.axes.forEach(function (a, i) {
        var raw = signed(readBits(e.data, a.bit, a.size), a.size, a.min);
        t.axes[i] = a.max > a.min ? ((raw - a.min) / (a.max - a.min)) * 2 - 1 : raw;
      });
      fire();
    }
    function track(device) {
      if (find(device)) return;
      var caps = describeHID(device);
      var t = {
        device: device,
        key: "hid:" + (device.vendorId || 0) + ":" + (device.productId || 0) + ":" + (seq++),
        layout: layoutFor(device), caps: caps,
        buttons: new Array(caps.buttons).fill(false),
        axes: new Array(caps.axes).fill(0),
        opened: false, error: null
      };
      tracked.push(t);
      try { device.addEventListener("inputreport", onInputReport); } catch (e) {}
      /* A granted device still arrives closed — no reports until it is opened. */
      if (device.opened) { t.opened = true; }
      else if (typeof device.open === "function") {
        Promise.resolve().then(function () { return device.open(); })
          .then(function () { t.opened = true; fire(); },
                function (err) { t.error = String((err && err.message) || err); fire(); });
      }
      fire();
    }
    function untrack(device) {
      var t = find(device);
      if (!t) return;
      try { device.removeEventListener("inputreport", onInputReport); } catch (e) {}
      tracked = tracked.filter(function (x) { return x !== t; });
      fire();
    }
    function bootstrap() {
      if (bootstrapped || !hid || typeof hid.getDevices !== "function") return;
      bootstrapped = true;
      /* Previously-granted devices come back without a prompt — this IS the
         persisted pairing, so a returning user is not asked again. */
      Promise.resolve().then(function () { return hid.getDevices(); })
        .then(function (ds) { (ds || []).forEach(track); fire(); }, function () {});
    }

    return {
      supported: function () { return !!(hid && typeof hid.getDevices === "function"); },
      list: function () {
        bootstrap();
        return tracked.filter(function (t) { return !t.error; }).map(function (t) {
          return { id: t.key, capabilities: t.caps, buttons: t.buttons.slice(), axes: t.axes.slice(), opened: t.opened };
        });
      },
      subscribe: function (onChange) {
        subs.push(onChange);
        var onConnect = function (e) { track(e.device); }, onDisconnect = function (e) { untrack(e.device); };
        if (hid && typeof hid.addEventListener === "function") {
          hid.addEventListener("connect", onConnect);
          hid.addEventListener("disconnect", onDisconnect);
        }
        return function () {
          subs = subs.filter(function (f) { return f !== onChange; });
          if (hid && typeof hid.removeEventListener === "function") {
            hid.removeEventListener("connect", onConnect);
            hid.removeEventListener("disconnect", onDisconnect);
          }
        };
      },
      /* MUST be called from a user gesture — the browser rejects it otherwise.
         An empty result means the person closed the chooser: a normal outcome,
         reported as denial rather than an error. */
      request: function (options) {
        if (!hid || typeof hid.requestDevice !== "function")
          return Promise.reject(new Error("WebHID is not available in this browser"));
        return Promise.resolve(hid.requestDevice({ filters: (options && options.filters) || [] }))
          .then(function (ds) {
            if (!ds || !ds.length) throw new Error("No device was selected");
            ds.forEach(track);
            fire();
            return ds.length;
          });
      },
      requirements: "Chromium-based browser over HTTPS or localhost. On Linux the device needs udev read/write permission for your user; on Windows a vendor driver may claim the device and hide it from the browser.",
      _tracked: function () { return tracked; }
    };
  }

  /* Merge several sources so a gamepad-class controller and a HID pedal can be
     live at the same time. */
  function compositeSource(sources) {
    var live = (sources || []).filter(function (s) { return s && s.supported(); });
    return {
      supported: function () { return live.length > 0; },
      list: function () {
        return live.reduce(function (acc, s) { return acc.concat(s.list() || []); }, []);
      },
      subscribe: function (f) {
        var offs = live.map(function (s) { return s.subscribe(f); });
        return function () { offs.forEach(function (o) { if (o) o(); }); };
      },
      request: function (o) {
        var able = live.filter(function (s) { return typeof s.request === "function"; });
        if (!able.length) return Promise.reject(new Error("No source in this browser can prompt for a device"));
        return able[0].request(o);
      },
      requirements: live.map(function (s) { return s.requirements; }).filter(Boolean).join(" "),
      sources: live
    };
  }

  /* ---------- mock source, for tests and for the "no hardware here" case ---------- */
  function mockSource(initial) {
    var devices = (initial || []).slice(), subs = [];
    function fire() { subs.forEach(function (f) { f(); }); }
    return {
      supported: function () { return true; },
      list: function () { return devices.map(function (d) { return JSON.parse(JSON.stringify(d)); }); },
      subscribe: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
      /* test controls */
      _attach: function (d) { devices.push(d); fire(); },
      _detach: function (id) { devices = devices.filter(function (d) { return d.id !== id; }); fire(); },
      _press: function (id, i, down) {
        devices.forEach(function (d) { if (d.id === id) d.buttons[i] = !!down; });
      },
      _setDevices: function (list) { devices = list.slice(); fire(); }
    };
  }

  /* ============================================================
     Manager
     ============================================================ */
  function createManager(opts) {
    opts = opts || {};
    var source  = opts.source || compositeSource([gamepadSource(), hidSource()]);
    var clock   = opts.clock || function () { return Date.now(); };
    var store   = opts.storage || (typeof localStorage !== "undefined" ? localStorage : null);
    var storeKey = opts.storageKey || "rsg.input.mappings.v1";

    var actions = {};          // id -> { id, label, fallbacks: [] }
    var mappings = load();     // deviceId -> { "b0": actionId | [actionIds] }
    var devices = {};          // id -> descriptor
    var prevButtons = {};      // id -> [bool]
    var lastFire = {};         // id+idx -> ms  (debounce)
    var listeners = { action: [], status: [], devicechange: [] };
    var status = { state: source.supported() ? "no-device" : "unsupported", deviceId: null, since: clock(), detail: "" };
    var debounceMs = opts.debounceMs != null ? opts.debounceMs : 40;
    var unsub = null, timer = null, started = false;

    function emit(kind, payload) { (listeners[kind] || []).forEach(function (f) { try { f(payload); } catch (e) {} }); }
    function load() {
      try { return JSON.parse((store && store.getItem(storeKey)) || "{}") || {}; } catch (e) { return {}; }
    }
    function persist() {
      try { store && store.setItem(storeKey, JSON.stringify(mappings)); return true; } catch (e) { return false; }
    }

    function setStatus(state, deviceId, detail) {
      if (STATES.indexOf(state) < 0) state = "unsupported";
      if (status.state === state && status.deviceId === deviceId) return;
      status = { state: state, deviceId: deviceId || null, since: clock(), detail: detail || "" };
      emit("status", describeStatus());
    }

    /* Status is visible, specific and honest — including the states people
       actually hit (denied, unsupported) rather than just connected/not. */
    function describeStatus() {
      var d = status.deviceId && devices[status.deviceId];
      return {
        state: status.state,
        deviceId: status.deviceId,
        capabilities: d ? d.capabilities : null,
        since: status.since,
        detail: status.detail,
        /* Always true by construction — bind() will not create a
           hardware-only action. Surfaced so UI can say so honestly. */
        fallbackAvailable: true,
        message: {
          "unsupported":  "This browser can't talk to input devices. Everything still works on screen and by keyboard.",
          "no-device":    "No input device connected. Everything works on screen and by keyboard.",
          "connected":    "Device connected.",
          "disconnected": "Input device disconnected — your controls still work on screen and by keyboard.",
          "denied":       "Permission to use the device was declined. Everything still works on screen and by keyboard."
        }[status.state]
      };
    }

    /* ---------- actions & fallbacks ---------- */
    function registerAction(id, label, fallbacks) {
      actions[id] = { id: id, label: label || id, fallbacks: (fallbacks || []).slice() };
      return actions[id];
    }
    function addFallback(actionId, method) {
      if (!actions[actionId]) registerAction(actionId);
      if (actions[actionId].fallbacks.indexOf(method) < 0) actions[actionId].fallbacks.push(method);
    }

    /* THE GUARDRAIL, enforced rather than documented: hardware may not become
       the only route to anything. */
    function bind(deviceId, inputKey, actionId) {
      var target = Array.isArray(actionId) ? actionId : [actionId];
      var missing = target.filter(function (a) {
        return !actions[a] || actions[a].fallbacks.length === 0;
      });
      if (missing.length) {
        return { ok: false, error: "no-fallback", actions: missing,
          message: "Refusing to bind " + missing.join(", ") + " to hardware: no non-hardware path is registered for it." };
      }
      mappings[deviceId] = mappings[deviceId] || {};
      mappings[deviceId][inputKey] = Array.isArray(actionId) ? actionId.slice() : actionId;
      persist();
      return { ok: true };
    }
    function unbind(deviceId, inputKey) {
      if (mappings[deviceId]) { delete mappings[deviceId][inputKey]; persist(); }
      return { ok: true };
    }

    /* A default mapping is a starting point, never a constraint. Derived from
       capabilities, so an unknown device gets something usable immediately. */
    function defaultMappingFor(device, order) {
      var m = {}, n = device.capabilities.buttons, seq = (order || Object.keys(actions));
      for (var i = 0; i < n && i < seq.length; i++) m["b" + i] = seq[i];
      return m;
    }
    function mappingFor(deviceId) { return JSON.parse(JSON.stringify(mappings[deviceId] || {})); }

    /* ---------- reconcile connect / disconnect ---------- */
    function reconcile() {
      if (!source.supported()) { setStatus("unsupported", null); return; }
      var list = source.list();
      var seen = {};
      list.forEach(function (d) { seen[d.id] = true; });

      // disconnects first — detected immediately, not on next input attempt
      Object.keys(devices).forEach(function (id) {
        if (!seen[id]) {
          var gone = devices[id];
          delete devices[id]; delete prevButtons[id];
          emit("devicechange", { type: "disconnect", deviceId: id, capabilities: gone.capabilities });
          /* Mapping is NOT dropped — it must survive reconnection. */
          setStatus(Object.keys(devices).length ? "connected" : "disconnected",
                    Object.keys(devices)[0] || null, "device " + id + " went away");
        }
      });

      list.forEach(function (d) {
        var isNew = !devices[d.id];
        devices[d.id] = d;
        if (isNew) {
          if (!mappings[d.id]) { mappings[d.id] = defaultMappingFor(d); persist(); }
          prevButtons[d.id] = d.buttons.slice();
          emit("devicechange", { type: "connect", deviceId: d.id, capabilities: d.capabilities, mapping: mappingFor(d.id) });
          setStatus("connected", d.id, "");
        }
      });

      if (!list.length && status.state !== "disconnected" && status.state !== "denied") setStatus("no-device", null);
    }

    /* ---------- input sampling ---------- */
    function sample() {
      if (!source.supported()) return;
      var list = source.list();
      list.forEach(function (d) {
        var prev = prevButtons[d.id] || [];
        var map = mappings[d.id] || {};
        d.buttons.forEach(function (down, i) {
          var was = !!prev[i];
          if (down && !was) {
            var key = "b" + i, t = clock(), lastKey = d.id + ":" + key;
            /* Debounce is deliberate and configurable: tremor produces repeat
               activations that need filtering, but an aggressive default
               swallows someone else's intentional fast input. */
            if (t - (lastFire[lastKey] || -Infinity) < debounceMs) return;
            lastFire[lastKey] = t;
            var bound = map[key];
            if (!bound) return;
            /* One physical input may trigger a sequence — two switches still
               need to reach twenty actions. */
            (Array.isArray(bound) ? bound : [bound]).forEach(function (a) {
              emit("action", { actionId: a, deviceId: d.id, inputKey: key, at: t, via: "hardware" });
            });
          }
        });
        prevButtons[d.id] = d.buttons.slice();
        devices[d.id] = d;
      });
    }

    function start(pollMs) {
      if (started) return;
      started = true;
      reconcile();
      unsub = source.subscribe(function () { reconcile(); });
      if (typeof setInterval === "function" && pollMs !== 0) {
        timer = setInterval(function () { reconcile(); sample(); }, pollMs || 16);
      }
      return api;
    }
    function stop() {
      started = false;
      if (unsub) { unsub(); unsub = null; }
      if (timer) { clearInterval(timer); timer = null; }
      return api;
    }

    /* Permission is requested only from an explicit user gesture, and denial
       is a normal outcome the app stays fully usable through. */
    function requestPermission(requester) {
      var p;
      try { p = requester ? requester() : Promise.resolve(null); }
      catch (e) { setStatus("denied", null, String(e && e.message || e)); return Promise.resolve({ ok: false, reason: "denied" }); }
      return Promise.resolve(p).then(function (r) {
        reconcile();
        return { ok: true, result: r };
      }, function (err) {
        setStatus("denied", null, String(err && err.message || err));
        return { ok: false, reason: "denied" };
      });
    }

    /* Can this browser prompt for a device at all? Drives whether a "connect"
       control is offered — offering one that cannot work is worse than none. */
    function canRequestDevice() {
      /* A source can define request() and still be unusable here (no WebHID in
         this browser). Offering a connect control that cannot work is worse
         than offering none. */
      return typeof source.request === "function" && source.supported();
    }

    /* What the person needs to have done BEFORE they hit a failure. Shown in
       the connect flow, not in an error afterwards. */
    function connectRequirements() { return source.requirements || ""; }

    /* Must be called from a user gesture. */
    function requestDevice(options) {
      if (!canRequestDevice())
        return Promise.resolve({ ok: false, reason: "unsupported",
          message: "This browser can't prompt for an input device. Everything still works on screen and by keyboard." });
      return requestPermission(function () { return source.request(options); });
    }

    var api = {
      start: start, stop: stop,
      canRequestDevice: canRequestDevice,
      connectRequirements: connectRequirements,
      requestDevice: requestDevice,
      reconcile: reconcile, sample: sample,
      registerAction: registerAction, addFallback: addFallback,
      actions: function () { return JSON.parse(JSON.stringify(actions)); },
      bind: bind, unbind: unbind, mappingFor: mappingFor, defaultMappingFor: defaultMappingFor,
      devices: function () { return JSON.parse(JSON.stringify(devices)); },
      status: describeStatus,
      setDebounceMs: function (n) { debounceMs = Math.max(0, n | 0); return api; },
      debounceMs: function () { return debounceMs; },
      requestPermission: requestPermission,
      /* Fire an action from a non-hardware path. Same event shape, so nothing
         downstream can accidentally treat the fallback as second class. */
      trigger: function (actionId, via) {
        emit("action", { actionId: actionId, deviceId: null, inputKey: null, at: clock(), via: via || "fallback" });
      },
      on: function (kind, fn) {
        if (!listeners[kind]) listeners[kind] = [];
        listeners[kind].push(fn);
        return function () { listeners[kind] = listeners[kind].filter(function (f) { return f !== fn; }); };
      },
      /* Auditable: which actions would be unreachable without hardware? Must
         always be empty. */
      hardwareOnlyActions: function () {
        return Object.keys(actions).filter(function (id) { return actions[id].fallbacks.length === 0; });
      }
    };
    return api;
  }

  var API = {
    createManager: createManager,
    gamepadSource: gamepadSource,
    hidSource: hidSource,
    compositeSource: compositeSource,
    mockSource: mockSource,
    /* default stack: gamepad needs no prompt, HID covers pedals and switches
       that aren't keyboard-emulating */
    defaultSource: function () { return compositeSource([gamepadSource(), hidSource()]); },
    STATES: STATES,
    hid: { layoutFor: layoutFor, describeHID: describeHID, readBits: readBits, itemUsages: itemUsages, signed: signed }
  };
  root.RSGInput = API;
  if (typeof module === "object" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : this);
