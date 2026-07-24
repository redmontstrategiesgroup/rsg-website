/* NEXUS Observatory — boot & wiring */
(function () {
  const APP = (OBS.app = {});

  APP.applyBusinessImport = function (rec) {
    const g = APP.world.graph;
    const src = { kind: "csv-import", ref: "user upload", date: new Date().toISOString().slice(0, 10) };
    let e = g.get(rec.id);
    const num = (v, d) => (v != null && v !== "" && !isNaN(+v) ? +v : d);
    if (!e) {
      e = { id: rec.id, type: "organization", name: rec.name || rec.id, nb: rec.nb || "mt", attrs: {}, source: src, confidence: 0.8, updatedAt: src.date };
      g.add(e); g.link(rec.id, "located_in", e.nb);
      g.link(rec.id, "powered_by", (e.nb === "nf" || e.nb === "mt") ? "sub_north" : "sub_south");
    }
    Object.assign(e.attrs, {
      sector: rec.sector || e.attrs.sector || "retail",
      jobs: num(rec.jobs, e.attrs.jobs ?? 10),
      wage: num(rec.wage, e.attrs.wage ?? 125),
      priceLevel: num(rec.pricelevel ?? rec.price, e.attrs.priceLevel ?? 1),
      quality: num(rec.quality, e.attrs.quality ?? 0.6),
      capacityDaily: num(rec.capacitydaily ?? rec.capacity, e.attrs.capacityDaily ?? 500),
      fixedDaily: num(rec.fixeddaily ?? rec.fixed, e.attrs.fixedDaily ?? 800),
      backupPower: e.attrs.backupPower ?? false,
    });
    e.source = src; e.confidence = 0.8; e.updatedAt = src.date;
    if (rec.nb && rec.nb !== e.nb) e.nb = rec.nb;
  };

  APP.refreshBaseline = async function () {
    const spec = OBS.scenario.newSpec({ name: "__baseline_preview", horizonDays: 30, seeds: 3, metrics: ["unemployment_rate", "avg_commute", "retail_revenue", "clinic_wait"], headlineMetric: "retail_revenue" });
    spec.reviewed = true; // internal preview, assumptions are the documented defaults
    const runs = [];
    for (let seed = 1; seed <= 3; seed++) {
      const r = new OBS.Run(APP.world, spec, { id: "baseline", name: "baseline", deltas: [] }, seed);
      r.runAll(30);
      runs.push(r);
    }
    const agg = {};
    for (const m of spec.metrics) {
      const list = runs.map((r) => r.series[m]);
      agg[m] = { med: OBS.stat.bandOf(list, 0.5), p10: OBS.stat.bandOf(list, 0.1), p90: OBS.stat.bandOf(list, 0.9) };
    }
    APP.baselinePreview = { agg, seeds: 3 };
    if (OBS.ui.S.view === "overview") OBS.ui.rOverview();
  };

  window.addEventListener("DOMContentLoaded", () => {
    OBS.store.load();
    APP.world = OBS.world.build();
    // re-apply persisted imports so imported data survives reload
    for (const imp of OBS.store.data.imports) {
      if (imp.kind === "businesses" && imp.records) for (const rec of imp.records) APP.applyBusinessImport(rec);
    }
    OBS.ui.init();
    APP.refreshBaseline();
  });
})();
