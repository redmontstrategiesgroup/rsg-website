/* ============================================================================
   GHOST // db.js — Supabase-backed store, drop-in for store.js.

   Load AFTER shared/rsg-supabase.js and BEFORE the rest of GHOST:

     <script src="../shared/rsg-supabase.js"></script>
     <script src="js/db.js"></script>

   DESIGN: cache-through, not async-everywhere.

   store.js is synchronous — `G.store.all("entities")` returns an array, and the
   engine, planner, orchestrator and every renderer are written against that.
   Making the store async would mean rewriting all of them, which is not a
   storage change, it is a rewrite.

   So: hydrate the user's rows into memory once at boot, serve every read from
   memory exactly as before, and write through to Postgres in the background.
   Same API, same call sites, durable underneath.

   The honest limit of that trade: a write is acknowledged locally before the
   server has confirmed it. `G.db.pending()` exposes the unflushed count and
   `G.db.onError` fires on a write that could not be persisted — GHOST must
   surface both rather than showing a clean UI over a failed save. A store whose
   whole purpose is "actions are REAL (persisted + inspectable)" cannot quietly
   lie about persistence.
   ============================================================================ */
(function () {
  "use strict";

  var SB = window.RSGSupabase;
  if (!SB) { console.warn("GHOST/db.js: RSGSupabase not loaded — staying on localStorage"); return; }

  var G = window.G = window.G || {};
  var DB = {};

  // collection name -> table
  var TABLES = {
    entities: "ghost_entities", edges: "ghost_edges", commands: "ghost_commands",
    plans: "ghost_plans", runs: "ghost_runs", tasks: "ghost_tasks",
    approvals: "ghost_approvals", verifications: "ghost_verifications",
    notifications: "ghost_notifications",
  };
  var COLLECTIONS = Object.keys(TABLES);

  var mem = {};              // coll -> { id: row }
  var settings = {};
  var auditBuf = [];
  var pending = 0;
  var errorHandlers = [];

  COLLECTIONS.forEach(function (c) { mem[c] = {}; });

  function fail(where, err) {
    pending = Math.max(0, pending - 1);
    console.error("GHOST/db " + where + " failed", err);
    errorHandlers.forEach(function (fn) { try { fn(where, err); } catch (e) {} });
  }

  DB.onError = function (fn) { errorHandlers.push(fn); };
  DB.pending = function () { return pending + SB.outboxSize(); };

  /* ------------------------------------------------------------- hydrate */

  DB.hydrate = function () {
    var uid = SB.userId();
    if (!uid) return Promise.reject(new Error("not signed in"));

    return Promise.all(COLLECTIONS.map(function (coll) {
      return SB.from(TABLES[coll]).select("*").eq("user_id", uid).then(function (rows) {
        mem[coll] = {};
        (rows || []).forEach(function (r) { mem[coll][r.id] = inflate(r); });
      });
    })).then(function () {
      return SB.from("ghost_settings").select("*").eq("user_id", uid).then(function (rows) {
        var r = (rows || [])[0];
        settings = r
          ? Object.assign({ activeView: r.active_view, mode: r.mode, seeded: r.seeded }, r.data || {})
          : { onehand: null, activeView: "ops", mode: "build", seeded: false };
      });
    }).then(function () {
      return SB.from("ghost_audit").select("*").eq("user_id", uid)
        .order("created_at", { ascending: false }).limit(500)
        .then(function (rows) { auditBuf = rows || []; });
    });
  };

  // Rows carry promoted columns plus a `data` jsonb. GHOST's objects are flat,
  // so flatten them back into the shape the app has always seen.
  function inflate(row) {
    var o = Object.assign({}, row.data || {}, row);
    delete o.data; delete o.user_id;
    return o;
  }

  // Split an app object back into promoted columns + the jsonb remainder.
  var PROMOTED = {
    entities: ["kind", "name", "status"], edges: ["from_id", "to_id", "rel"],
    commands: ["text", "status"], plans: ["command_id", "title", "status"],
    runs: ["plan_id", "status", "started_at", "ended_at"],
    tasks: ["run_id", "seq", "title", "status"],
    approvals: ["task_id", "status", "decided_at"],
    verifications: ["task_id", "ok", "method"],
    notifications: ["level", "body", "read_at"],
  };

  function deflate(coll, obj) {
    var cols = PROMOTED[coll] || [];
    var row = { id: obj.id, user_id: SB.userId() };
    var rest = {};
    Object.keys(obj).forEach(function (k) {
      if (k === "id" || k === "created_at" || k === "updated_at") return;
      if (cols.indexOf(k) >= 0) row[k] = obj[k];
      else rest[k] = obj[k];
    });
    row.data = rest;
    return row;
  }

  /* --------------------------------------------------------------- reads */

  DB.all = function (coll) { return Object.values(mem[coll] || {}); };
  DB.get = function (coll, id) { return (mem[coll] || {})[id]; };
  DB.query = function (coll, pred) { return DB.all(coll).filter(pred); };
  DB.auditLog = function () { return auditBuf.slice(); };
  DB.raw = function () { return { mem: mem, settings: settings }; };

  /* -------------------------------------------------------------- writes */

  function uuid() {
    return (crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          var r = Math.random() * 16 | 0;
          return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
        });
  }

  DB.put = function (coll, obj) {
    if (!obj.id) obj.id = uuid();
    mem[coll][obj.id] = obj;                       // local first: UI stays instant
    G.bus && G.bus.emit("store:change", { coll: coll, id: obj.id, obj: obj });

    pending++;
    var row = deflate(coll, obj);
    SB.from(TABLES[coll]).upsert(row, { onConflict: "id" })
      .then(function () { pending--; }, function (err) {
        SB.queueWrite(TABLES[coll] + ":" + obj.id,
          "/rest/v1/" + TABLES[coll] + "?on_conflict=id",
          { method: "POST", body: JSON.stringify(row),
            headers: { Prefer: "resolution=merge-duplicates" } });
        fail("put " + coll, err);
      });
    return obj;
  };

  DB.patch = function (coll, id, changes) {
    var cur = mem[coll][id];
    if (!cur) return null;
    var before = Object.assign({}, cur);
    Object.assign(cur, typeof changes === "function" ? changes(cur) : changes);
    G.bus && G.bus.emit("store:change", { coll: coll, id: id, obj: cur, before: before });
    return DB.put(coll, cur);
  };

  DB.remove = function (coll, id) {
    var obj = mem[coll][id];
    delete mem[coll][id];
    G.bus && G.bus.emit("store:change", { coll: coll, id: id, removed: true, obj: obj });
    pending++;
    SB.from(TABLES[coll]).delete().eq("id", id).eq("user_id", SB.userId())
      .then(function () { pending--; }, function (err) { fail("remove " + coll, err); });
  };

  /* --------------------------------------------------------------- audit

     Append-only in the database (insert + select policies, no update/delete),
     and no 2000-record trim: that cap existed only to fit a 5MB browser quota.
     Discarding audit history is the opposite of what this log is for. */

  DB.audit = function (evt) {
    var rec = Object.assign({ created_at: new Date().toISOString() }, evt);
    auditBuf.unshift(rec);
    G.bus && G.bus.emit("audit", rec);

    pending++;
    SB.from("ghost_audit").insert({
      user_id: SB.userId(),
      action: evt.action || evt.type || "event",
      coll: evt.coll || null,
      target_id: evt.id || evt.target_id || null,
      detail: evt.detail || evt,
    }).then(function () { pending--; }, function (err) { fail("audit", err); });

    return rec;
  };

  /* ------------------------------------------------------------ settings */

  DB.setting = function (k, v) {
    if (v === undefined) return settings[k];
    settings[k] = v;
    pending++;
    var known = { activeView: "active_view", mode: "mode", seeded: "seeded" };
    var row = { user_id: SB.userId(), updated_at: new Date().toISOString() };
    Object.keys(settings).forEach(function (key) {
      if (known[key]) row[known[key]] = settings[key];
    });
    row.data = Object.keys(settings).reduce(function (acc, key) {
      if (!known[key]) acc[key] = settings[key];
      return acc;
    }, {});
    SB.from("ghost_settings").upsert(row, { onConflict: "user_id" })
      .then(function () { pending--; }, function (err) { fail("setting", err); });
    return v;
  };

  // No reset(): store.js's reset() wiped the blob. Here it would delete a
  // signed-in user's real rows, so it is a deliberate, confirmed action in the
  // UI rather than a function sitting next to the ordinary write helpers.

  DB.COLLECTIONS = COLLECTIONS;
  G.db = DB;
})();
