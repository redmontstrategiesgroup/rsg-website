/* NEXUS Observatory — spatial view. Clean plan canvas: neighborhoods, road network
   (width = volume, blue ramp = v/c magnitude, critical ring when saturated),
   organizations, power. Replay slider scrubs a completed run day-by-day. */
(function () {
  const MV = (OBS.mapview = {});
  let cv, ctx, W, H, scale = 1, off = { x: 0, y: 0 };
  let hover = null;
  MV.layers = { roads: true, congestion: true, orgs: true, power: true, labels: true };
  MV.onPick = null;
  MV.replay = null; // {run, day} — when set, draw that day's state

  const SEQ = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95"]; // blue ramp (light)
  const vcColor = (vc) => SEQ[OBS.clamp(Math.floor((vc / 1.1) * SEQ.length), 0, SEQ.length - 1)];

  MV.init = function (canvas) {
    cv = canvas; ctx = cv.getContext("2d");
    MV.resize();
    new ResizeObserver(MV.resize).observe(cv.parentElement);
    cv.addEventListener("mousemove", (e) => {
      const r = cv.getBoundingClientRect();
      MV.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    });
    cv.addEventListener("click", () => { if (hover && MV.onPick) MV.onPick(hover); });
  };

  MV.resize = function () {
    if (!cv || !cv.parentElement) return;
    const r = cv.parentElement.getBoundingClientRect();
    if (r.width < 50) return;
    cv.width = r.width * devicePixelRatio; cv.height = r.height * devicePixelRatio;
    cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
    scale = Math.min(r.width / 108, r.height / 74);
    off = { x: (r.width - 100 * scale) / 2, y: (r.height - 70 * scale) / 2 };
  };

  const P = (x, y) => ({ x: off.x + x * scale, y: off.y + y * scale });

  MV.orgStatusAt = function (run, oid, day) {
    // reconstruct open/closed from events
    let open = true;
    for (const e of run.events) {
      if (e.day > day) break;
      if (e.data?.oid !== oid) continue;
      if (e.type === "org_closed_outage" || e.type === "business_failed") open = false;
      if (e.type === "org_reopened") open = true;
    }
    return open;
  };

  MV.draw = function () {
    if (!ctx) return;
    const world = OBS.app.world;
    const g = world.graph;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = cv.width / devicePixelRatio, h = cv.height / devicePixelRatio;
    const css = getComputedStyle(document.documentElement);
    ctx.fillStyle = css.getPropertyValue("--surface").trim() || "#fcfcfb";
    ctx.fillRect(0, 0, w, h);
    hover = null;
    const mx = MV.mouse?.x, my = MV.mouse?.y;
    const rep = MV.replay;
    const day = rep ? rep.day : null;

    // neighborhoods
    for (const nb of g.byType("neighborhood").concat([g.get("ext")])) {
      const p = P(nb.attrs.x, nb.attrs.y);
      const rw = 15 * scale, rh = 9 * scale;
      ctx.beginPath();
      ctx.roundRect(p.x - rw / 2, p.y - rh / 2, rw, rh, 6);
      ctx.fillStyle = css.getPropertyValue("--nb-fill").trim() || "#f0efec";
      ctx.fill();
      ctx.strokeStyle = css.getPropertyValue("--hair").trim() || "#e1e0d9";
      ctx.stroke();
      if (MV.layers.labels) {
        ctx.fillStyle = css.getPropertyValue("--ink2").trim();
        ctx.font = `600 ${Math.max(9, 10.5 * scale / 8)}px system-ui`;
        ctx.textAlign = "center";
        ctx.fillText(nb.name.toUpperCase(), p.x, p.y - rh / 2 - 5);
      }
      if (mx != null && Math.abs(mx - p.x) < rw / 2 && Math.abs(my - p.y) < rh / 2) hover = { type: "neighborhood", id: nb.id, x: p.x, y: p.y };
      // power badge
      if (MV.layers.power && rep) {
        const sub = g.out(nb.id, "powered_by")[0]?.to;
        if (sub && rep.run.events.some((e) => e.type === "power_outage" && e.day <= day && (e.data.subId === sub || e.data.subId === "all") && day < e.day + e.data.days)) {
          ctx.fillStyle = css.getPropertyValue("--critical").trim();
          ctx.font = `700 ${10}px system-ui`;
          ctx.fillText("⚡ OUTAGE", p.x, p.y + rh / 2 + 12);
        }
      }
    }

    // roads
    if (MV.layers.roads) {
      for (const r of g.byType("road")) {
        const a = g.get(r.attrs.a), b = g.get(r.attrs.b);
        const pa = P(a.attrs.x, a.attrs.y), pb = P(b.attrs.x, b.attrs.y);
        let vc = null, open = true;
        if (rep) {
          const arr = rep.run.edgeSeries[r.id];
          vc = arr ? arr[day - 1] : null;
          open = vc != null;
        }
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y);
        if (!open) {
          ctx.setLineDash([6, 5]);
          ctx.strokeStyle = css.getPropertyValue("--muted").trim();
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.setLineDash([]);
          const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
          ctx.fillStyle = css.getPropertyValue("--critical").trim();
          ctx.font = "700 12px system-ui"; ctx.textAlign = "center";
          ctx.fillText("✕ closed", mid.x, mid.y - 6);
        } else {
          const width = vc != null ? OBS.clamp(1.5 + vc * 6, 1.5, 9) : 2.5;
          ctx.strokeStyle = MV.layers.congestion && vc != null ? vcColor(vc) : css.getPropertyValue("--baseline").trim();
          ctx.lineWidth = width;
          ctx.lineCap = "round";
          ctx.stroke();
          if (vc != null && vc > 0.95) { // saturated — status ring at midpoint
            const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
            ctx.beginPath(); ctx.arc(mid.x, mid.y, 6, 0, Math.PI * 2);
            ctx.strokeStyle = css.getPropertyValue("--critical").trim(); ctx.lineWidth = 2; ctx.stroke();
          }
        }
        // hover on midpoint
        const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
        if (mx != null && Math.hypot(mx - mid.x, my - mid.y) < 12) hover = { type: "road", id: r.id, x: mid.x, y: mid.y, vc };
      }
    }

    // organizations (small squares clustered near their neighborhood)
    if (MV.layers.orgs) {
      const state = rep ? rep.run.state : null;
      const orgIds = state ? Object.keys(state.orgs) : g.byType("organization").map((o) => o.id);
      const perNb = {};
      for (const oid of orgIds.sort()) {
        if (oid === "ext_jobs") continue;
        const o = state?.orgs[oid] || g.get(oid)?.attrs && { ...g.get(oid).attrs, nb: g.get(oid).nb, name: g.get(oid).name };
        if (!o) continue;
        const nb = g.get(o.nb); if (!nb) continue;
        const idx = (perNb[o.nb] = (perNb[o.nb] || 0) + 1) - 1;
        const p = P(nb.attrs.x, nb.attrs.y);
        const col = idx % 4, row = Math.floor(idx / 4);
        const x = p.x - 5.4 * scale + col * 3.4 * scale, y = p.y - 2 * scale + row * 3.2 * scale;
        const open = rep ? MV.orgStatusAt(rep.run, oid, day) : true;
        const size = 2.4 * scale * OBS.clamp(0.7 + (o.jobs || o.staff || 20) / 800, 0.7, 1.8);
        ctx.beginPath();
        ctx.rect(x - size / 2, y - size / 2, size, size);
        ctx.fillStyle = open ? css.getPropertyValue("--org-fill").trim() : css.getPropertyValue("--critical").trim();
        ctx.fill();
        ctx.strokeStyle = css.getPropertyValue("--ink2").trim();
        ctx.lineWidth = 0.6; ctx.stroke();
        if (mx != null && Math.abs(mx - x) < size && Math.abs(my - y) < size) hover = { type: "organization", id: oid, x, y, open };
      }
    }

    // tooltip
    const tip = document.getElementById("map-tip");
    if (tip) {
      if (hover) {
        tip.hidden = false;
        let html = "";
        if (hover.type === "road") {
          const r = g.get(hover.id);
          html = `<b>${OBS.esc(r.name)}</b><br><span class="muted">cap ${r.attrs.capacityHr}/hr · base ${r.attrs.baseMin} min${hover.vc != null ? ` · v/c ${hover.vc.toFixed(2)}` : ""}</span>`;
        } else if (hover.type === "organization") {
          const name = OBS.app.world.graph.get(hover.id)?.name || MV.replay?.run.state.orgs[hover.id]?.name || hover.id;
          html = `<b>${OBS.esc(name)}</b>${hover.open === false ? ' <span style="color:var(--critical)">closed</span>' : ""}<br><span class="muted">click to inspect</span>`;
        } else {
          const nb = g.get(hover.id);
          html = `<b>${OBS.esc(nb.name)}</b><br><span class="muted">${OBS.esc(nb.attrs.desc || "")}</span>`;
        }
        tip.innerHTML = html;
        tip.style.left = OBS.clamp(hover.x + 14, 4, w - 220) + "px";
        tip.style.top = OBS.clamp(hover.y + 8, 4, h - 50) + "px";
        cv.style.cursor = "pointer";
      } else { tip.hidden = true; cv.style.cursor = "default"; }
    }
  };
})();
