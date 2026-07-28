/* ============================================================================
   Observatory // db.js — Supabase-backed store, drop-in for OBS.store in core.js.

   Load AFTER shared/rsg-supabase.js:
     <script src="../shared/rsg-supabase.js"></script>
     <script src="js/db.js"></script>

   Same cache-through shape as GHOST's: hydrate once, read from memory, write
   through. OBS.store.data keeps the exact structure the app already expects
   ({ scenarios, reports, audit, calibrations, imports, settings,
   paramOverrides }), so charts.js / report.js / ui.js are untouched.

   Two behaviours intentionally do NOT carry over from core.js:

     - the quota fallback that trimmed to the last 5 reports and 200 audit rows.
       It existed for a 5MB browser quota; silently deleting a user's reports is
       a data-loss bug, not a storage strategy.

     - `settings.role`. Role now comes from app_users.role, which the browser
       cannot write, and is enforced by RLS. OBS.can() below reads the server's
       answer instead of a value the client could set to "admin" itself.
   ============================================================================ */
(function () {
  "use strict";

  var SB = window.RSGSupabase;
  if (!SB) { console.warn("Observatory/db.js: RSGSupabase not loaded — staying on localStorage"); return; }

  var OBS = window.OBS = window.OBS || {};
  var DB = { lastError: null };

  var TABLES = {
    scenarios: "obs_scenarios", reports: "obs_reports",
    calibrations: "obs_calibrations", imports: "obs_imports",
  };

  var data = null;
  var role = "viewer";

  DB.hydrate = function () {
    var uid = SB.userId();
    if (!uid) return Promise.reject(new Error("not signed in"));

    data = {
      v: 1, scenarios: [], reports: [], audit: [], calibrations: [], imports: [],
      settings: { theme: "light", seeds: 7, copilotModel: "claude-opus-4-8" },
      paramOverrides: {},
    };

    return Promise.all(Object.keys(TABLES).map(function (k) {
      return SB.from(TABLES[k]).select("*").eq("user_id", uid)
        .order("created_at", { ascending: false })
        .then(function (rows) { data[k] = rows || []; });
    }).concat([
      SB.from("obs_settings").select("*").eq("user_id", uid).limit(1).then(function (rows) {
        var r = (rows || [])[0];
        if (r) {
          data.settings = { theme: r.theme, seeds: r.seeds, copilotModel: r.copilot_model };
          data.paramOverrides = r.param_overrides || {};
        }
      }),
      SB.from("obs_audit").select("*").eq("user_id", uid)
        .order("created_at", { ascending: false }).limit(1000)
        .then(function (rows) { data.audit = rows || []; }),
      SB.from("app_users").select("role").eq("id", uid).limit(1).then(function (rows) {
        role = ((rows || [])[0] || {}).role || "member";
      }),
    ])).then(function () {
      OBS.store.data = data;
      return data;
    });
  };

  /* ---- the OBS.store surface, preserved ---------------------------------- */

  OBS.store = OBS.store || {};
  OBS.store.data = null;
  OBS.store.load = function () { return data; };   // hydrate() fills it; this just returns it

  // Persist one record. core.js called save() after mutating the blob; here the
  // caller names what changed, so a scenario edit does not rewrite every report.
  DB.put = function (coll, obj) {
    var table = TABLES[coll];
    if (!table) return Promise.reject(new Error("unknown collection " + coll));
    var row = Object.assign({}, obj, { user_id: SB.userId() });
    return SB.from(table).upsert(row, { onConflict: "id" }).single()
      .then(function (saved) {
        DB.lastError = null;
        var list = data[coll], i = list.findIndex(function (r) { return r.id === saved.id; });
        if (i >= 0) list[i] = saved; else list.unshift(saved);
        return saved;
      }, function (err) { DB.lastError = err; throw err; });
  };

  DB.remove = function (coll, id) {
    var table = TABLES[coll];
    return SB.from(table).delete().eq("id", id).eq("user_id", SB.userId())
      .then(function () {
        data[coll] = data[coll].filter(function (r) { return r.id !== id; });
      });
  };

  DB.saveSettings = function () {
    return SB.from("obs_settings").upsert({
      user_id: SB.userId(),
      theme: data.settings.theme,
      seeds: data.settings.seeds,
      copilot_model: data.settings.copilotModel,
      param_overrides: data.paramOverrides,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  };

  /* ---- audit ------------------------------------------------------------- */

  OBS.audit = function (action, detail) {
    var rec = {
      created_at: new Date().toISOString(),
      action: action,
      detail: String(detail == null ? "" : detail).slice(0, 300),
    };
    if (data) data.audit.unshift(rec);
    return SB.from("obs_audit").insert(Object.assign({ user_id: SB.userId() }, rec))
      .catch(function (err) { console.warn("Observatory audit write failed", err); });
  };

  /* ---- role -------------------------------------------------------------- */

  // Mirrors the database's obs_role_rank(). The database is the authority; this
  // is only so the UI can grey out a control instead of letting the user press
  // it and collect a 403. Never rely on it as the gate.
  OBS.can = function (need) {
    var rank = { viewer: 0, member: 1, analyst: 1, admin: 2 };
    var order = { viewer: 0, analyst: 1, admin: 2 };
    return (rank[role] == null ? 0 : rank[role]) >= order[need];
  };

  DB.role = function () { return role; };

  OBS.db = DB;
})();
