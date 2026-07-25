/* ============================================================
   RSG // rsg-testkit.js — dev-only error beacon.

   Loaded by an app ONLY when the URL carries ?rsgtest=1 (a two-line
   guard at the top of each app's index.html injects it). Because it runs
   before the app's other scripts, it captures load-time errors, resource
   404s (capture-phase 'error'), unhandled rejections, and console.error —
   everything the test-runner's post-load console hook can't see.

   Production loads (no query flag) include nothing from this file.
   Reads: window.__rsgErrors = [{ kind, msg }, ...].
   ============================================================ */
(function () {
  if (window.__rsgErrors) return;                 // idempotent
  var errs = window.__rsgErrors = [];
  function push(kind, msg) { errs.push({ kind: kind, msg: String(msg).slice(0, 220) }); }

  // capture-phase catches uncaught errors AND failed resource loads (e.g. a 404 <script>)
  window.addEventListener("error", function (e) {
    if (e && e.target && (e.target.src || e.target.href) && e.target !== window)
      push("resource", "failed to load " + (e.target.src || e.target.href));
    else
      push("error", (e && e.message) || (e && e.error && e.error.message) || "error");
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    push("unhandledrejection", (e && e.reason && e.reason.message) || (e && e.reason) || "rejection");
  });

  var oce = console.error;
  console.error = function () { push("console.error", [].slice.call(arguments).join(" ")); return oce.apply(console, arguments); };
})();
