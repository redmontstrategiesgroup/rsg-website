/* ============================================================
   GHOST // store.js — durable state + immutable audit log
   localStorage-backed. Every mutation can write an audit event.
   This is the substrate that makes actions REAL (persisted +
   inspectable) instead of ephemeral demo state.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const KEY = "ghost:v2";

  const COLLECTIONS = [
    "entities",       // world-model nodes (systems, devices, clients, deployments, …)
    "edges",          // typed relationships between entities
    "commands",       // natural-language directives the operator issued
    "plans",          // structured execution plans produced by the planner
    "runs",           // orchestration runs (a plan being executed)
    "tasks",          // individual agent tasks within a run
    "approvals",      // pending / resolved human approvals
    "audit",          // append-only event log
    "verifications",  // verification records (proof a task really happened)
    "memories",       // scoped memory items
    "notifications",  // operator-facing notifications
  ];

  let db = null;
  let saveTimer = null;

  function blank() {
    const o = { _v: 2 };
    COLLECTIONS.forEach((c) => (o[c] = {}));
    o.audit = [];        // audit is an array (ordered, append-only)
    o.settings = { onehand: null, activeView: "ops", mode: "build", seeded: false };
    return o;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { db = JSON.parse(raw); COLLECTIONS.forEach((c) => { if (!db[c]) db[c] = c === "audit" ? [] : {}; }); if (!db.settings) db.settings = blank().settings; }
    } catch (e) { console.warn("store load failed", e); }
    if (!db) db = blank();
    return db;
  }

  function persist() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn("store persist failed", e); }
    }, 120);
  }

  /* ---------- generic collection ops ---------- */
  function all(coll) { return Object.values(db[coll] || {}); }
  function get(coll, id) { return (db[coll] || {})[id]; }
  function put(coll, obj) {
    if (!obj.id) obj.id = G.id();
    db[coll][obj.id] = obj;
    persist();
    G.bus.emit("store:change", { coll, id: obj.id, obj });
    return obj;
  }
  function patch(coll, id, changes) {
    const cur = db[coll][id];
    if (!cur) return null;
    const before = Object.assign({}, cur);
    Object.assign(cur, typeof changes === "function" ? changes(cur) : changes);
    persist();
    G.bus.emit("store:change", { coll, id, obj: cur, before });
    return cur;
  }
  function remove(coll, id) {
    const obj = db[coll][id];
    delete db[coll][id];
    persist();
    G.bus.emit("store:change", { coll, id, removed: true, obj });
  }
  function query(coll, pred) { return all(coll).filter(pred); }

  /* ---------- audit (append-only) ---------- */
  function audit(evt) {
    const rec = Object.assign({ id: G.id(), ts: Date.now() }, evt);
    db.audit.push(rec);
    if (db.audit.length > 2000) db.audit.shift();
    persist();
    G.bus.emit("audit", rec);
    return rec;
  }
  function auditLog() { return db.audit.slice().reverse(); }

  /* ---------- settings ---------- */
  function setting(k, v) {
    if (v === undefined) return db.settings[k];
    db.settings[k] = v; persist(); return v;
  }

  function reset() { db = blank(); persist(); G.bus.emit("store:reset"); }
  function raw() { return db; }

  load();

  G.store = { COLLECTIONS, all, get, put, patch, remove, query, audit, auditLog, setting, reset, raw, persist };
})();
