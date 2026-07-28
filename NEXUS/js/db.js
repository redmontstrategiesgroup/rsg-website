/* ============================================================================
   NEXUS // db.js — Supabase-backed save/load, drop-in for the localStorage
   persistence in app.js.

   Load AFTER shared/rsg-supabase.js:
     <script src="../shared/rsg-supabase.js"></script>
     <script src="js/db.js"></script>

   The city stays one document (see 0003_nexus.sql for why). What changes is
   where it lands: a row per save slot, plus a rolling snapshot ring so an
   autosave of a collapsed economy is recoverable.
   ============================================================================ */
(function () {
  "use strict";

  var SB = window.RSGSupabase;
  if (!SB) { console.warn("NEXUS/db.js: RSGSupabase not loaded — staying on localStorage"); return; }

  var NX = window.NX = window.NX || {};
  var DB = { slot: 1, worldId: null, lastError: null };

  function derived(state) {
    return {
      day: state.day || 1,
      minute: state.minute || 0,
      treasury: (state.stats && state.stats.treasury) != null ? state.stats.treasury : null,
      population: Array.isArray(state.residents) ? state.residents.length : null,
    };
  }

  DB.list = function () {
    // Deliberately does NOT select `state`: the slot picker needs four numbers,
    // not several megabytes of city per row.
    return SB.from("nexus_worlds")
      .select("id,name,slot,day,minute,treasury,population,saved_at")
      .eq("user_id", SB.userId())
      .order("saved_at", { ascending: false });
  };

  DB.load = function (slot) {
    DB.slot = slot || DB.slot;
    return SB.from("nexus_worlds").select("*")
      .eq("user_id", SB.userId()).eq("slot", DB.slot).limit(1)
      .then(function (rows) {
        var row = (rows || [])[0];
        if (!row) return null;         // no save yet — a new city, not an error
        DB.worldId = row.id;
        return row.state;
      });
  };

  // Called where APP.save() was. Fire-and-forget by design: the sim ticks on a
  // timer and must never block on the network. A failed save is queued in the
  // outbox and retried, and DB.lastError is what the UI reads to stop showing
  // "saved" over a write that did not land.
  DB.save = function (state, opts) {
    if (!SB.userId()) return Promise.resolve(null);

    var row = Object.assign({
      user_id: SB.userId(),
      slot: DB.slot,
      name: state.name || "Nexus City",
      state: state,
      saved_at: new Date().toISOString(),
    }, derived(state));
    if (DB.worldId) row.id = DB.worldId;

    return SB.from("nexus_worlds").upsert(row, { onConflict: "user_id,slot" }).single()
      .then(function (saved) {
        if (saved && saved.id) DB.worldId = saved.id;
        DB.lastError = null;
        if (opts && opts.snapshot) DB.snapshot(state);
        return saved;
      }, function (err) {
        DB.lastError = err;
        // De-duped by slot: a hundred queued autosaves of the same city are
        // ninety-nine copies of stale state. Keep the newest.
        SB.queueWrite("nexus:world:" + DB.slot,
          "/rest/v1/nexus_worlds?on_conflict=user_id,slot",
          { method: "POST", body: JSON.stringify(row),
            headers: { Prefer: "resolution=merge-duplicates" } });
        console.warn("NEXUS save deferred to outbox", err);
        return null;
      });
  };

  // Trimmed to the last 10 per world by a database trigger, so the bound holds
  // no matter which device wrote them.
  DB.snapshot = function (state) {
    if (!DB.worldId) return Promise.resolve(null);
    return SB.from("nexus_world_snapshots").insert({
      user_id: SB.userId(), world_id: DB.worldId,
      day: state.day || 1, state: state,
    }).catch(function (err) { console.warn("NEXUS snapshot failed", err); return null; });
  };

  DB.snapshots = function () {
    if (!DB.worldId) return Promise.resolve([]);
    return SB.from("nexus_world_snapshots").select("id,day,created_at")
      .eq("world_id", DB.worldId).order("created_at", { ascending: false });
  };

  DB.restore = function (snapshotId) {
    return SB.from("nexus_world_snapshots").select("state")
      .eq("id", snapshotId).eq("user_id", SB.userId()).single()
      .then(function (r) { return r ? r.state : null; });
  };

  DB.settings = function () {
    return SB.from("nexus_settings").select("*").eq("user_id", SB.userId()).limit(1)
      .then(function (rows) { return (rows || [])[0] || null; });
  };

  DB.saveSettings = function (s) {
    return SB.from("nexus_settings").upsert(
      Object.assign({ user_id: SB.userId(), updated_at: new Date().toISOString() }, s),
      { onConflict: "user_id" });
  };

  NX.db = DB;
})();
