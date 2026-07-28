/* NEXUS ui — tabs, panels, chat, toasts, voice */
(function () {
  const UI = (NX.ui = {});
  let S = null; // state ref
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => [...document.querySelectorAll(sel)];

  UI.init = function (state) {
    S = state;
    // tabs
    $$(".tab").forEach((t) => t.addEventListener("click", () => UI.openTab(t.dataset.tab)));
    // speed
    $("#spd-pause").onclick = () => UI.setSpeed(0);
    $("#spd-1").onclick = () => UI.setSpeed(1);
    $("#spd-4").onclick = () => UI.setSpeed(4);
    $("#spd-day").onclick = () => NX.app.skipDay();
    // map picking
    NX.map.onPick = (hit) => {
      if (hit.type === "resident") { UI.selectResident(hit.id); UI.openTab("talk"); }
      else {
        const b = S.buildings.find((x) => x.id === hit.id);
        UI.toast(`${b.name} — ${b.desc}`);
      }
    };
    UI.buildTalkSkeleton();
    UI.renderAll();
  };

  UI.setSpeed = function (v) {
    S.speed = v;
    $$(".spd").forEach((b) => b.classList.remove("active"));
    ({ 0: "#spd-pause", 1: "#spd-1", 4: "#spd-4" }[v]) && $({ 0: "#spd-pause", 1: "#spd-1", 4: "#spd-4" }[v]).classList.add("active");
  };

  UI.openTab = function (name) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$(".tabpane").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
    UI.renderTab(name);
  };

  UI.activeTab = () => $$(".tab").find((t) => t.classList.contains("active"))?.dataset.tab || "city";

  // ---- top bar --------------------------------------------------------
  UI.renderTop = function () {
    $("#clock-day").textContent = "DAY " + S.day;
    $("#clock-time").textContent = NX.fmtTime(S.minute);
    $("#clock-phase").textContent = NX.phase(S.minute);
    $("#player-money").textContent = Math.round(S.player.money).toLocaleString("en-US");
  };

  UI.tick = function (text) {
    const el = $("#ticker-text");
    if (el) { el.textContent = text; el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
  };

  UI.toast = function (text, cls = "") {
    const stack = $("#toast");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toastmsg " + cls;
    el.textContent = text;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 5200);
    while (stack.children.length > 4) stack.firstChild.remove();
  };

  // ---- render dispatch ------------------------------------------------
  UI.renderAll = function () { UI.renderTop(); UI.renderTab(UI.activeTab()); };
  UI.renderTab = function (name) {
    if (name === "city") UI.renderCity();
    else if (name === "people") UI.renderPeople();
    else if (name === "talk") UI.renderTalk();
    else if (name === "feed") UI.renderFeed();
    else if (name === "news") UI.renderNews();
    else if (name === "god") UI.renderGod();
    else if (name === "settings") UI.renderSettings();
  };

  // ---- CITY -----------------------------------------------------------
  UI.renderCity = function () {
    const eco = S.economy;
    const p = NX.events.electionSupport(S);
    const rep = S.player.rep;
    const employedCount = S.residents.filter((r) => r.alive && (r.employedAt || r.wage)).length;
    const digest = S.digests[0];
    $("#tab-city").innerHTML = `
      <h3 class="sec">DISTRICT VITALS</h3>
      <div class="statgrid">
        <div class="stat"><div class="k">UNEMPLOYMENT</div><div class="v ${eco.unemployment > 0.25 ? "bad" : eco.unemployment > 0.12 ? "warn" : "good"}">${(eco.unemployment * 100).toFixed(1)}%</div></div>
        <div class="stat"><div class="k">CRIME INDEX</div><div class="v ${eco.crimeRate > 3 ? "bad" : eco.crimeRate > 1.2 ? "warn" : "good"}">${eco.crimeRate.toFixed(1)}</div></div>
        <div class="stat"><div class="k">CITY TREASURY</div><div class="v ${eco.treasury < 0 ? "bad" : "info"}">${NX.money(eco.treasury)}</div></div>
        <div class="stat"><div class="k">PRICE INDEX</div><div class="v warn">${eco.priceIndex.toFixed(2)}×</div></div>
        <div class="stat"><div class="k">EMPLOYED</div><div class="v info">${employedCount}/${S.residents.length}</div></div>
        <div class="stat"><div class="k">RUMOR HOPS</div><div class="v info">${S.counters.gossipHops}</div></div>
      </div>
      <h3 class="sec">ELECTION — DAY ${S.election.day}${S.election.done ? " · DECIDED" : ""}</h3>
      <div class="stat">
        ${S.election.done
          ? `<div class="v gold" style="color:var(--amber)">${S.election.winner === "okafor" ? "RAY OKAFOR" : "ELENA VASQUEZ"} WINS</div>`
          : `<div style="display:flex;justify-content:space-between;font-size:11px"><span>VASQUEZ ${p.vasquez}</span><span>${p.undecided} undecided</span><span>OKAFOR ${p.okafor}</span></div>
             <div class="bar"><i style="width:${(p.vasquez / Math.max(1, p.vasquez + p.okafor)) * 100}%;background:linear-gradient(90deg,#a06bff,#37e8ff)"></i></div>`}
      </div>
      <h3 class="sec">YOUR REPUTATION</h3>
      <div class="statgrid">
        ${Object.entries(rep).map(([f, v]) => `
          <div class="stat"><div class="k">${f.toUpperCase()}</div>
          <div class="v ${v < -15 ? "bad" : v > 15 ? "good" : ""}" style="font-size:13px">${NX.social.repWord(v)} <span style="color:var(--dim);font-size:10px">(${v > 0 ? "+" : ""}${Math.round(v)})</span></div></div>`).join("")}
      </div>
      <div style="margin-top:8px;font-size:11px;color:var(--dim)">Known by ${S.player.knownBy}/${S.residents.length} residents${S.player.wanted > 1 ? ` · <span style="color:var(--red)">police interest: ${"▮".repeat(S.player.wanted)}</span>` : ""}${S.player.jobBiz ? ` · employed at ${NX.economy.biz(S, S.player.jobBiz)?.name}` : ""}</div>
      <h3 class="sec">LATEST DIGEST</h3>
      ${digest ? `<div class="digest"><div class="dtitle">DAY ${digest.d}</div><ul>${digest.lines.map((l) => `<li>${NX.esc(l)}</li>`).join("")}</ul></div>` : `<div class="digest">The city is waking up. The first digest lands tomorrow at midnight.</div>`}
    `;
  };

  // ---- PEOPLE ---------------------------------------------------------
  let peopleQuery = "";
  UI.renderPeople = function () {
    const pane = $("#tab-people");
    if (S.selected && S._showCard) return UI.renderPersonCard(pane, S.selected);
    const q = peopleQuery.toLowerCase();
    const rows = S.residents
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.job.title.includes(q) || r.faction.includes(q))
      .map((r) => {
        const status = !r.alive ? "☠ dead" : r.missing ? "missing" : r.inJail ? "⛓ jailed" : (!r.employedAt && !r.wage) ? "jobless" : r.job.title;
        return `<div class="prow" data-id="${r.id}">
          <div class="pv" style="background:${NX.colorFor(r.name)}">${NX.initials(r.name)}</div>
          <div><div class="pn">${NX.esc(r.name)}</div><div class="pj">${NX.esc(status)} · ${r.faction}</div></div>
          <div class="ps">${NX.moodWord(r.mood)}<br>${r.metPlayer ? NX.relWord(r.playerRel) : "—"}</div>
        </div>`;
      }).join("");
    pane.innerHTML = `
      <div class="searchrow"><input id="ppl-q" placeholder="search 30 residents…" value="${NX.esc(peopleQuery)}"></div>
      <div class="plist">${rows}</div>`;
    $("#ppl-q").addEventListener("input", (e) => { peopleQuery = e.target.value; UI.renderPeople(); $("#ppl-q").focus(); const v = $("#ppl-q"); v.setSelectionRange(v.value.length, v.value.length); });
    $$("#tab-people .prow").forEach((el) => el.addEventListener("click", () => { S.selected = el.dataset.id; S._showCard = true; UI.renderPeople(); }));
  };

  UI.renderPersonCard = function (pane, id) {
    const r = S.residents.find((x) => x.id === id);
    if (!r) { S._showCard = false; return UI.renderPeople(); }
    const biz = r.employedAt ? NX.economy.biz(S, r.employedAt) : null;
    const rels = Object.entries(r.relationships).sort((a, b) => b[1] - a[1]);
    const best = rels.slice(0, 3).map(([oid, v]) => { const o = S.residents.find((x) => x.id === oid); return o ? `${o.name.split(" ")[0]} (${NX.relWord(v)})` : null; }).filter(Boolean).join(", ") || "—";
    const worst = rels.slice(-2).filter(([, v]) => v < -10).map(([oid, v]) => { const o = S.residents.find((x) => x.id === oid); return o ? `${o.name.split(" ")[0]} (${NX.relWord(v)})` : null; }).filter(Boolean).join(", ") || "—";
    const mems = r.memories.slice(-14).reverse();
    pane.innerHTML = `
      <span class="backlink" id="ppl-back">← all residents</span>
      <div class="pcard">
        <div class="head">
          <div class="pv" style="background:${NX.colorFor(r.name)}">${NX.initials(r.name)}</div>
          <div><h2>${NX.esc(r.name)}</h2><div class="sub">${r.age} · ${NX.esc(r.job.title)}${biz ? " @ " + NX.esc(biz.name) : ""} · lives at ${NX.esc(S.buildings.find((b) => b.id === r.home)?.name || r.home)}</div></div>
        </div>
        <div class="tagrow">${r.traits.map((t) => `<span class="tag cool">${t}</span>`).join("")}
          <span class="tag">${r.faction}</span>
          ${r.inJail ? `<span class="tag hot">jailed ${r.inJail}d</span>` : ""}
          ${r.missing ? `<span class="tag hot">missing</span>` : ""}
          ${r.partner ? `<span class="tag gold">with ${NX.esc(S.residents.find((x) => x.id === r.partner)?.name.split(" ")[0] || r.partner)}</span>` : ""}</div>
        <div class="kv">
          <div class="k">money</div><div>${NX.money(r.money)}</div>
          <div class="k">mood</div><div>${NX.moodWord(r.mood)} (${Math.round(r.mood)})</div>
          <div class="k">goal</div><div>${NX.esc(r.goal)}</div>
          <div class="k">fear</div><div>${NX.esc(r.fear)}</div>
          <div class="k">secret</div><div>${S.godView && r.secret ? `<span style="color:var(--neon2)">${NX.esc(r.secret.text)}</span>` : r.secret ? `<span style="color:var(--dim)">████████ <span style="font-size:10px">(enable Omniscience in GOD)</span></span>` : "none"}</div>
          <div class="k">toward you</div><div>${r.metPlayer ? NX.relWord(r.playerRel) + ` (${Math.round(r.playerRel)})` : "you haven't met"}</div>
          <div class="k">closest to</div><div>${NX.esc(best)}</div>
          <div class="k">friction with</div><div>${NX.esc(worst)}</div>
          <div class="k">votes</div><div>${S.election.done ? "voted" : r.lean === "undecided" ? "undecided" : r.lean}</div>
        </div>
        <button class="btn primary" id="ppl-talk">TALK TO ${NX.esc(r.name.split(" ")[0]).toUpperCase()}</button>
        <h3 class="sec">MEMORY (${r.memories.length})</h3>
        <div class="memlog">${mems.map((m) => `<div class="mem"><b>d${m.d}</b> ${NX.esc(m.text)}${m.kind === "gossip" ? ' <span style="color:var(--neon2)">· secondhand</span>' : m.kind === "claude" ? ' <span style="color:var(--dim)">· their impression of talking to you</span>' : ""}</div>`).join("") || '<div class="mem">Nothing yet. Give them something to remember.</div>'}</div>
      </div>`;
    $("#ppl-back").onclick = () => { S._showCard = false; UI.renderPeople(); };
    $("#ppl-talk").onclick = () => { UI.selectResident(r.id); UI.openTab("talk"); };
  };

  // ---- TALK -----------------------------------------------------------
  UI.buildTalkSkeleton = function () {
    $("#tab-talk").innerHTML = `
      <div class="chatwrap">
        <div class="chat-head" id="chat-head"><div class="cname" style="color:var(--dim)">Click a resident on the map (or in PEOPLE) to start a conversation.</div></div>
        <div class="chat-log" id="chat-log"></div>
        <div class="quickrow" id="chat-quick"></div>
        <div class="chat-input">
          <button class="btn mic" id="chat-mic" title="Voice input">🎙</button>
          <input id="chat-text" placeholder="say something… (they'll remember it)" autocomplete="off" />
          <button class="btn primary" id="chat-send">SEND</button>
        </div>
      </div>`;
    $("#chat-send").onclick = () => UI.sendChat();
    $("#chat-text").addEventListener("keydown", (e) => { if (e.key === "Enter") UI.sendChat(); });
    $("#chat-mic").onclick = UI.micToggle;
    $("#chat-quick").addEventListener("click", (e) => {
      const q = e.target.closest(".quick"); if (!q) return;
      $("#chat-text").value = q.dataset.say; UI.sendChat();
    });
    $("#chat-log").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-offer]"); if (!btn) return;
      UI.resolveOffer(btn.dataset.offer);
    });
  };

  UI.selectResident = function (id) {
    S.selected = id; S._showCard = false;
    const r = S.residents.find((x) => x.id === id);
    if (r) { // you walk over to them
      S.player.pos = { x: r.pos.x + 0.4, y: r.pos.y + 0.3 };
      S.player.at = r.at;
    }
    UI.renderTalk();
  };

  UI.renderTalk = function () {
    const head = $("#chat-head"); if (!head) return UI.buildTalkSkeleton();
    const r = S.residents.find((x) => x.id === S.selected);
    if (!r) return;
    const loc = S.buildings.find((b) => b.id === r.at);
    head.innerHTML = `
      <div class="pv" style="background:${NX.colorFor(r.name)}">${NX.initials(r.name)}</div>
      <div><div class="cname">${NX.esc(r.name)}</div>
      <div class="cmood">${NX.esc(r.job.title)} · ${NX.moodWord(r.mood)} · ${r.metPlayer ? NX.relWord(r.playerRel) + " toward you" : "you're a stranger"} · ${r.inJail ? "in a holding cell" : loc ? "at " + NX.esc(loc.name) : "on the street"}</div></div>
      <div style="margin-left:auto;font-size:10px;color:${NX.claude.enabled() ? "var(--green)" : "var(--dim)"}">${NX.claude.enabled() ? "◉ CLAUDE MIND" : "◎ local mind"}</div>`;
    $("#chat-quick").innerHTML = [
      ["ask about the plant closure", "What really happened with the plant closure?"],
      ["any rumors?", "Heard any rumors lately?"],
      ["the Red Knives…", "What do you know about the Red Knives?"],
      ["the election", "Who are you voting for in the election?"],
    ].map(([label, say]) => `<button class="quick" data-say="${NX.esc(say)}">${label}</button>`).join("");
    const log = $("#chat-log");
    const turns = S.chat[r.id] || [];
    log.innerHTML = turns.map((t) =>
      t.who === "sys" ? `<div class="bubble sys">${t.html || NX.esc(t.text)}</div>`
        : `<div class="bubble ${t.who}">${NX.esc(t.text)}</div>`).join("");
    log.scrollTop = log.scrollHeight;
  };

  UI.pushChat = function (rid, who, text, html) {
    (S.chat[rid] = S.chat[rid] || []).push({ who, text, html });
    if (S.chat[rid].length > 60) S.chat[rid].splice(0, S.chat[rid].length - 60);
    if (UI.activeTab() === "talk") UI.renderTalk();
  };

  let busy = false;
  UI.sendChat = async function () {
    const input = $("#chat-text");
    const text = input.value.trim();
    const r = S.residents.find((x) => x.id === S.selected);
    if (!text || !r || busy) return;
    if (!r.alive) return UI.toast(r.name + " is beyond conversation.", "bad");
    if (r.missing) return UI.toast(r.name + " has vanished from the district.", "bad");
    input.value = "";
    UI.pushChat(r.id, "you", text);
    busy = true;
    const useClaude = NX.claude.enabled();
    if (useClaude) UI.pushChat(r.id, "sys", r.name.split(" ")[0] + " is thinking…");
    try {
      let out;
      if (useClaude) {
        try {
          out = await NX.claude.respond(S, r, text, (S.chat[r.id] || []).filter((t) => t.who !== "sys"));
        } catch (err) {
          NX.claude.lastError = String(err.message || err);
          UI.toast("Claude call failed (" + NX.claude.lastError.slice(0, 60) + ") — using local mind.", "bad");
          out = NX.dialogue.respond(S, r, text);
        }
        // remove thinking line
        S.chat[r.id] = (S.chat[r.id] || []).filter((t) => !(t.who === "sys" && /thinking…$/.test(t.text || "")));
      } else {
        out = NX.dialogue.respond(S, r, text);
      }
      NX.dialogue.applyEffects(S, r, out.effects);
      UI.pushChat(r.id, "them", out.reply);
      UI.speak(out.reply);
      // pending interactive offers
      if (S._pendingBribe) {
        const pb = S._pendingBribe; S._pendingBribe = null;
        UI.pushChat(r.id, "sys", "", `${NX.esc(r.name.split(" ")[0])} slides ${NX.money(pb.amount)} across… <button class="btn" data-offer="bribe:${pb.from}:${pb.amount}">TAKE IT</button> <button class="btn" data-offer="refuse:${pb.from}">REFUSE</button>`);
      }
      if (S._pendingJob) {
        const pj = S._pendingJob; S._pendingJob = null;
        const b = NX.economy.biz(S, pj.biz);
        if (b) UI.pushChat(r.id, "sys", "", `Job offer at ${NX.esc(b.name)} — <button class="btn" data-offer="job:${b.id}">ACCEPT</button> <button class="btn" data-offer="declinejob:${b.id}">DECLINE</button>`);
      }
      NX.app.save();
    } finally {
      busy = false;
      if (UI.activeTab() === "talk") { UI.renderTalk(); $("#chat-text")?.focus(); }
    }
  };

  UI.resolveOffer = function (spec) {
    const [kind, a, b] = spec.split(":");
    const r = S.residents.find((x) => x.id === (a || S.selected));
    if (kind === "bribe" && r) {
      const amt = parseInt(b, 10) || 200;
      S.player.money += amt; r.money = Math.max(0, r.money - amt);
      NX.social.adjustPlayerRel(S, r, 6);
      NX.social.playerRumor(S, r, `paid the newcomer ${NX.money(amt)} to stay quiet — they took it`, 4);
      NX.social.rep(S, "gang", 3); NX.social.rep(S, "police", -3);
      UI.pushChat(r.id, "sys", `You pocket ${NX.money(amt)}. ${r.name.split(" ")[0]} exhales.`);
    } else if (kind === "refuse" && r) {
      NX.social.adjustPlayerRel(S, r, -8);
      NX.social.playerRumor(S, r, "refused my money — they can't be bought, which is worse", 4);
      UI.pushChat(r.id, "sys", `You leave the money on the table. ${r.name.split(" ")[0]}'s eyes go cold.`);
      NX.social.rep(S, "public", 2, "word spreads: you can't be bought");
    } else if (kind === "job") {
      S.player.jobBiz = a;
      const biz = NX.economy.biz(S, a);
      UI.pushChat(S.selected, "sys", `You start at ${biz.name} tomorrow. Wages land at midnight.`);
      UI.toast("You have a job. Money arrives each midnight.", "gold");
    } else if (kind === "declinejob") {
      UI.pushChat(S.selected, "sys", "You pass on the offer.");
    }
    NX.app.save();
    UI.renderTalk();
  };

  // ---- voice ----------------------------------------------------------
  UI.voiceOn = () => localStorage.getItem("nexus_voice") === "1";
  UI.speak = function (text) {
    if (!UI.voiceOn() || !window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05; u.pitch = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  };
  let rec = null;
  UI.micToggle = function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return UI.toast("Voice input isn't supported in this browser.", "bad");
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = "en-US"; rec.interimResults = false;
    $("#chat-mic").classList.add("rec");
    rec.onresult = (e) => { $("#chat-text").value = e.results[0][0].transcript; UI.sendChat(); };
    rec.onend = () => { rec = null; $("#chat-mic")?.classList.remove("rec"); };
    rec.start();
  };

  // ---- FEED -----------------------------------------------------------
  UI.renderFeed = function () {
    $("#tab-feed").innerHTML = `<h3 class="sec">PULSE — what Rusthook is saying</h3>` +
      (S.feed.length ? S.feed.slice(0, 60).map((p) => `
        <div class="post ${p.kind}">
          <div class="ph"><span class="pa">${NX.esc(p.author)}</span><span class="phandle">${NX.esc(p.handle)}</span><span class="pt">d${p.d} ${NX.fmtTime(p.m)}</span></div>
          <div class="pb">${NX.esc(p.text)}</div>
          <div class="pf"><span>♥ ${p.likes}</span><span>⇄ ${p.reposts}</span>${p.kind === "rumor" ? "<span style='color:var(--neon2)'>⚠ unverified</span>" : ""}</div>
        </div>`).join("") : `<div class="digest">The feed is quiet. It won't stay that way.</div>`);
  };

  // ---- NEWS -----------------------------------------------------------
  UI.renderNews = function () {
    $("#tab-news").innerHTML = `
      <h3 class="sec">DAILY DIGESTS</h3>
      ${S.digests.slice(0, 5).map((d) => `<div class="digest"><div class="dtitle">DAY ${d.d}</div><ul>${d.lines.map((l) => `<li>${NX.esc(l)}</li>`).join("")}</ul></div>`).join("") || '<div class="digest">First digest arrives at midnight.</div>'}
      <h3 class="sec">EVENT LOG</h3>
      ${S.eventLog.slice(0, 60).map((e) => `<div class="evline ${e.kind}"><span class="et">d${e.d} ${NX.fmtTime(e.m)}</span>${NX.esc(e.text)}</div>`).join("")}`;
  };

  // ---- GOD ------------------------------------------------------------
  UI.renderGod = function () {
    const eco = S.economy;
    $("#tab-god").innerHTML = `
      <div class="godpane">
      <div class="warn">⚠ GOD MODE — you are no longer a citizen. Policy changes ripple through 30 simulated lives. Projections may be wrong; people are not spreadsheets.</div>
      <div class="policy"><label><span>TAX RATE</span><b>${Math.round(eco.taxRate * 100)}%</b></label>
        <input type="range" id="god-tax" min="0" max="40" value="${Math.round(eco.taxRate * 100)}">
        <div class="desc">Funds the treasury. High taxes drain wages and squeeze businesses.</div></div>
      <div class="policy"><label><span>MINIMUM WAGE</span><b>$${eco.minWage}/hr</b></label>
        <input type="range" id="god-wage" min="8" max="26" value="${eco.minWage}">
        <div class="desc">Raises worker income — and payroll costs. Small businesses may cut staff.</div></div>
      <div class="policy"><label><span>POLICE BUDGET</span><b>${eco.policeBudget}/10</b></label>
        <input type="range" id="god-police" min="1" max="10" value="${eco.policeBudget}">
        <div class="desc">More arrests, less crime — and a treasury bill. The Knives adapt either way.</div></div>
      <div class="togglerow"><span>UNIVERSAL BASIC INCOME <span style="color:var(--dim)">($30/day/resident)</span></span>
        <label class="switch"><input type="checkbox" id="god-ubi" ${eco.ubi ? "checked" : ""}><span class="slider-ui"></span></label></div>
      <div class="togglerow"><span>SMALL BUSINESS SUBSIDY</span>
        <label class="switch"><input type="checkbox" id="god-sub" ${eco.bizSubsidy ? "checked" : ""}><span class="slider-ui"></span></label></div>
      <div class="togglerow"><span>STREET SURVEILLANCE <span style="color:var(--dim)">(more witnesses, less privacy)</span></span>
        <label class="switch"><input type="checkbox" id="god-cam" ${eco.surveillance ? "checked" : ""}><span class="slider-ui"></span></label></div>
      <div class="togglerow"><span>OMNISCIENT PROFILES <span style="color:var(--dim)">(reveal secrets in PEOPLE)</span></span>
        <label class="switch"><input type="checkbox" id="god-eye" ${S.godView ? "checked" : ""}><span class="slider-ui"></span></label></div>
      <h3 class="sec">PROJECTION</h3>
      <div class="digest">${NX.esc(UI.projection())}</div>
      </div>`;
    $("#god-tax").onchange = (e) => { NX.economy.applyPolicy(S, "taxRate", e.target.value / 100); UI.renderGod(); NX.app.save(); };
    $("#god-wage").onchange = (e) => { NX.economy.applyPolicy(S, "minWage", +e.target.value); UI.renderGod(); NX.app.save(); };
    $("#god-police").onchange = (e) => { NX.economy.applyPolicy(S, "policeBudget", +e.target.value); UI.renderGod(); NX.app.save(); };
    $("#god-ubi").onchange = (e) => { NX.economy.applyPolicy(S, "ubi", e.target.checked); UI.renderGod(); NX.app.save(); };
    $("#god-sub").onchange = (e) => { NX.economy.applyPolicy(S, "bizSubsidy", e.target.checked); UI.renderGod(); NX.app.save(); };
    $("#god-cam").onchange = (e) => { NX.economy.applyPolicy(S, "surveillance", e.target.checked); UI.renderGod(); NX.app.save(); };
    $("#god-eye").onchange = (e) => { S.godView = e.target.checked; NX.app.save(); };
  };

  UI.projection = function () {
    const eco = S.economy;
    const bits = [];
    if (eco.taxRate > 0.25) bits.push("High taxation: expect business closures and colder streets within days.");
    if (eco.minWage >= 18) bits.push("Wage floor is generous — worker morale up, small-business payrolls straining.");
    if (eco.policeBudget >= 8) bits.push("Heavy policing: arrests will climb; so will resentment in the flats.");
    if (eco.policeBudget <= 2) bits.push("Skeleton policing: the Knives will notice before you do.");
    if (eco.ubi) bits.push("UBI is flowing. Treasury drains ~$" + (31 * 30) + "/day; desperation crime should ease.");
    if (eco.treasury < 2000) bits.push("TREASURY WARNING: the city is nearly broke.");
    if (!bits.length) bits.push("Steady as she goes. The district mostly runs itself — until it doesn't.");
    return bits.join(" ");
  };

  // ---- SETTINGS -------------------------------------------------------
  UI.renderSettings = function () {
    const hasKey = NX.claude.enabled();
    $("#tab-settings").innerHTML = `
      <h3 class="sec">NPC MINDS</h3>
      <div class="setting"><label>ANTHROPIC API KEY (optional — powers real Claude conversations)</label>
        <input type="password" id="set-key" placeholder="sk-ant-…" value="${NX.esc(NX.claude.getKey())}">
        <div class="note ${hasKey ? "ok" : ""}">${hasKey ? "◉ Claude minds ACTIVE — every resident is played by " + NX.esc(NX.claude.getModel()) : "Without a key, residents use the built-in local mind (still remembers everything). Key is stored only in this browser's localStorage and sent only to api.anthropic.com."}</div>
        ${NX.claude.lastError ? `<div class="note err">last error: ${NX.esc(NX.claude.lastError)}</div>` : ""}
      </div>
      <div class="setting"><label>NPC MODEL</label>
        <select id="set-model">
          ${["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"].map((m) => `<option ${NX.claude.getModel() === m ? "selected" : ""}>${m}</option>`).join("")}
        </select>
        <div class="note">haiku = fast & cheap for routine chatter · opus = the district gets scarily smart.</div></div>
      <div class="togglerow"><span>SPEAK REPLIES ALOUD (browser voice)</span>
        <label class="switch"><input type="checkbox" id="set-voice" ${UI.voiceOn() ? "checked" : ""}><span class="slider-ui"></span></label></div>
      <h3 class="sec">WORLD</h3>
      <div class="note" style="font-size:11px;color:var(--dim);line-height:1.6">The city autosaves every game-hour and whenever you act. Close the tab; Rusthook keeps living — up to 7 days of city time are simulated when you return.</div>
      <div class="btnrow">
        <button class="btn" id="set-save">SAVE NOW</button>
        <button class="btn danger" id="set-reset">RESET THE CITY</button>
      </div>`;
    $("#set-key").addEventListener("change", (e) => { NX.claude.setKey(e.target.value); UI.renderSettings(); });
    $("#set-model").addEventListener("change", (e) => NX.claude.setModel(e.target.value));
    $("#set-voice").addEventListener("change", (e) => localStorage.setItem("nexus_voice", e.target.checked ? "1" : "0"));
    $("#set-save").onclick = () => { NX.app.save(); UI.toast("City saved."); };
    $("#set-reset").onclick = () => {
      if (confirm("Erase Rusthook and everyone's memory of you? This cannot be undone.")) NX.app.reset();
    };
  };

  // ---- away modal -----------------------------------------------------
  UI.showAway = function (daysSimmed, digests) {
    const body = $("#away-body");
    body.innerHTML = `<p>You were gone. Rusthook wasn't paused — <b>${daysSimmed} day${daysSimmed > 1 ? "s" : ""}</b> passed without you.</p>` +
      digests.map((d) => `<div class="away-day">DAY ${d.d}</div><ul>${d.lines.map((l) => `<li>${NX.esc(l)}</li>`).join("")}</ul>`).join("");
    $("#away-modal").hidden = false;
    $("#away-close").onclick = () => { $("#away-modal").hidden = true; };
  };
})();
