/* ============================================================
   GHOST // lib.js — core helpers, reactive store, event bus
   Everything hangs off the global window.G namespace.
   ============================================================ */
(function () {
  "use strict";
  const G = (window.G = window.G || {});

  /* ---------- DOM ---------- */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "text") el.textContent = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
        else if (k === "data" && typeof v === "object") for (const d in v) el.dataset[d] = v[d];
        else el.setAttribute(k, v);
      }
    }
    if (children != null) append(el, children);
    return el;
  }
  function append(el, children) {
    if (Array.isArray(children)) children.forEach((c) => append(el, c));
    else if (children instanceof Node) el.appendChild(children);
    else if (children != null) el.appendChild(document.createTextNode(String(children)));
  }
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  function clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); return el; }
  function mount(el, node) { clear(el); append(el, node); return el; }

  /* ---------- format ---------- */
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  function clock(d) { d = d || new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
  function money(n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function compact(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return String(Math.round(n));
  }
  function dur(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${pad(m)}:${pad(s)}`;
  }

  /* ---------- random ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const rint = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  function id() { return "x" + Math.random().toString(36).slice(2, 9); }

  /* ---------- event bus ---------- */
  const bus = (function () {
    const map = {};
    return {
      on(ev, fn) { (map[ev] = map[ev] || []).push(fn); return () => this.off(ev, fn); },
      off(ev, fn) { if (map[ev]) map[ev] = map[ev].filter((f) => f !== fn); },
      emit(ev, payload) { (map[ev] || []).forEach((f) => { try { f(payload); } catch (e) { console.error(e); } }); },
    };
  })();

  /* ---------- reactive store ---------- */
  function createStore(initial) {
    let state = initial;
    const subs = new Set();
    return {
      get: () => state,
      set(patch) {
        state = typeof patch === "function" ? patch(state) : Object.assign({}, state, patch);
        subs.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
      },
      subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    };
  }

  /* ---------- misc ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clampv(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  Object.assign(G, {
    h, append, $, $$, clear, mount,
    pad, clock, money, compact, dur,
    rnd, rint, pick, chance, id,
    bus, createStore, lerp, clampv, easeInOut,
  });
})();
