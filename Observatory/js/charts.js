/* NEXUS Observatory — chart primitives (SVG). Follows the dataviz method:
   thin marks, uncertainty bands, legend for ≥2 series + direct end labels,
   recessive grid, hover crosshair + tooltip, table view for accessibility. */
(function () {
  const C = (OBS.charts = {});
  const NS = "http://www.w3.org/2000/svg";
  const SERIES = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6", "--s7", "--s8"];
  C.seriesColor = (i) => `var(${SERIES[i % SERIES.length]})`;

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  const nice = (v) => {
    if (v == null || !isFinite(v)) return "—";
    const a = Math.abs(v);
    if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
    if (a >= 1e4) return (v / 1e3).toFixed(0) + "k";
    if (a >= 100) return v.toFixed(0);
    if (a >= 1) return v.toFixed(1);
    return v.toFixed(2);
  };

  // cfg: {title, unit, series: [{name, color, med, p10?, p90?}], fmt?, height?, markers?: [{day,label}]}
  C.line = function (container, cfg) {
    container.innerHTML = "";
    const W2 = container.clientWidth || 560, H2 = cfg.height || 240;
    const pad = { l: 46, r: 86, t: cfg.title ? 30 : 12, b: 26 };
    const iw = W2 - pad.l - pad.r, ih = H2 - pad.t - pad.b;
    const n = Math.max(...cfg.series.map((s) => s.med.length));
    let lo = Infinity, hi = -Infinity;
    for (const s of cfg.series) for (const arr of [s.med, s.p10, s.p90]) if (arr) for (const v of arr) if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (!isFinite(lo)) { lo = 0; hi = 1; }
    if (lo > 0 && lo / (hi || 1) < 0.35) lo = 0;
    if (hi === lo) hi = lo + 1;
    const X = (i) => pad.l + (i / Math.max(1, n - 1)) * iw;
    const Y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;

    const wrap = document.createElement("div");
    wrap.className = "chart";
    const svg = el("svg", { width: "100%", height: H2, viewBox: `0 0 ${W2} ${H2}` });
    wrap.appendChild(svg);

    if (cfg.title) { const t = el("text", { x: pad.l, y: 16, class: "ch-title" }, svg); t.textContent = cfg.title; }
    // grid + y ticks
    for (let g = 0; g <= 4; g++) {
      const v = lo + ((hi - lo) * g) / 4, y = Y(v);
      el("line", { x1: pad.l, x2: W2 - pad.r, y1: y, y2: y, class: "ch-grid" }, svg);
      const t = el("text", { x: pad.l - 6, y: y + 3, class: "ch-tick", "text-anchor": "end" }, svg);
      t.textContent = nice(v);
    }
    // x ticks (5)
    for (let g = 0; g <= 4; g++) {
      const i = Math.round(((n - 1) * g) / 4);
      const t = el("text", { x: X(i), y: H2 - 8, class: "ch-tick", "text-anchor": "middle" }, svg);
      t.textContent = "d" + (i + 1);
    }
    // event markers
    for (const mk of cfg.markers || []) {
      if (mk.day < 1 || mk.day > n) continue;
      el("line", { x1: X(mk.day - 1), x2: X(mk.day - 1), y1: pad.t, y2: pad.t + ih, class: "ch-marker" }, svg);
    }
    const path = (arr, close) => {
      let d = "";
      arr.forEach((v, i) => { if (v == null) return; d += (d ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); });
      return d;
    };
    cfg.series.forEach((s, si) => {
      const color = s.color || C.seriesColor(si);
      if (s.p10 && s.p90) {
        let d = path(s.p90);
        const back = s.p10.map((v, i) => [v, i]).filter(([v]) => v != null).reverse();
        for (const [v, i] of back) d += "L" + X(i).toFixed(1) + "," + Y(v).toFixed(1);
        if (d) el("path", { d: d + "Z", fill: color, opacity: 0.13, stroke: "none" }, svg);
      }
      el("path", { d: path(s.med), fill: "none", stroke: color, "stroke-width": 2, "stroke-linejoin": "round" }, svg);
      // direct end label (≤4 series)
      if (cfg.series.length <= 4) {
        const lastIdx = s.med.length - 1;
        const lastV = s.med[lastIdx];
        if (lastV != null) {
          const t = el("text", { x: X(lastIdx) + 5, y: Y(lastV) + 3 + si * 0.1, class: "ch-endlabel" }, svg);
          t.textContent = s.name.length > 15 ? s.name.slice(0, 14) + "…" : s.name;
          t.style.fill = "var(--ink2)";
        }
      }
    });

    // hover crosshair + tooltip
    const cross = el("line", { y1: pad.t, y2: pad.t + ih, class: "ch-cross", visibility: "hidden" }, svg);
    const tip = document.createElement("div");
    tip.className = "ch-tip"; tip.hidden = true;
    wrap.appendChild(tip);
    svg.addEventListener("mousemove", (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W2;
      const i = OBS.clamp(Math.round(((px - pad.l) / iw) * (n - 1)), 0, n - 1);
      cross.setAttribute("x1", X(i)); cross.setAttribute("x2", X(i)); cross.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = `<b>Day ${i + 1}</b>` + cfg.series.map((s, si) =>
        `<div><i class="sw" style="background:${s.color || C.seriesColor(si)}"></i>${OBS.esc(s.name)}: <b>${cfg.fmt ? cfg.fmt(s.med[i]) : nice(s.med[i])}</b>${s.p10 ? ` <span class="muted">(${nice(s.p10[i])}–${nice(s.p90[i])})</span>` : ""}</div>`).join("");
      tip.style.left = Math.min(((X(i) / W2) * r.width) + 12, r.width - 190) + "px";
      tip.style.top = "28px";
    });
    svg.addEventListener("mouseleave", () => { cross.setAttribute("visibility", "hidden"); tip.hidden = true; });

    // legend (≥2 series) + table toggle
    const foot = document.createElement("div");
    foot.className = "ch-foot";
    if (cfg.series.length >= 2) {
      foot.innerHTML = cfg.series.map((s, si) => `<span class="lg"><i class="sw" style="background:${s.color || C.seriesColor(si)}"></i>${OBS.esc(s.name)}</span>`).join("");
    }
    const btn = document.createElement("button");
    btn.className = "ch-tablebtn"; btn.textContent = "table";
    btn.onclick = () => {
      const ex = wrap.querySelector(".ch-table");
      if (ex) return ex.remove();
      const tb = document.createElement("div");
      tb.className = "ch-table";
      let rows = "<tr><th>day</th>" + cfg.series.map((s) => `<th>${OBS.esc(s.name)}</th>`).join("") + "</tr>";
      const step = Math.max(1, Math.floor(n / 20));
      for (let i = 0; i < n; i += step) rows += `<tr><td>${i + 1}</td>` + cfg.series.map((s) => `<td>${cfg.fmt ? cfg.fmt(s.med[i]) : nice(s.med[i])}</td>`).join("") + "</tr>";
      tb.innerHTML = `<table>${rows}</table>`;
      wrap.appendChild(tb);
    };
    foot.appendChild(btn);
    wrap.appendChild(foot);
    if (cfg.unit) { const u = document.createElement("div"); u.className = "ch-unit"; u.textContent = cfg.unit; wrap.appendChild(u); }
    container.appendChild(wrap);
  };

  // horizontal bars: rows [{label, value, color?}]
  C.bars = function (container, cfg) {
    container.innerHTML = "";
    const max = Math.max(...cfg.rows.map((r) => Math.abs(r.value)), 1e-9);
    const wrap = document.createElement("div");
    wrap.className = "chart barchart";
    if (cfg.title) wrap.innerHTML = `<div class="ch-title-h">${OBS.esc(cfg.title)}</div>`;
    for (const r of cfg.rows) {
      const row = document.createElement("div");
      row.className = "bar-row";
      const pct = (Math.abs(r.value) / max) * 100;
      row.innerHTML = `<div class="bar-label" title="${OBS.esc(r.label)}">${OBS.esc(r.label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${r.color || "var(--s1)"}"></div></div>
        <div class="bar-val">${cfg.fmt ? cfg.fmt(r.value) : nice(r.value)}</div>`;
      wrap.appendChild(row);
    }
    container.appendChild(wrap);
  };

  // tornado: rows [{label, lo, hi, base}]
  C.tornado = function (container, cfg) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "chart barchart";
    wrap.innerHTML = `<div class="ch-title-h">${OBS.esc(cfg.title || "Sensitivity (±20% per assumption)")}</div>`;
    const base = cfg.rows[0]?.base ?? 0;
    const maxDev = Math.max(...cfg.rows.map((r) => Math.max(Math.abs(r.lo - base), Math.abs(r.hi - base))), 1e-9);
    for (const r of cfg.rows) {
      const l = ((r.lo - base) / maxDev) * 50, h = ((r.hi - base) / maxDev) * 50;
      const left = Math.min(l, h), width = Math.abs(h - l);
      const row = document.createElement("div");
      row.className = "bar-row";
      row.innerHTML = `<div class="bar-label" title="${OBS.esc(r.label)}">${OBS.esc(r.label)}</div>
        <div class="bar-track tornado"><div class="bar-mid"></div><div class="bar-fill" style="left:${50 + left}%;width:${Math.max(1, width)}%;background:var(--s1)"></div></div>
        <div class="bar-val">${cfg.fmt ? cfg.fmt(r.lo) : nice(r.lo)} · ${cfg.fmt ? cfg.fmt(r.hi) : nice(r.hi)}</div>`;
      wrap.appendChild(row);
    }
    const note = document.createElement("div");
    note.className = "muted"; note.style.fontSize = "11px"; note.style.marginTop = "4px";
    let txt = `Center line = base outcome (${cfg.fmt ? cfg.fmt(base) : nice(base)}). Bar spans the outcome when the assumption moves −20%…+20%.`;
    if (Math.abs(base) > 1e-9 && maxDev / Math.abs(base) < 0.01) txt += " The outcome is robust to ±20% variation in these assumptions (effects below 1%, or mediated only by discrete threshold decisions).";
    note.textContent = txt;
    wrap.appendChild(note);
    container.appendChild(wrap);
  };
})();
