/* NEXUS map — isometric canvas renderer with pan/zoom, hover, picking */
(function () {
  const M = (NX.map = {});
  const TW = 46, TH = 23; // tile diamond size at zoom 1
  let cv, ctx, W, H;
  let cam = { x: 0, y: 0, z: 1.15 };
  let dragging = false, dragStart = null, moved = false;
  let hover = null; // {type, id, sx, sy}

  const GRID_W = 23, GRID_H = 14;

  M.init = function (canvas) {
    cv = canvas; ctx = cv.getContext("2d");
    M.resize();
    window.addEventListener("resize", M.resize);
    cam.x = 0; cam.y = -40;

    cv.addEventListener("mousedown", (e) => { dragging = true; moved = false; dragStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; cv.style.cursor = "grabbing"; });
    window.addEventListener("mouseup", () => { dragging = false; cv.style.cursor = "grab"; });
    window.addEventListener("mousemove", (e) => {
      if (dragging) {
        const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        cam.x = dragStart.cx - dx; cam.y = dragStart.cy - dy;
      }
      const rect = cv.getBoundingClientRect();
      M._mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    });
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      cam.z = NX.clamp(cam.z * (e.deltaY < 0 ? 1.1 : 0.9), 0.55, 2.6);
    }, { passive: false });
    cv.addEventListener("click", () => {
      if (moved) return;
      if (hover && M.onPick) M.onPick(hover);
    });
  };

  M.resize = function () {
    if (!cv) return;
    const r = cv.parentElement.getBoundingClientRect();
    W = cv.width = Math.max(200, r.width) * devicePixelRatio;
    H = cv.height = Math.max(200, r.height) * devicePixelRatio;
    cv.style.width = r.width + "px"; cv.style.height = r.height + "px";
  };

  const iso = (gx, gy) => ({
    x: (gx - gy) * (TW / 2) * cam.z + W / 2 / devicePixelRatio - cam.x,
    y: (gx + gy) * (TH / 2) * cam.z + 60 - cam.y,
  });

  function diamond(c, x, y, w, h) {
    c.beginPath();
    c.moveTo(x, y - h / 2); c.lineTo(x + w / 2, y); c.lineTo(x, y + h / 2); c.lineTo(x - w / 2, y);
    c.closePath();
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = NX.clamp(((n >> 16) & 255) * f, 0, 255) | 0, g = NX.clamp(((n >> 8) & 255) * f, 0, 255) | 0, b = NX.clamp((n & 255) * f, 0, 255) | 0;
    return `rgb(${r},${g},${b})`;
  }

  function nightFactor(minute) {
    const h = minute / 60;
    if (h >= 7 && h < 18) return 0;
    if (h >= 18 && h < 21) return (h - 18) / 3;
    if (h >= 21 || h < 5) return 1;
    return 1 - (h - 5) / 2; // 5-7 dawn
  }

  M.render = function (state) {
    if (!ctx) return;
    // self-heal canvas size (pane may have been hidden or resized)
    const pr = cv.parentElement.getBoundingClientRect();
    if (pr.width > 0 && (Math.abs(pr.width * devicePixelRatio - W) > 2 || Math.abs(pr.height * devicePixelRatio - H) > 2)) M.resize();
    const nf = nightFactor(state.minute);
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const w = W / devicePixelRatio, h = H / devicePixelRatio;

    // sky/ground
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, nf > 0.5 ? "#05070f" : "#0a0f1e");
    g.addColorStop(1, "#060810");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

    // ground tiles
    for (let gy = 0; gy < GRID_H; gy++) {
      for (let gx = 0; gx < GRID_W; gx++) {
        const p = iso(gx + 0.5, gy + 0.5);
        if (p.x < -60 || p.x > w + 60 || p.y < -60 || p.y > h + 60) continue;
        diamond(ctx, p.x, p.y, TW * cam.z, TH * cam.z);
        const base = (gx + gy) % 2 ? 26 : 22;
        const lum = base * (1 - nf * 0.55);
        ctx.fillStyle = `rgb(${lum * 0.55 | 0},${lum * 0.7 | 0},${lum | 0})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(40,60,110,0.15)"; ctx.stroke();
      }
    }

    hover = null;
    const mx = M._mouse?.x, my = M._mouse?.y;

    // buildings (paint back-to-front by gx+gy)
    const blds = state.buildings.slice().sort((a, b) => (a.gx + a.gy + a.gw + a.gh) - (b.gx + b.gy + b.gw + b.gh));
    for (const b of blds) {
      const hgt = ({ industry: 34, civic: 30, housing: 42, shop: 22, food: 22, bar: 26, park: 4 })[b.type] ?? 24;
      const hz = hgt * cam.z;
      const p1 = iso(b.gx, b.gy), p2 = iso(b.gx + b.gw, b.gy), p3 = iso(b.gx + b.gw, b.gy + b.gh), p4 = iso(b.gx, b.gy + b.gh);
      const closed = state.businesses.some((z) => z.building === b.id && !z.open && z.type !== "factory") || (b.id === "plant" && state.flags.opening);
      const dim = 1 - nf * 0.45 - (closed ? 0.25 : 0);

      if (b.type === "park") {
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
        ctx.fillStyle = shade(b.color, dim); ctx.fill();
      } else {
        // walls
        ctx.beginPath(); ctx.moveTo(p4.x, p4.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p3.x, p3.y - hz); ctx.lineTo(p4.x, p4.y - hz); ctx.closePath();
        ctx.fillStyle = shade(b.color, 0.55 * dim); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p2.x, p2.y - hz); ctx.lineTo(p3.x, p3.y - hz); ctx.closePath();
        ctx.fillStyle = shade(b.color, 0.75 * dim); ctx.fill();
        // roof
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y - hz); ctx.lineTo(p2.x, p2.y - hz); ctx.lineTo(p3.x, p3.y - hz); ctx.lineTo(p4.x, p4.y - hz); ctx.closePath();
        ctx.fillStyle = shade(b.color, 1.0 * dim); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke();
        // night windows
        if (nf > 0.3 && !closed && b.type !== "park") {
          ctx.fillStyle = b.type === "bar" ? "rgba(255,80,160,0.8)" : "rgba(255,200,90,0.7)";
          const wn = Math.max(2, (b.gw * 2) | 0);
          for (let i = 0; i < wn; i++) {
            const t = (i + 0.5) / wn;
            const wx = p4.x + (p3.x - p4.x) * t, wy = p4.y + (p3.y - p4.y) * t - hz * (0.35 + (i % 2) * 0.25);
            ctx.fillRect(wx - 1.6 * cam.z, wy, 3.2 * cam.z, 4.5 * cam.z);
          }
        }
      }

      // label
      const c = iso(b.gx + b.gw / 2, b.gy + b.gh / 2);
      ctx.font = `${Math.max(8, 10 * cam.z)}px Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = closed ? "rgba(255,90,100,0.9)" : "rgba(200,220,255,0.85)";
      ctx.fillText((closed ? "✕ " : "") + b.name.toUpperCase(), c.x, c.y - hz - 8 * cam.z);

      // hover hit (roof quad approx via distance to center)
      if (mx != null && Math.abs(mx - c.x) < (b.gw * TW / 2) * cam.z * 0.8 && Math.abs(my - (c.y - hz / 2)) < (b.gh * TH) * cam.z * 0.9 + hz / 2) {
        hover = { type: "building", id: b.id, sx: mx, sy: my };
      }
    }

    // entities: residents + player, sorted by depth
    const ents = [];
    for (const r of state.residents) {
      if (!r.alive || r.missing) continue;
      if (r.inJail) continue;
      ents.push({ kind: "res", r });
    }
    ents.push({ kind: "you" });
    ents.sort((a, b) => {
      const pa = a.kind === "you" ? state.player.pos : a.r.pos;
      const pb = b.kind === "you" ? state.player.pos : b.r.pos;
      return (pa.x + pa.y) - (pb.x + pb.y);
    });

    for (const e of ents) {
      const pos = e.kind === "you" ? state.player.pos : e.r.pos;
      const p = iso(pos.x, pos.y);
      const rr = 4.5 * cam.z;
      let color = "#b9c6e4";
      if (e.kind === "you") color = "#37e8ff";
      else if (e.r.faction === "police") color = "#4f8bff";
      else if (e.r.faction === "gang") color = "#ff3d81";
      else if (e.r.id === state.selected) color = "#ffe066";

      // shadow
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, rr * 1.1, rr * 0.45, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();
      // body
      ctx.beginPath(); ctx.arc(p.x, p.y - rr * 0.8, rr, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      if (e.kind === "you" || e.r?.id === state.selected) {
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke(); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y - rr * 0.8, rr + 3, 0, Math.PI * 2);
        ctx.strokeStyle = e.kind === "you" ? "rgba(55,232,255,0.5)" : "rgba(255,224,102,0.5)"; ctx.stroke();
      }
      if (e.kind === "res" && mx != null && Math.hypot(mx - p.x, my - (p.y - rr)) < rr + 5) {
        hover = { type: "resident", id: e.r.id, sx: p.x, sy: p.y - rr * 2 };
      }
    }

    // night vignette
    if (nf > 0) {
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h);
      vg.addColorStop(0, "rgba(5,8,20,0)");
      vg.addColorStop(1, `rgba(3,5,14,${0.5 * nf})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    }

    // tooltip
    const tip = document.getElementById("map-tip");
    if (hover && tip) {
      tip.hidden = false;
      if (hover.type === "resident") {
        const r = state.residents.find((x) => x.id === hover.id);
        tip.innerHTML = `<b>${NX.esc(r.name)}</b> · ${NX.esc(r.job.title)}<br><span style="color:#6b7a9e">${NX.moodWord(r.mood)} · ${r.metPlayer ? NX.relWord(r.playerRel) + " toward you" : "hasn't met you"}</span>`;
      } else {
        const b = state.buildings.find((x) => x.id === hover.id);
        const biz = state.businesses.find((z) => z.building === b.id);
        tip.innerHTML = `<b>${NX.esc(b.name)}</b><br><span style="color:#6b7a9e">${NX.esc(b.desc)}${biz && !biz.open ? " · CLOSED" : ""}</span>`;
      }
      tip.style.left = NX.clamp(hover.sx + 14, 0, w - 250) + "px";
      tip.style.top = NX.clamp(hover.sy - 10, 0, h - 60) + "px";
      cv.style.cursor = "pointer";
    } else if (tip) {
      tip.hidden = true;
      cv.style.cursor = dragging ? "grabbing" : "grab";
    }
  };
})();
