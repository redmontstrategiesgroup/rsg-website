/* ============================================================================
   Onehand OS // db.js — ability profile custody + per-app grants.

   Load AFTER shared/rsg-supabase.js:
     <script src="../shared/rsg-supabase.js"></script>
     <script src="js/db.js"></script>

   Onehand OS is the sole writer of `rsg.ability.v1` (CONTRACTS.md Contract 1),
   and under the per-app split it becomes its custodian. The profile lives in
   this project's database only. The other four apps never read this table; they
   call the `profile-read` edge function, which checks the grant on every call.

   Contract 1 is preserved exactly: unanswered dimensions are OMITTED, never
   written with a guessed middle value, so ability-resolver.js can report them
   in layout.unresolved and the gap stays visible.

   Contract 2 changes on purpose: there is no shared `rsg.anthropic_key` any
   more. The key moved into each project's Supabase secrets behind that
   project's `ai` edge function, so an XSS on this origin no longer hands
   someone the key.
   ============================================================================ */
(function () {
  "use strict";

  var SB = window.RSGSupabase;
  if (!SB) { console.warn("Onehand OS/db.js: RSGSupabase not loaded — staying on localStorage"); return; }

  var OHOS = window.OHOS = window.OHOS || {};
  var DB = {};

  var OPTIONAL = ["grip", "fatigue", "precision", "permanence"];

  /* ------------------------------------------------------------- profile */

  DB.loadProfile = function () {
    var uid = SB.userId();
    if (!uid) return Promise.resolve(null);
    return SB.from("onehand_profiles").select("*").eq("user_id", uid).limit(1)
      .then(function (rows) {
        var p = (rows || [])[0];
        if (!p) return null;         // no profile is a normal state, not an error

        var out = {
          v: 1,
          hand: p.hand,
          fingers: p.fingers,
          reachMM: p.reach_mm,
          inputs: p.inputs || [],
          targetScale: Number(p.target_scale),
        };
        // Omit, don't default. A guessed 'moderate' is indistinguishable from a
        // stated one and silently produces a layout for a person who does not exist.
        OPTIONAL.forEach(function (k) { if (p[k] !== null) out[k] = p[k]; });
        return out;
      });
  };

  DB.saveProfile = function (profile) {
    var uid = SB.userId();
    if (!uid) return Promise.reject(new Error("not signed in"));

    var row = {
      user_id: uid,
      v: 1,
      hand: profile.hand === "left" ? "left" : "right",
      fingers: profile.fingers || {},
      reach_mm: profile.reachMM == null ? null : Number(profile.reachMM),
      inputs: profile.inputs || [],
      target_scale: profile.targetScale == null ? 1.4 : Number(profile.targetScale),
      updated_at: new Date().toISOString(),
    };
    // An absent key writes NULL — which is how "unanswered" is stored, and how
    // it must stay if the person clears an answer they previously gave.
    OPTIONAL.forEach(function (k) {
      row[k] = (profile[k] === undefined || profile[k] === "") ? null : profile[k];
    });

    return SB.from("onehand_profiles").upsert(row, { onConflict: "user_id" })
      .then(function (r) { DB.logLocal("update"); return r; });
  };

  /* -------------------------------------------------------------- grants */

  DB.grants = function () {
    return SB.from("onehand_profile_grants").select("app,granted_at,revoked_at")
      .eq("user_id", SB.userId());
  };

  DB.grant = function (app) {
    return SB.from("onehand_profile_grants").upsert({
      user_id: SB.userId(), app: app,
      granted_at: new Date().toISOString(), revoked_at: null,
    }, { onConflict: "user_id,app" });
  };

  // Revoke sets revoked_at rather than deleting, so "did this app ever have
  // access, and when did that stop" stays answerable. Takes effect on the app's
  // next call — profile-read checks the grant every time, not on a sync.
  DB.revoke = function (app) {
    return SB.from("onehand_profile_grants")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", SB.userId()).eq("app", app);
  };

  /* ---------------------------------------------------------- access log */

  // Who looked at this, and when. For data this sensitive, a grant you cannot
  // audit is not meaningfully a grant.
  DB.accessLog = function (limit) {
    return SB.from("onehand_access_log").select("app,action,ok,created_at")
      .eq("user_id", SB.userId())
      .order("created_at", { ascending: false })
      .limit(limit || 100);
  };

  // The shell's own profile edits are not written to onehand_access_log — that
  // table has no client insert policy, precisely so a client cannot forge or
  // suppress entries. Edge functions write it. This is a local UI breadcrumb.
  DB.logLocal = function (action) {
    try {
      var k = "ohos.locallog";
      var log = JSON.parse(localStorage.getItem(k) || "[]");
      log.unshift({ action: action, at: new Date().toISOString() });
      localStorage.setItem(k, JSON.stringify(log.slice(0, 50)));
    } catch (e) {}
  };

  /* ------------------------------------------------------------ settings */

  DB.loadSettings = function () {
    return SB.from("onehand_settings").select("*").eq("user_id", SB.userId()).limit(1)
      .then(function (rows) { return (rows || [])[0] || { hand: "right", data: {} }; });
  };

  DB.saveSettings = function (s) {
    return SB.from("onehand_settings").upsert({
      user_id: SB.userId(),
      hand: (s && s.hand) || "right",
      data: (s && s.data) || {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  };

  OHOS.db = DB;
})();
