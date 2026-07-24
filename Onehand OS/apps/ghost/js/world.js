/* ============================================================
   GHOST // world.js — the operational World Model
   A persistent, typed relationship graph of everything GHOST can
   observe or control. Relationships are STORED and QUERYABLE and
   drive the planner's blast-radius / impact reasoning.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const S = G.store;

  // relationship types that mean "A cannot function without B"
  const DEP_RELS = ["depends_on", "hosted_by", "deployed_from", "stores_data_in", "controlled_through", "integrates"];
  const ACCESS_RELS = ["authorized_for", "has_access", "can_contact"];

  /* ---------- entity / edge helpers ---------- */
  function entity(id) { return S.get("entities", id); }
  function entities(type) { return type ? S.query("entities", (e) => e.type === type) : S.all("entities"); }
  function edges() { return S.all("edges"); }

  function addEntity(e) { return S.put("entities", e); }
  function link(from, rel, to, meta) {
    const id = `${from}|${rel}|${to}`;
    return S.put("edges", Object.assign({ id, from, rel, to }, meta || {}));
  }

  /* ---------- traversal ---------- */
  function outgoing(id, rels) { return edges().filter((e) => e.from === id && (!rels || rels.includes(e.rel))); }
  function incoming(id, rels) { return edges().filter((e) => e.to === id && (!rels || rels.includes(e.rel))); }

  // forward: what this entity relies on
  function dependencies(id, seen) {
    seen = seen || new Set();
    outgoing(id, DEP_RELS).forEach((e) => { if (!seen.has(e.to)) { seen.add(e.to); dependencies(e.to, seen); } });
    return [...seen];
  }
  // reverse: what breaks if this entity goes down (transitive dependents)
  function blastRadius(id, seen) {
    seen = seen || new Set();
    incoming(id, DEP_RELS).forEach((e) => { if (!seen.has(e.from)) { seen.add(e.from); blastRadius(e.from, seen); } });
    return [...seen];
  }
  // who/what can reach this entity
  function accessTo(id) {
    const direct = incoming(id, ACCESS_RELS).map((e) => e.from);
    // also: access to the environment/system this entity belongs to
    const env = outgoing(id, ["in_environment"]).map((e) => e.to);
    env.forEach((ev) => incoming(ev, ACCESS_RELS).forEach((e) => direct.push(e.from)));
    return [...new Set(direct)];
  }
  function neighbors(id) {
    const out = outgoing(id).map((e) => ({ dir: "out", rel: e.rel, id: e.to }));
    const inc = incoming(id).map((e) => ({ dir: "in", rel: e.rel, id: e.from }));
    return out.concat(inc);
  }
  function reachableDevices() {
    return entities("device").filter((d) => d.reachable && d.status !== "offline");
  }

  /* ---------- name matching for NL queries ---------- */
  function matchEntity(text) {
    const t = text.toLowerCase();
    let best = null, bestLen = 0;
    entities().forEach((e) => {
      const names = [e.name].concat(e.aliases || []).map((s) => String(s).toLowerCase());
      names.forEach((n) => { if (n.length > 2 && t.includes(n) && n.length > bestLen) { best = e; bestLen = n.length; } });
    });
    return best;
  }

  function label(id) { const e = entity(id); return e ? e.name : id; }

  /* ---------- natural-language query resolver ---------- */
  function nlQuery(text) {
    const t = text.toLowerCase();
    const ent = matchEntity(text);

    if (/(breaks?|impact|goes offline|go down|blast|affected if)/.test(t)) {
      const target = ent || entity("sys.prod-env");
      const ids = blastRadius(target.id);
      return { kind: "blast", target: target.id, nodes: ids,
        summary: ids.length ? `${ids.length} system(s) break if ${target.name} goes offline.` : `Nothing depends on ${target.name}.`,
        list: ids.map(label) };
    }
    if (/(access|who can|authorized|reach) .*(prod|production|environment)|access to prod/.test(t) || /what has access/.test(t)) {
      const target = ent || entity("sys.prod-env");
      const ids = accessTo(target.id);
      return { kind: "access", target: target.id, nodes: ids,
        summary: `${ids.length} principal(s) can reach ${target.name}.`, list: ids.map(label) };
    }
    if (/(reachable|remotely|online devices|devices .*reachable|which devices)/.test(t)) {
      const ds = reachableDevices();
      return { kind: "devices", nodes: ds.map((d) => d.id),
        summary: `${ds.length} device(s) currently reachable.`, list: ds.map((d) => `${d.name} · ${d.connection}`) };
    }
    if (/(which|what).*(use|depend|rely|connected to|hosted)/.test(t) && ent) {
      const ids = blastRadius(ent.id);
      return { kind: "dependents", target: ent.id, nodes: ids,
        summary: `${ids.length} system(s) use / depend on ${ent.name}.`, list: ids.map(label) };
    }
    if (/(depends on|dependencies of|what does .* need|relies on)/.test(t) && ent) {
      const ids = dependencies(ent.id);
      return { kind: "dependencies", target: ent.id, nodes: ids,
        summary: `${ent.name} depends on ${ids.length} system(s).`, list: ids.map(label) };
    }
    if (/(can contact|contact customers|reach customers|workflows.*customer)/.test(t)) {
      const wf = edges().filter((e) => e.rel === "can_contact").map((e) => label(e.from));
      return { kind: "contact", nodes: [], summary: `${wf.length} workflow(s) can contact customers.`, list: [...new Set(wf)] };
    }
    if (ent) {
      const n = neighbors(ent.id);
      return { kind: "entity", target: ent.id, nodes: n.map((x) => x.id),
        summary: `${ent.name} — ${ent.type}. ${n.length} relationship(s).`,
        list: n.map((x) => `${x.dir === "out" ? "→" : "←"} ${x.rel.replace(/_/g, " ")} ${label(x.id)}`) };
    }
    return { kind: "none", nodes: [], summary: "No matching system found. Try naming a device, site, database, or “production”.", list: [] };
  }

  /* ============================================================
     SEED — coherent RSG (roofing co.) operational graph
     ============================================================ */
  function seed() {
    if (S.setting("seeded")) return;

    const E = [
      // ---- users ----
      { id: "usr.op", type: "user", name: "Operator (Joseph)", role: "Owner", ico: "🧑‍💼" },
      { id: "usr.field", type: "user", name: "Field Crew Lead", role: "Employee", ico: "👷" },

      // ---- environments ----
      { id: "sys.prod-env", type: "environment", name: "Production", aliases: ["prod", "production"], ico: "🌐", tier: "prod" },
      { id: "sys.staging-env", type: "environment", name: "Staging", aliases: ["staging"], ico: "🧪", tier: "staging" },

      // ---- devices ----
      { id: "dev.desk01", type: "device", name: "Desktop 01", aliases: ["desktop 01", "desk-01"], os: "Windows 11", connection: "GHOST node + RDP", reachable: true, status: "online", capabilities: ["screen", "input", "shell", "wol"], ico: "🖥️" },
      { id: "dev.desk02", type: "device", name: "Desktop 02", aliases: ["desktop 02", "desk-02"], os: "Windows 11", connection: "GHOST node + RDP", reachable: true, status: "online", capabilities: ["screen", "input", "shell", "wol"], ico: "🖥️" },
      { id: "dev.vps01", type: "device", name: "VPS-01", aliases: ["vps", "vps-01"], os: "Ubuntu 24.04", connection: "SSH", reachable: true, status: "online", capabilities: ["shell"], ico: "☁️" },
      { id: "dev.phone01", type: "device", name: "Phone 01", aliases: ["phone", "phone 01"], os: "Android 14", connection: "ADB over Wi-Fi", reachable: true, status: "online", capabilities: ["screen", "input"], ico: "📱" },
      { id: "dev.pikvm", type: "device", name: "PiKVM-01", aliases: ["pikvm"], os: "PiKVM OS", connection: "KVM bridge", reachable: true, status: "online", capabilities: ["screen", "input", "power"], ico: "🔌" },
      { id: "dev.nas", type: "device", name: "Vault NAS", aliases: ["nas", "vault"], os: "TrueNAS", connection: "SMB / API", reachable: true, status: "online", capabilities: ["storage"], ico: "🗄️" },
      { id: "dev.pi", type: "device", name: "Pi Cluster", aliases: ["pi cluster", "raspberry"], os: "Raspberry Pi OS", connection: "SSH", reachable: true, status: "online", capabilities: ["shell"], ico: "🍓" },
      { id: "dev.cam", type: "camera", name: "Workshop Cam", aliases: ["camera", "workshop cam"], connection: "RTSP", reachable: true, status: "online", capabilities: ["video"], ico: "📷" },

      // ---- repos ----
      { id: "repo.web", type: "repo", name: "rsg/southshore-web", aliases: ["southshore-web", "web repo"], provider: "GitHub", ico: "📦" },
      { id: "repo.crm", type: "repo", name: "rsg/crm", aliases: ["crm repo"], provider: "GitHub", ico: "📦" },

      // ---- deployments / systems ----
      { id: "sys.site", type: "deployment", name: "South Shore Roofing Site", aliases: ["southshore-roofing", "roofing site", "the website", "the site", "client portal"], url: "southshore-roofing.app", provider: "Vercel", status: "healthy", ico: "🌐" },
      { id: "sys.crm", type: "deployment", name: "RSG CRM", aliases: ["crm", "rsg crm"], url: "crm.rsg.app", provider: "Vercel", status: "healthy", ico: "🧩" },
      { id: "sys.admin", type: "deployment", name: "Admin Portal", aliases: ["admin", "admin portal"], url: "admin.rsg.app", provider: "Vercel", status: "healthy", ico: "🛠️" },
      { id: "sys.webhook", type: "service", name: "Payment Webhook", aliases: ["webhook", "payment webhook"], provider: "Vercel Edge", status: "healthy", ico: "🪝" },

      // ---- databases ----
      { id: "db.prod", type: "database", name: "Supabase · rsg-prod", aliases: ["prod db", "database", "rsg-prod"], provider: "Supabase", status: "healthy", ico: "🗃️" },
      { id: "db.staging", type: "database", name: "Supabase · rsg-staging", aliases: ["staging db"], provider: "Supabase", status: "healthy", ico: "🗃️" },

      // ---- integrations ----
      { id: "int.vercel", type: "integration", name: "Vercel", provider: "Vercel", connected: true, ico: "▲" },
      { id: "int.github", type: "integration", name: "GitHub", provider: "GitHub", connected: true, ico: "🐙" },
      { id: "int.stripe", type: "integration", name: "Stripe", provider: "Stripe", connected: true, ico: "💳" },
      { id: "int.supabase", type: "integration", name: "Supabase", provider: "Supabase", connected: true, ico: "⚡" },
      { id: "int.twilio", type: "integration", name: "Twilio SMS", provider: "Twilio", connected: false, ico: "✉️" },
      { id: "int.gmail", type: "integration", name: "Gmail", provider: "Google", connected: true, ico: "📧" },

      // ---- clients + projects ----
      { id: "cli.harbor", type: "client", name: "Harbor View HOA", ico: "🏘️" },
      { id: "cli.marsh", type: "client", name: "Marsh & Sons", ico: "🏠" },
      { id: "cli.bayside", type: "client", name: "Bayside Rentals", ico: "🏢" },

      // ---- workflows ----
      { id: "wf.missed", type: "workflow", name: "Missed-Call Follow-Up", aliases: ["missed call"], status: "active", ico: "🔁" },
      { id: "wf.backup", type: "workflow", name: "Nightly Backup Check", aliases: ["backup check", "backups"], status: "active", ico: "🔁" },
      { id: "wf.incident", type: "workflow", name: "Deploy-Fail → Incident", status: "active", ico: "🔁" },

      // ---- credentials (references only — NEVER values) ----
      { id: "cred.stripe", type: "credential", name: "Stripe API Key", scope: "prod", ico: "🔑" },
      { id: "cred.supabase", type: "credential", name: "Supabase Service Role", scope: "prod", ico: "🔑" },
    ];
    E.forEach(addEntity);

    const K = [
      // hosting / deploy / data
      ["sys.site", "hosted_by", "int.vercel"], ["sys.crm", "hosted_by", "int.vercel"], ["sys.admin", "hosted_by", "int.vercel"],
      ["sys.site", "deployed_from", "repo.web"], ["sys.crm", "deployed_from", "repo.crm"], ["sys.admin", "deployed_from", "repo.crm"],
      ["sys.site", "stores_data_in", "db.prod"], ["sys.crm", "stores_data_in", "db.prod"], ["sys.admin", "stores_data_in", "db.prod"],
      ["sys.webhook", "depends_on", "int.stripe"], ["sys.webhook", "stores_data_in", "db.prod"], ["sys.site", "depends_on", "sys.webhook"],
      ["db.prod", "hosted_by", "int.supabase"], ["db.staging", "hosted_by", "int.supabase"],
      ["repo.web", "hosted_by", "int.github"], ["repo.crm", "hosted_by", "int.github"],
      // environments
      ["sys.site", "in_environment", "sys.prod-env"], ["sys.crm", "in_environment", "sys.prod-env"], ["sys.admin", "in_environment", "sys.prod-env"], ["db.prod", "in_environment", "sys.prod-env"], ["sys.webhook", "in_environment", "sys.prod-env"],
      ["db.staging", "in_environment", "sys.staging-env"],
      // devices
      ["dev.desk01", "controlled_through", "dev.pikvm"], ["dev.desk02", "controlled_through", "dev.pikvm"],
      ["dev.cam", "observes", "dev.pi"], ["dev.nas", "connects_to", "dev.pi"],
      // clients own portals
      ["cli.harbor", "owns", "sys.site"], ["cli.marsh", "owns", "sys.site"], ["cli.bayside", "owns", "sys.crm"],
      // workflows update / can contact
      ["wf.missed", "updates", "sys.crm"], ["wf.missed", "can_contact", "cli.harbor"], ["wf.missed", "integrates", "int.twilio"],
      ["wf.backup", "depends_on", "dev.nas"], ["wf.backup", "depends_on", "db.prod"],
      ["wf.incident", "triggers", "sys.site"],
      // access / authorization
      ["usr.op", "authorized_for", "sys.prod-env"], ["usr.op", "authorized_for", "sys.staging-env"],
      ["usr.field", "authorized_for", "sys.staging-env"],
      ["cred.stripe", "has_access", "sys.prod-env"], ["cred.supabase", "has_access", "db.prod"],
    ];
    K.forEach(([f, r, t]) => link(f, r, t));

    // a couple of realistic operational records (leads live inside CRM as entities)
    [
      { id: "lead.1", type: "lead", name: "Karen Alvarez — roof replacement", stage: "new", score: 88, phone: "…", ico: "📇" },
      { id: "lead.2", type: "lead", name: "Tidewater Condos — 3 buildings", stage: "new", score: 91, ico: "📇" },
      { id: "lead.3", type: "lead", name: "M. Okafor — gutter repair", stage: "quoted", score: 64, ico: "📇" },
      { id: "lead.4", type: "lead", name: "Coastal Diner — flat roof", stage: "new", score: 79, ico: "📇" },
    ].forEach(addEntity);
    [["lead.1", "in_environment", "sys.crm"], ["lead.2", "in_environment", "sys.crm"], ["lead.3", "in_environment", "sys.crm"], ["lead.4", "in_environment", "sys.crm"]].forEach(([f, r, t]) => link(f, r, t));

    S.setting("seeded", true);
    S.audit({ type: "world.seeded", actor: "system", summary: `World model seeded — ${E.length} entities, ${K.length} relationships.` });
  }

  G.world = {
    seed, entity, entities, edges, addEntity, link,
    dependencies, blastRadius, accessTo, neighbors, reachableDevices,
    matchEntity, nlQuery, label, DEP_RELS, ACCESS_RELS,
  };
})();
