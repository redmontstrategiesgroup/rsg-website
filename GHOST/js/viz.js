/* ============================================================
   GHOST // viz.js — canvas visuals (one master rAF loop)
   Live machine "screens", system map, starfield, sparkline.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;

  const C = {
    bg: "#04070d", cyan: "#35f2e6", cyanD: "#1b8f92", ice: "#9fe8ff",
    violet: "#a878ff", magenta: "#ff5db1", blue: "#4aa8ff",
    ok: "#3df5a8", warn: "#ffc24d", danger: "#ff415f", orange: "#ff8a3d",
    text: "#dbe8f5", dim: "#6f86a3", faint: "#3f5570",
    line: "rgba(120,160,200,.16)",
  };

  const DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  const painters = [];

  function size(cv) {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return null;
    const bw = Math.round(w * DPR), bh = Math.round(h * DPR);
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    const ctx = cv.getContext("2d");
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx, w, h };
  }

  /* ---------- primitives ---------- */
  function rr(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function txt(ctx, s, x, y, col, font, align) {
    ctx.fillStyle = col; ctx.font = font || "10px 'Cascadia Code', monospace";
    ctx.textAlign = align || "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(s, x, y);
  }

  /* ============================================================
     MACHINE SCENES
     ============================================================ */
  const scenes = {
    idle(ctx, w, h, t) {
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      const y = (t * 26) % h;
      const g = ctx.createLinearGradient(0, y - 20, 0, y + 20);
      g.addColorStop(0, "rgba(53,242,230,0)"); g.addColorStop(.5, "rgba(53,242,230,.10)"); g.addColorStop(1, "rgba(53,242,230,0)");
      ctx.fillStyle = g; ctx.fillRect(0, y - 20, w, 40);
      txt(ctx, "● STANDBY", w / 2, h / 2, C.dim, "9px 'Cascadia Code',monospace", "center");
    },

    code(ctx, w, h, t, m) {
      ctx.fillStyle = "#070b13"; ctx.fillRect(0, 0, w, h);
      // tab bar
      ctx.fillStyle = "#0c1320"; ctx.fillRect(0, 0, w, 13);
      txt(ctx, "QuoteWizard.tsx", 8, 9.5, C.ice, "8px 'Cascadia Code',monospace");
      ctx.fillStyle = C.orange; ctx.fillRect(8, 12, 62, 1.5);
      // gutter
      ctx.fillStyle = "#0a101c"; ctx.fillRect(0, 13, 16, h);
      const lines = CODE_LINES;
      const rows = Math.floor((h - 18) / 9);
      const reveal = Math.floor((m ? m.prog : (t % 1)) * (lines.length) + (t * 3) % 3);
      for (let i = 0; i < rows; i++) {
        const li = i;
        const y = 22 + i * 9;
        txt(ctx, String(i + 1), 13, y, "#33445e", "7px 'Cascadia Code',monospace", "right");
        const line = lines[li % lines.length];
        let x = 20 + line.indent * 6;
        const shown = li < reveal;
        for (const tok of line.toks) {
          if (!shown) break;
          txt(ctx, tok.s, x, y, tok.c, "8px 'Cascadia Code',monospace");
          x += tok.s.length * 4.6;
        }
        if (li === reveal && Math.floor(t * 2) % 2) { ctx.fillStyle = C.cyan; ctx.fillRect(x + 1, y - 6.5, 4, 8); }
      }
    },

    browser(ctx, w, h, t, m) {
      ctx.fillStyle = "#0a0f1a"; ctx.fillRect(0, 0, w, h);
      // chrome
      ctx.fillStyle = "#111a29"; ctx.fillRect(0, 0, w, 12);
      [C.danger, C.warn, C.ok].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(6 + i * 7, 6, 2, 0, 7); ctx.fill(); });
      rr(ctx, 26, 2.5, w - 34, 7, 3); ctx.fillStyle = "#060b14"; ctx.fill();
      txt(ctx, "southshore-roofing.app", 30, 8.5, C.dim, "6px 'Cascadia Code',monospace");
      const p = m ? m.prog : (t % 1);
      // hero
      const heroH = 30;
      rr(ctx, 8, 18, w - 16, heroH, 4);
      const g = ctx.createLinearGradient(0, 18, w, 18 + heroH);
      g.addColorStop(0, "#16324a"); g.addColorStop(1, "#20140a"); ctx.fillStyle = g; ctx.fill();
      ctx.fillStyle = C.orange; ctx.fillRect(14, 24, 42, 4);
      ctx.fillStyle = "rgba(219,232,245,.5)"; ctx.fillRect(14, 31, 66, 2.5); ctx.fillRect(14, 36, 50, 2.5);
      rr(ctx, w - 58, 30, 44, 11, 3); ctx.fillStyle = C.orange; ctx.fill();
      txt(ctx, "GET QUOTE", w - 55, 38, "#3a1e05", "6px 'Cascadia Code',monospace");
      // cards building in
      const cardsY = 18 + heroH + 6;
      for (let i = 0; i < 3; i++) {
        if (p < (i + 1) / 4) break;
        const cw = (w - 16 - 12) / 3, cx = 8 + i * (cw + 6);
        rr(ctx, cx, cardsY, cw, h - cardsY - 8, 3); ctx.fillStyle = "#0e1626"; ctx.fill();
        ctx.strokeStyle = C.line; ctx.stroke();
        ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(cx + 8, cardsY + 9, 3, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(219,232,245,.35)"; ctx.fillRect(cx + 6, cardsY + 16, cw - 12, 2); ctx.fillRect(cx + 6, cardsY + 21, cw - 20, 2);
      }
      // paint sweep
      const sx = (t * 0.5 % 1) * w;
      const sg = ctx.createLinearGradient(sx - 30, 0, sx + 30, 0);
      sg.addColorStop(0, "rgba(53,242,230,0)"); sg.addColorStop(.5, "rgba(53,242,230,.10)"); sg.addColorStop(1, "rgba(53,242,230,0)");
      ctx.fillStyle = sg; ctx.fillRect(sx - 30, 12, 60, h);
    },

    terminal(ctx, w, h, t, m) {
      ctx.fillStyle = "#050a11"; ctx.fillRect(0, 0, w, h);
      const rows = TERM_LINES;
      const rowH = 8.4;
      const n = Math.floor((h - 16) / rowH);
      const scroll = Math.floor(t * 3);
      for (let i = 0; i < n; i++) {
        const r = rows[(i + scroll) % rows.length];
        const y = 12 + i * rowH;
        txt(ctx, r.s, 8, y, r.c, "7.5px 'Cascadia Code',monospace");
      }
      // progress bar bottom
      const p = m ? m.prog : (t % 1);
      ctx.fillStyle = "#0d1626"; ctx.fillRect(8, h - 12, w - 16, 6);
      ctx.fillStyle = C.cyan; ctx.fillRect(8, h - 12, (w - 16) * p, 6);
      txt(ctx, "vercel --prod  " + Math.round(p * 100) + "%", 10, h - 7.5, "#04121a", "6px 'Cascadia Code',monospace");
      // spinner
      const spin = "|/-\\"[Math.floor(t * 8) % 4];
      txt(ctx, spin, w - 12, 12, C.cyan, "8px 'Cascadia Code',monospace");
    },

    checkout(ctx, w, h, t) {
      ctx.fillStyle = "#0a0f1a"; ctx.fillRect(0, 0, w, h);
      const cx = w / 2 - 55, cw = 110, cy = 12;
      rr(ctx, cx, cy, cw, h - 22, 5); ctx.fillStyle = "#0e1626"; ctx.fill(); ctx.strokeStyle = C.line; ctx.stroke();
      txt(ctx, "Deposit — $500.00", cx + 8, cy + 13, C.ice, "8px 'Cascadia Code',monospace");
      rr(ctx, cx + 8, cy + 18, cw - 16, 11, 3); ctx.fillStyle = "#060b14"; ctx.fill();
      txt(ctx, "4242 4242 4242 " + (Math.floor(t) % 2 ? "4242" : "424_"), cx + 12, cy + 25.5, C.dim, "7px 'Cascadia Code',monospace");
      rr(ctx, cx + 8, cy + 33, (cw - 20) / 2, 10, 3); ctx.fillStyle = "#060b14"; ctx.fill();
      rr(ctx, cx + 8 + (cw - 16) / 2, cy + 33, (cw - 20) / 2, 10, 3); ctx.fillStyle = "#060b14"; ctx.fill();
      const pulse = 0.5 + 0.5 * Math.sin(t * 4);
      rr(ctx, cx + 8, cy + 47, cw - 16, 13, 3);
      ctx.fillStyle = "#635bff"; ctx.fill();
      ctx.globalAlpha = pulse * 0.4; ctx.fillStyle = "#8f8bff"; ctx.fill(); ctx.globalAlpha = 1;
      txt(ctx, "PAY DEPOSIT", w / 2, cy + 55.5, "#eae9ff", "7px 'Cascadia Code',monospace", "center");
      txt(ctx, "🔒 stripe · test mode", w / 2, h - 5, C.dim, "6px 'Cascadia Code',monospace", "center");
    },

    mobile(ctx, w, h, t, m) { drawPhone(ctx, w, h, t, m, false); },
    error(ctx, w, h, t, m) { drawPhone(ctx, w, h, t, m, true); },

    crm(ctx, w, h, t, m) {
      ctx.fillStyle = "#0a0f18"; ctx.fillRect(0, 0, w, h);
      txt(ctx, "PIPELINE", 8, 11, C.ice, "8px 'Cascadia Code',monospace");
      const cols = ["NEW", "QUOTED", "WON"]; const cw = (w - 16 - 12) / 3;
      const colors = [C.blue, C.warn, C.ok];
      for (let i = 0; i < 3; i++) {
        const x = 8 + i * (cw + 6);
        txt(ctx, cols[i], x + 2, 22, colors[i], "6px 'Cascadia Code',monospace");
        const count = [4, 3, 2][i];
        for (let k = 0; k < count; k++) {
          const drift = i === 0 ? Math.sin(t * 2 + k) * 1.5 : 0;
          const y = 26 + k * 12 + drift;
          rr(ctx, x, y, cw, 9, 2); ctx.fillStyle = "#0f1a2a"; ctx.fill();
          ctx.strokeStyle = "rgba(120,160,200,.12)"; ctx.stroke();
          ctx.fillStyle = colors[i]; ctx.fillRect(x, y, 2, 9);
          ctx.fillStyle = "rgba(219,232,245,.4)"; ctx.fillRect(x + 6, y + 3, cw - 12, 1.5); ctx.fillRect(x + 6, y + 6, cw - 20, 1.5);
        }
      }
    },

    security(ctx, w, h, t) {
      ctx.fillStyle = "#05090f"; ctx.fillRect(0, 0, w, h);
      const gw = w / 2, gh = h / 2;
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * gw, y = Math.floor(i / 2) * gh;
        ctx.fillStyle = "#080e16"; ctx.fillRect(x + 2, y + 2, gw - 4, gh - 4);
        // noise-ish
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = `rgba(60,90,120,${0.04 + Math.random() * 0.04})`;
          ctx.fillRect(x + 2 + Math.random() * (gw - 6), y + 2 + Math.random() * (gh - 6), 3, 3);
        }
        ctx.strokeStyle = "rgba(61,245,168,.25)"; ctx.strokeRect(x + 2, y + 2, gw - 4, gh - 4);
        txt(ctx, "CAM 0" + (i + 1), x + 5, y + 11, C.ok, "6px 'Cascadia Code',monospace");
        // scan line
        const sy = y + 2 + ((t * 20 + i * 15) % (gh - 4));
        ctx.strokeStyle = "rgba(61,245,168,.2)"; ctx.beginPath(); ctx.moveTo(x + 2, sy); ctx.lineTo(x + gw - 2, sy); ctx.stroke();
      }
      ctx.fillStyle = "rgba(4,8,13,.7)"; ctx.fillRect(0, h - 12, w, 12);
      txt(ctx, "● NO THREATS DETECTED", 6, h - 4, C.ok, "7px 'Cascadia Code',monospace");
      txt(ctx, new Date().toLocaleTimeString(), w - 5, h - 4, C.dim, "6px 'Cascadia Code',monospace", "right");
    },

    research(ctx, w, h, t, m) {
      ctx.fillStyle = "#0a0f16"; ctx.fillRect(0, 0, w, h);
      txt(ctx, "SOURCES", 8, 11, C.ice, "8px 'Cascadia Code',monospace");
      const n = 7;
      for (let i = 0; i < n; i++) {
        const y = 18 + i * ((h - 30) / n);
        const hot = Math.floor(t * 2 + i) % n === i;
        ctx.fillStyle = hot ? "rgba(74,168,255,.12)" : "transparent"; ctx.fillRect(6, y - 6, w - 12, 9);
        ctx.fillStyle = hot ? C.blue : C.dim; ctx.beginPath(); ctx.arc(11, y - 1.5, 2, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(219,232,245,.4)"; ctx.fillRect(17, y - 3, (w - 30) * (0.5 + (i % 3) * 0.15), 2);
        txt(ctx, ["✓", "✓", "?", "✓", "⚠", "✓", "✓"][i], w - 10, y, ["#3df5a8"][0], "6px 'Cascadia Code',monospace", "right");
      }
      // little bar chart
      const bx = w - 42;
      for (let i = 0; i < 4; i++) {
        const bh = 6 + Math.abs(Math.sin(t + i)) * 14;
        ctx.fillStyle = C.blue; ctx.fillRect(bx + i * 8, h - 6 - bh, 5, bh);
      }
    },

    replay(ctx, w, h, t) {
      ctx.fillStyle = "#080d15"; ctx.fillRect(0, 0, w, h);
      txt(ctx, "◉ REPLAY · 218 actions", 8, 12, C.magenta, "8px 'Cascadia Code',monospace");
      // filmstrip
      const fy = 18, fh = 20; const frames = 8; const fw = (w - 16) / frames;
      for (let i = 0; i < frames; i++) {
        rr(ctx, 8 + i * fw, fy, fw - 3, fh, 2);
        ctx.fillStyle = i / frames < (t * .3 % 1) ? "#123049" : "#0c1524"; ctx.fill();
        ctx.strokeStyle = C.line; ctx.stroke();
      }
      // waveform
      ctx.strokeStyle = C.magenta; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = 0; x < w - 16; x++) {
        const yy = h - 16 + Math.sin(x * 0.3 + t * 4) * Math.abs(Math.sin(x * 0.05)) * 8;
        x ? ctx.lineTo(8 + x, yy) : ctx.moveTo(8, yy);
      }
      ctx.stroke();
      // playhead
      const px = 8 + ((t * .3) % 1) * (w - 16);
      ctx.strokeStyle = C.cyan; ctx.beginPath(); ctx.moveTo(px, fy); ctx.lineTo(px, h - 4); ctx.stroke();
    },

    kvm(ctx, w, h, t) {
      ctx.fillStyle = "#070c14"; ctx.fillRect(0, 0, w, h);
      // faux remote desktop
      for (let i = 0; i < 5; i++) { ctx.fillStyle = "rgba(120,160,200,.06)"; ctx.fillRect(8, 16 + i * 9, (w - 16) * (0.4 + (i % 3) * .2), 4); }
      // crosshair cursor
      const cx = w / 2 + Math.sin(t * 1.3) * (w / 3), cy = h / 2 + Math.cos(t * 0.9) * (h / 4);
      ctx.strokeStyle = C.cyan; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 7); ctx.stroke();
      ctx.fillStyle = "rgba(4,8,13,.7)"; ctx.fillRect(0, 0, w, 12);
      txt(ctx, "⌁ KVM BRIDGE · PiKVM-01", 6, 9, C.cyan, "7px 'Cascadia Code',monospace");
    },
  };

  function drawPhone(ctx, w, h, t, m, isError) {
    ctx.fillStyle = "#06090f"; ctx.fillRect(0, 0, w, h);
    const pw = Math.min(58, h * 0.62), ph = h - 8, px = (w - pw) / 2, py = 4;
    rr(ctx, px, py, pw, ph, 8); ctx.fillStyle = "#0b1220"; ctx.fill();
    ctx.strokeStyle = isError ? "rgba(255,65,95,.5)" : "rgba(120,160,200,.25)"; ctx.stroke();
    // notch
    rr(ctx, px + pw / 2 - 7, py + 2, 14, 3, 2); ctx.fillStyle = "#04070d"; ctx.fill();
    // page
    const ix = px + 3, iw = pw - 6, iy = py + 7;
    ctx.fillStyle = "#0a0f1a"; ctx.fillRect(ix, iy, iw, ph - 12);
    ctx.fillStyle = C.orange; ctx.fillRect(ix + 3, iy + 3, iw - 6, 6); // hero
    txt(ctx, "Checkout", ix + 5, iy + 8, "#2a1600", "5px 'Cascadia Code',monospace");
    ctx.fillStyle = "#0e1626"; ctx.fillRect(ix + 3, iy + 12, iw - 6, 9);
    ctx.fillStyle = "#0e1626"; ctx.fillRect(ix + 3, iy + 23, iw - 6, 9);
    // sticky nav (bottom)
    const navY = iy + ph - 12 - 12;
    ctx.fillStyle = "#111a29"; ctx.fillRect(ix, navY, iw, 12);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = C.dim; ctx.beginPath(); ctx.arc(ix + 8 + i * (iw / 3), navY + 6, 2, 0, 7); ctx.fill(); }
    // pay button
    const btnY = isError ? navY - 4 : navY - 15;
    rr(ctx, ix + 4, btnY, iw - 8, 11, 3); ctx.fillStyle = "#635bff"; ctx.fill();
    txt(ctx, "PAY $500", (ix + iw / 2), btnY + 7.5, "#eae9ff", "5px 'Cascadia Code',monospace", "center");
    if (isError) {
      const blink = Math.floor(t * 3) % 2;
      if (blink) {
        ctx.strokeStyle = C.danger; ctx.lineWidth = 1.4;
        rr(ctx, ix + 2, btnY - 2, iw - 4, 17, 3); ctx.stroke();
      }
      txt(ctx, "◹ overlap @390px", w / 2, h - 2, C.danger, "6px 'Cascadia Code',monospace", "center");
    } else {
      txt(ctx, "390 × 844 · ADB", w / 2, h - 2, C.dim, "6px 'Cascadia Code',monospace", "center");
    }
  }

  /* ---------- code / terminal content ---------- */
  const K = "#ff7ab2", S = "#7ee787", V = "#9ecbff", F = "#d2a8ff", N = "#79c0ff", P = "#8b98a8", O = "#ffa657";
  const CODE_LINES = [
    { indent: 0, toks: [{ s: "export ", c: K }, { s: "function ", c: K }, { s: "QuoteWizard", c: F }, { s: "() {", c: P }] },
    { indent: 1, toks: [{ s: "const ", c: K }, { s: "[step, setStep] ", c: V }, { s: "= ", c: P }, { s: "useState", c: F }, { s: "(0)", c: N }] },
    { indent: 1, toks: [{ s: "const ", c: K }, { s: "price ", c: V }, { s: "= ", c: P }, { s: "estimate", c: F }, { s: "(roof)", c: V }] },
    { indent: 1, toks: [{ s: "return ", c: K }, { s: "(", c: P }] },
    { indent: 2, toks: [{ s: "<Card ", c: O }, { s: "glow", c: V }, { s: ">", c: O }] },
    { indent: 3, toks: [{ s: "<Stepper ", c: O }, { s: "value", c: V }, { s: "={step} />", c: P }] },
    { indent: 3, toks: [{ s: "<Quote ", c: O }, { s: "total", c: V }, { s: "={price} />", c: P }] },
    { indent: 3, toks: [{ s: "<PayButton ", c: O }, { s: "amount", c: V }, { s: "={deposit} />", c: P }] },
    { indent: 2, toks: [{ s: "</Card>", c: O }] },
    { indent: 1, toks: [{ s: ")", c: P }] },
    { indent: 0, toks: [{ s: "}", c: P }] },
    { indent: 0, toks: [{ s: "// safe-area inset applied ✓", c: S }] },
  ];
  const TERM_LINES = [
    { s: "$ vercel --prod", c: C.ice },
    { s: "▲ Vercel CLI 33.0", c: C.dim },
    { s: "  Building southshore-roofing", c: C.dim },
    { s: "  ✓ Compiled in 41s", c: C.ok },
    { s: "  ○ Collecting page data", c: C.dim },
    { s: "  ✓ 12 routes generated", c: C.ok },
    { s: "  λ /api/webhook  edge", c: C.cyan },
    { s: "  Uploading [====>   ]", c: C.warn },
    { s: "  ✓ Deployment ready", c: C.ok },
    { s: "  https://…vercel.app", c: C.blue },
  ];

  /* ============================================================
     SYSTEM MAP — radial node graph with data pulses
     ============================================================ */
  function drawMap(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
    const machines = G.state.machines;
    const n = machines.length;
    // rotating faint rings
    ctx.strokeStyle = "rgba(53,242,230,.06)";
    for (let r = 0; r < 3; r++) { ctx.beginPath(); ctx.arc(cx, cy, R * (0.5 + r * 0.28), 0, 7); ctx.stroke(); }

    const nodes = machines.map((m, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2 + t * 0.06;
      return { m, x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });

    // links
    nodes.forEach((nd) => {
      const busy = nd.m.status === "busy";
      const off = nd.m.status === "offline";
      ctx.strokeStyle = off ? "rgba(120,60,70,.15)" : busy ? "rgba(53,242,230,.5)" : "rgba(120,160,200,.12)";
      ctx.lineWidth = busy ? 1.4 : 0.8;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nd.x, nd.y); ctx.stroke();
      if (busy) {
        const k = (t * 0.6) % 1;
        const px = G.lerp(cx, nd.x, k), py = G.lerp(cy, nd.y, k);
        ctx.fillStyle = C.cyan; ctx.beginPath(); ctx.arc(px, py, 2, 0, 7); ctx.fill();
        const k2 = (t * 0.6 + 0.5) % 1;
        ctx.fillStyle = C.ice; ctx.beginPath(); ctx.arc(G.lerp(cx, nd.x, k2), G.lerp(cy, nd.y, k2), 1.4, 0, 7); ctx.fill();
      }
    });

    // machine nodes
    nodes.forEach((nd) => {
      const busy = nd.m.status === "busy", off = nd.m.status === "offline", alert = nd.m.alert;
      const col = off ? C.danger : alert ? C.danger : busy ? C.cyan : C.dim;
      ctx.fillStyle = "#081019"; ctx.beginPath(); ctx.arc(nd.x, nd.y, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = busy || alert ? 1.6 : 1; ctx.stroke();
      if (busy || alert) { ctx.globalAlpha = 0.3 + 0.3 * Math.sin(t * 4); ctx.beginPath(); ctx.arc(nd.x, nd.y, 11, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
      txt(ctx, nd.m.name.replace(/ /g, ""), nd.x, nd.y + 18, off ? C.danger : busy ? C.ice : C.dim, "6px 'Cascadia Code',monospace", "center");
    });

    // core
    const pulse = 1 + Math.sin(t * 2) * 0.06;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22 * pulse);
    grad.addColorStop(0, "rgba(53,242,230,.9)"); grad.addColorStop(.4, "rgba(53,242,230,.25)"); grad.addColorStop(1, "rgba(53,242,230,0)");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cy, 22 * pulse, 0, 7); ctx.fill();
    ctx.fillStyle = "#04141a"; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 7); ctx.fill();
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.4; ctx.stroke();
    // spinning ticks
    for (let i = 0; i < 8; i++) {
      const a = t * 0.8 + (i / 8) * Math.PI * 2;
      ctx.strokeStyle = "rgba(125,255,245,.5)"; ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); ctx.lineTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); ctx.stroke();
    }
    txt(ctx, "GHOST", cx, cy + 2.5, "#eafffd", "6px 'Cascadia Code',monospace", "center");
  }

  /* ============================================================
     SPARKLINE (metrics / replay)
     ============================================================ */
  function drawSpark(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const s = G.state.metrics.series;
    if (!s.length) { txt(ctx, "awaiting telemetry…", w / 2, h / 2, C.dim, "8px 'Cascadia Code',monospace", "center"); return; }
    const max = Math.max.apply(null, s) * 1.15 || 1;
    // area
    ctx.beginPath(); ctx.moveTo(0, h);
    s.forEach((v, i) => { const x = (i / (s.length - 1 || 1)) * w, y = h - (v / max) * (h - 4) - 2; i ? ctx.lineTo(x, y) : ctx.lineTo(x, y); });
    ctx.lineTo(w, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(53,242,230,.35)"); g.addColorStop(1, "rgba(53,242,230,0)");
    ctx.fillStyle = g; ctx.fill();
    // line
    ctx.beginPath();
    s.forEach((v, i) => { const x = (i / (s.length - 1 || 1)) * w, y = h - (v / max) * (h - 4) - 2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.4; ctx.stroke();
    // head dot
    const lx = w, ly = h - (s[s.length - 1] / max) * (h - 4) - 2;
    ctx.fillStyle = C.ice; ctx.beginPath(); ctx.arc(lx - 1, ly, 2, 0, 7); ctx.fill();
  }

  /* ---------- anomaly mini-shot ---------- */
  function drawAnomalyShot(cv, anomaly) {
    const s = size(cv); if (!s) return;
    const { ctx, w, h } = s;
    drawPhone(ctx, w, h, performance.now() / 1000, null, true);
  }

  /* ============================================================
     MASTER LOOP + registration
     ============================================================ */
  function attachTile(cv, machineId) { painters.push({ cv, kind: "tile", machineId }); }
  function attachMap(cv) { painters.push({ cv, kind: "map" }); }
  function attachSpark(cv) { painters.push({ cv, kind: "spark" }); }
  function attachAnomaly(cv) { painters.push({ cv, kind: "anom" }); }

  function starfield() {
    const cv = document.getElementById("starfield");
    if (!cv) return;
    const stars = [];
    function seed() {
      stars.length = 0;
      const n = Math.min(160, Math.floor((window.innerWidth * window.innerHeight) / 12000));
      for (let i = 0; i < n; i++) stars.push({ x: Math.random(), y: Math.random(), z: Math.random(), s: Math.random() * 1.4 + 0.2 });
    }
    seed(); window.addEventListener("resize", seed);
    painters.push({ cv, kind: "stars", stars });
  }

  function renderPass(t) {
    for (let pi = painters.length - 1; pi >= 0; pi--) {
      const p = painters[pi];
      if (p.kind === "anom" && !p.cv.isConnected) { painters.splice(pi, 1); continue; }
      const s = size(p.cv); if (!s) continue;
      const { ctx, w, h } = s;
      if (p.kind === "anom") { drawPhone(ctx, w, h, t, null, true); continue; }
      if (p.kind === "stars") {
        ctx.clearRect(0, 0, w, h);
        for (const st of p.stars) {
          const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * (0.5 + st.z) + st.x * 10));
          ctx.fillStyle = `rgba(${st.z > .7 ? "125,255,245" : "150,200,230"},${tw * (0.15 + st.z * 0.5)})`;
          const x = (st.x * w + (t * (4 + st.z * 10)) % w) % w;
          ctx.fillRect(x, st.y * h, st.s, st.s);
        }
      } else if (p.kind === "map") {
        drawMap(ctx, w, h, t);
      } else if (p.kind === "spark") {
        drawSpark(ctx, w, h, t);
      } else if (p.kind === "tile") {
        const m = G.engine.machineById(p.machineId);
        const scene = m ? (m.status === "offline" ? "idle" : m.scene) : "idle";
        (scenes[scene] || scenes.idle)(ctx, w, h, t, m);
        if (m && m.status === "offline") {
          ctx.fillStyle = "rgba(3,6,11,.72)"; ctx.fillRect(0, 0, w, h);
          txt(ctx, "⏻ OFFLINE", w / 2, h / 2, C.danger, "9px 'Cascadia Code',monospace", "center");
        }
      }
    }
  }
  let raf;
  function frame() { renderPass(performance.now() / 1000); raf = requestAnimationFrame(frame); }
  function startLoop() { if (!raf) frame(); }

  G.viz = { attachTile, attachMap, attachSpark, attachAnomaly, starfield, startLoop, renderPass, drawAnomalyShot };
})();
