/* Observatory server adapter (RSG portal embed).
 *
 * Loaded AFTER the app scripts. When the app runs inside the authenticated
 * /portal/observatory iframe, this routes persistence and the AI copilot to the
 * tenant-scoped server API instead of localStorage + a browser Anthropic key:
 *   - scenarios/reports  -> /api/portal/observatory/{scenarios,reports}
 *   - copilot parse/brief -> /api/portal/observatory/copilot  (server-side key)
 *
 * It probes the API once; if the user is not signed in (401) or the API is
 * unreachable (standalone use / dev), it stays in LOCAL mode and the original
 * localStorage + local-fallback behavior is preserved. Everything is guarded so
 * a mismatch degrades to a console warning, never a broken boot.
 */
(function () {
  try {
    var OBS = window.OBS;
    if (!OBS) return;
    var BASE = "/api/portal/observatory";
    var SERVER = null; // null = not yet probed; true/false after

    function csrf() {
      var m = document.cookie.match(/(?:^|;\s*)rsg_csrf=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : "";
    }
    function post(path, body) {
      return fetch(BASE + path, {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": csrf() },
        body: JSON.stringify(body),
      }).then(function (r) {
        if (!r.ok) throw Object.assign(new Error("api " + r.status), { status: r.status });
        return r.json();
      });
    }
    function get(path) {
      return fetch(BASE + path, { headers: { accept: "application/json" } }).then(function (r) {
        if (!r.ok) throw Object.assign(new Error("api " + r.status), { status: r.status });
        return r.json();
      });
    }

    // ---- persistence: hydrate from server, mirror saves to server -----------
    var origSaveSpec = OBS.scenario && OBS.scenario.saveSpec;
    if (origSaveSpec) {
      OBS.scenario.saveSpec = function (spec) {
        origSaveSpec.call(OBS.scenario, spec); // keep in-memory + local cache
        if (SERVER) post("/scenarios", { action: "save", spec }).catch(warn("scenario save"));
      };
    }
    var origReportSave = OBS.report && OBS.report.save;
    if (origReportSave) {
      OBS.report.save = function (report) {
        origReportSave.call(OBS.report, report);
        if (SERVER) {
          post("/reports", {
            action: "save",
            report: {
              reportId: report.id,
              specId: report.specId,
              name: report.name,
              html: report.html,
              meta: report.meta || {},
            },
          }).catch(warn("report save"));
        }
      };
    }

    function hydrate() {
      if (!SERVER) return;
      get("/scenarios")
        .then(function (d) {
          if (d && Array.isArray(d.scenarios)) {
            OBS.store.data.scenarios = d.scenarios.map(function (s) { return s.spec; }).filter(Boolean);
          }
          return get("/reports");
        })
        .then(function (d) {
          if (d && Array.isArray(d.reports)) {
            OBS.store.data.reports = d.reports.map(function (r) {
              return { id: r.reportId, specId: r.specId, name: r.name, html: r.html, meta: r.meta, createdAt: r.createdAt };
            });
          }
          // Views read OBS.store.data on navigation; nudge a re-render if we can.
          try { if (OBS.ui && typeof OBS.ui.refresh === "function") OBS.ui.refresh(); } catch (e) {}
        })
        .catch(warn("hydrate"));
    }

    // ---- copilot: route to the server (holds the key + prompts + schema) -----
    var CP = OBS.copilot;
    if (CP) {
      CP.enabled = function () { return SERVER === true; };
      CP.parseScenario = function (text) {
        var world = OBS.app.world;
        var catalog = {
          roads: world.graph.byType("road").map(function (r) { return { id: r.id, name: r.name }; }),
          neighborhoods: world.graph.byType("neighborhood").map(function (n) { return { id: n.id, name: n.name }; }),
          organizations: world.graph.byType("organization").map(function (o) {
            return { id: o.id, name: o.name, sector: o.attrs.sector, jobs: o.attrs.jobs };
          }),
          substations: [
            { id: "sub_north", serves: "Northfield, Midtown" },
            { id: "sub_south", serves: "Harbor Point, Old Row, Eastgate, Westside Industrial" },
          ],
          sectors: ["grocery", "dining", "retail", "services", "fitness", "healthcare"],
          params: OBS.world.PARAMS.map(function (p) { return p.key; }),
        };
        return post("/copilot", { action: "parse", text: text, catalog: catalog }).then(function (res) {
          var out = res.parsed || {};
          var spec = OBS.scenario.newSpec({
            name: out.name,
            objective: out.objective || text,
            horizonDays: OBS.clamp(out.horizonDays || 90, 14, 400),
            headlineMetric: out.headlineMetric,
            branches: (out.branches || []).map(function (b, i) {
              return { id: "b" + (i + 1), name: b.name, deltas: (b.deltas || []).map(clean) };
            }),
          });
          spec.flags = (out.unmapped || [])
            .map(function (u) { return { level: "blocked", text: "Not modeled: " + u }; })
            .concat((out.inferred_assumptions || []).map(function (a) { return { level: "review", text: a }; }));
          if (spec.branches.some(function (b) { return b.deltas.some(function (d) { return d.type === "open_business"; }); })) {
            spec.watchOrg = "newbiz";
            spec.branches.forEach(function (b) {
              b.deltas.forEach(function (d) { if (d.type === "open_business") d.orgId = "newbiz"; });
            });
          }
          return spec;
        });
        function clean(d) {
          var o = {};
          for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k) && d[k] != null) o[k] = d[k];
          if (o.startDay == null) o.startDay = 8;
          return o;
        }
      };
      CP.brief = function (spec, results, sensitivity) {
        var evidence = CP.evidencePack(spec, results, sensitivity);
        return post("/copilot", { action: "brief", evidence: evidence }).then(function (res) {
          var brief = res.brief || {};
          brief.generator = "copilot (server)";
          return brief;
        });
      };
    }

    function warn(what) {
      return function (e) { console.warn("[obs-adapter] " + what + " failed", e && e.status ? e.status : e); };
    }

    // Probe once, then hydrate. A 401/failure leaves SERVER=false (local mode).
    get("/scenarios").then(
      function () { SERVER = true; hydrate(); },
      function () { SERVER = false; }
    );
  } catch (e) {
    console.warn("[obs-adapter] init failed; staying in local mode", e);
  }
})();
