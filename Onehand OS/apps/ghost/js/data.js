/* ============================================================
   GHOST // data.js — machines, agents, modes, mission scripts
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;

  /* ---------- AGENTS ---------- */
  const agents = {
    ORCH:     { id: "ORCH",     name: "ORCHESTRATOR", role: "Mission Control", color: "#35f2e6", av: "Ω" },
    RECON:    { id: "RECON",    name: "RECON",        role: "Research",        color: "#4aa8ff", av: "R" },
    BRAND:    { id: "BRAND",    name: "ATELIER",      role: "Brand & Design",  color: "#ff5db1", av: "A" },
    FRONT:    { id: "FRONT",    name: "FORGE",        role: "Frontend",        color: "#a878ff", av: "F" },
    BACK:     { id: "BACK",     name: "KEEP",         role: "Backend & Data",  color: "#3df5a8", av: "K" },
    DEVOPS:   { id: "DEVOPS",   name: "RELAY",        role: "DevOps / Deploy", color: "#ffc24d", av: "D" },
    VISION:   { id: "VISION",   name: "ARGUS",        role: "QA · Vision",     color: "#9fe8ff", av: "V" },
    SECOPS:   { id: "SECOPS",   name: "WARDEN",       role: "Security",        color: "#ff415f", av: "S" },
    OPS:      { id: "OPS",      name: "STEWARD",      role: "Business Ops",    color: "#7dfff5", av: "B" },
  };
  const agentList = Object.values(agents);

  /* ---------- MACHINES (grid tiles) ---------- */
  const machines = [
    { id: "DESK-01", name: "DESKTOP 01", kind: "workstation", res: "2560×1440", scene: "idle", task: "", agent: null, status: "online", prog: 0 },
    { id: "DESK-02", name: "DESKTOP 02", kind: "workstation", res: "1920×1080", scene: "idle", task: "", agent: null, status: "online", prog: 0 },
    { id: "VPS-01",  name: "VPS-01",     kind: "cloud server", res: "headless",  scene: "idle", task: "", agent: null, status: "online", prog: 0 },
    { id: "PHONE-01",name: "PHONE 01",   kind: "android · adb",res: "390×844",   scene: "idle", task: "", agent: null, status: "online", prog: 0 },
    { id: "CRM",     name: "RSG CRM",    kind: "web app",      res: "1440×900",  scene: "idle", task: "", agent: null, status: "online", prog: 0 },
    { id: "SEC",     name: "SECURITY",   kind: "sentinel",     res: "multi-cam", scene: "security", task: "No threats detected", agent: "SECOPS", status: "online", prog: 0 },
    { id: "PIKVM",   name: "PiKVM-01",   kind: "kvm bridge",   res: "1080p",     scene: "idle", task: "", agent: null, status: "online", prog: 0 },
    { id: "NAS",     name: "VAULT NAS",  kind: "storage",      res: "48 TB",     scene: "idle", task: "", agent: null, status: "online", prog: 0 },
  ];

  /* ---------- HOME-LAB physical devices (3D + map) ---------- */
  const labDevices = [
    { id: "PIKVM",   name: "PiKVM-01",   kind: "KVM Bridge",   ico: "🔌", status: "online" },
    { id: "DESK-01", name: "Desktop 01", kind: "Workstation",  ico: "🖥️", status: "online" },
    { id: "DESK-02", name: "Desktop 02", kind: "Workstation",  ico: "🖥️", status: "online" },
    { id: "PI",      name: "Pi Cluster", kind: "3× Raspberry", ico: "🍓", status: "online" },
    { id: "NAS",     name: "Vault NAS",  kind: "48 TB Storage",ico: "🗄️", status: "online" },
    { id: "CAM",     name: "Cam Array",  kind: "2× IP Camera", ico: "📷", status: "online" },
    { id: "PLUG",    name: "Smart Plugs",kind: "6× Outlet",    ico: "⚡", status: "online" },
    { id: "PHONE-01",name: "Phone 01",   kind: "Android · ADB",ico: "📱", status: "online" },
  ];

  /* ---------- MODES ---------- */
  const modes = [
    { id: "build",   name: "Build",    ic: "🛠️", blurb: "Ship software, sites & automations" },
    { id: "company", name: "Company",  ic: "🏢", blurb: "Run approved RSG operations" },
    { id: "research",name: "Research", ic: "🔬", blurb: "Investigate, compare, challenge, report" },
    { id: "warroom", name: "War Room", ic: "🚨", blurb: "Diagnose & repair failing systems" },
    { id: "onehand", name: "OneHand",  ic: "🎙️", blurb: "Voice-first accessible control" },
  ];

  /* helper to keep step authoring terse */
  const L = (agent, text, at) => ({ agent, text, at: at == null ? 0.15 : at });

  /* ============================================================
     MISSION: BUILD — South Shore roofing company (the flagship)
     ============================================================ */
  const build = {
    id: "build",
    title: "Launch complete website & sales system — South Shore Roofing Co.",
    prompt: "Create and launch a complete website and sales system for a South Shore roofing company.",
    steps: [
      {
        key: "recon", title: "Research company & competitors",
        detail: "recon · market + SERP + reviews",
        assign: [{ m: "DESK-01", scene: "research", task: "Scanning competitors & local SERP", agent: "RECON" }],
        lines: [
          L("ORCH", "Mission accepted. Decomposing into 10 phases across 5 machines.", .05),
          L("RECON", "Pulled 14 South Shore roofers. Avg site is slow, no online quoting.", .4),
          L("RECON", "Opportunity: instant-quote + reviews wall. Handing brief to <b>ATELIER</b>.", .8),
        ],
      },
      {
        key: "brand", title: "Generate branding & website",
        detail: "atelier · identity + copy + layout",
        assign: [
          { m: "DESK-01", scene: "brand", task: "Composing brand system", agent: "BRAND" },
          { m: "DESK-02", scene: "browser", task: "Rendering landing draft", agent: "BRAND" },
        ],
        lines: [
          L("BRAND", "Palette: slate + safety-orange. Voice: local, trustworthy, fast.", .3),
          L("BRAND", "Landing, services, quote, reviews, contact drafted. Passing to <b>FORGE</b>.", .75),
        ],
      },
      {
        key: "build", title: "Open VS Code & build the app",
        detail: "forge · next.js + tailwind",
        assign: [
          { m: "DESK-01", scene: "code", task: "Scaffolding Next.js app", agent: "FRONT" },
          { m: "DESK-02", scene: "browser", task: "Live preview :3000", agent: "FRONT" },
        ],
        lines: [
          L("FRONT", "Scaffolding Next.js + Tailwind. Components: Hero, QuoteWizard, ReviewsWall.", .25),
          L("FRONT", "Instant-quote wizard wired to pricing model. Preview live on DESKTOP 02.", .7),
        ],
      },
      {
        key: "db", title: "Create database & admin portal",
        detail: "keep · postgres + rls + admin",
        assign: [
          { m: "VPS-01", scene: "terminal", task: "Provisioning Postgres + RLS", agent: "BACK" },
          { m: "CRM", scene: "crm", task: "Wiring leads → pipeline", agent: "BACK" },
        ],
        lines: [
          L("BACK", "Schema: leads, quotes, jobs, invoices. Row-level security on.", .3),
          L("BACK", "Admin portal live. New quotes stream into <b>RSG CRM</b> pipeline.", .78),
        ],
      },
      {
        key: "stripe", title: "Configure Stripe",
        detail: "keep · deposits + webhooks",
        assign: [
          { m: "DESK-02", scene: "checkout", task: "Building deposit checkout", agent: "BACK" },
          { m: "VPS-01", scene: "terminal", task: "Registering webhooks", agent: "BACK" },
        ],
        lines: [
          L("BACK", "Stripe in test mode. $500 deposit product + webhook → job created.", .35),
          L("ORCH", "Reminder: payment keys handled by human. GHOST wires flow only.", .7),
        ],
      },
      {
        key: "deploy", title: "Deploy to Vercel",
        detail: "relay · build + edge deploy",
        assign: [
          { m: "VPS-01", scene: "terminal", task: "vercel --prod", agent: "DEVOPS" },
        ],
        lines: [
          L("DEVOPS", "Build passed in 41s. Deploying to edge…", .3),
          L("DEVOPS", "Live at <code>southshore-roofing.vercel.app</code>. Reported success.", .72),
          L("ORCH", "Do not trust the success message. <b>ARGUS</b>, verify on real hardware.", .9),
        ],
      },
      {
        key: "verify", title: "Test the site on another computer",
        detail: "argus · visual + interaction QA",
        assign: [
          { m: "DESK-02", scene: "browser", task: "Clicking through every page", agent: "VISION" },
          { m: "PIKVM", scene: "kvm", task: "Bridging DESKTOP 02 input", agent: "VISION" },
        ],
        lines: [
          L("VISION", "Loaded prod build on DESKTOP 02 via PiKVM. Desktop pages: 6/6 pass.", .35),
          L("VISION", "Forms submit, quote calc correct, reviews render. Moving to mobile.", .8),
        ],
      },
      {
        key: "mobile", title: "Test mobile checkout on connected phone",
        detail: "argus · phone 01 · adb",
        assign: [
          { m: "PHONE-01", scene: "mobile", task: "Mobile checkout @ 390px", agent: "VISION" },
        ],
        lines: [
          L("VISION", "Driving PHONE 01 over ADB. Loading /quote → /checkout at 390px…", .3),
          L("VISION", "⚠ Visual anomaly. Checkout button overlaps navigation.", .62),
        ],
        anomaly: {
          title: "Checkout button overlaps navigation",
          machine: "PHONE-01",
          severity: "High",
          viewport: "390 × 844",
          selector: "button.cta-pay ↔ nav.sticky",
          action: "Returning task to FORGE (Frontend)",
        },
      },
      {
        key: "fix", title: "Fix visual & functional problems",
        detail: "forge · self-correction loop",
        assign: [
          { m: "DESK-01", scene: "code", task: "Patching sticky-nav z-index + safe-area", agent: "FRONT" },
          { m: "PHONE-01", scene: "mobile", task: "Re-testing checkout @ 390px", agent: "VISION" },
        ],
        clearsAnomaly: true,
        lines: [
          L("FRONT", "Root cause: sticky nav had no bottom inset. Added safe-area pad + z-index.", .3),
          L("FRONT", "Redeployed patch. <b>ARGUS</b> re-run mobile checkout.", .55),
          L("VISION", "Re-tested at 360/390/430px. Checkout clean. Deposit test charge OK.", .85),
        ],
      },
      {
        key: "audit", title: "Produce video replay & audit log",
        detail: "argus · replay + evidence",
        assign: [
          { m: "DESK-01", scene: "replay", task: "Rendering replay + audit", agent: "VISION" },
        ],
        lines: [
          L("VISION", "Replay rendered: 218 actions, 1 anomaly caught & fixed, 0 open.", .3),
          L("ORCH", "Mission complete. Site live, checkout verified, audit archived to VAULT NAS.", .8),
        ],
        complete: true,
      },
    ],
  };

  /* ============================================================
     MISSION: COMPANY — approved RSG operations
     ============================================================ */
  const company = {
    id: "company",
    title: "Run today's approved RSG operations",
    prompt: "Review new leads, prepare proposals, update clients, and produce the monthly report.",
    steps: [
      { key: "leads", title: "Review new leads", detail: "steward · crm intake",
        assign: [{ m: "CRM", scene: "crm", task: "Scoring 11 new leads", agent: "OPS" }],
        lines: [ L("OPS", "11 new leads overnight. 4 hot (roof replacement), 5 warm, 2 spam filtered.", .3),
                 L("OPS", "Routed hot leads to owner. Drafting proposals for the 4.", .8) ] },
      { key: "proposal", title: "Prepare proposals", detail: "steward · quote + pdf",
        assign: [{ m: "DESK-01", scene: "code", task: "Generating 4 proposals", agent: "OPS" },
                 { m: "CRM", scene: "crm", task: "Attaching to deals", agent: "OPS" }],
        lines: [ L("OPS", "Proposals built from job templates + measurements. Awaiting approval.", .4) ],
        gate: "Approve sending 4 proposals to clients?" },
      { key: "portal", title: "Create client portals", detail: "keep · per-client portal",
        assign: [{ m: "VPS-01", scene: "terminal", task: "Spinning up 4 portals", agent: "BACK" }],
        lines: [ L("BACK", "Portals provisioned with project status, docs, and pay links.", .5) ] },
      { key: "updates", title: "Send project updates", detail: "steward · active jobs",
        assign: [{ m: "CRM", scene: "crm", task: "Composing 9 job updates", agent: "OPS" }],
        lines: [ L("OPS", "9 active jobs. Update drafts ready with photos from crews.", .45) ],
        gate: "Approve sending 9 client project updates?" },
      { key: "test", title: "Test client systems", detail: "argus · portal QA",
        assign: [{ m: "DESK-02", scene: "browser", task: "Testing portals & pay links", agent: "VISION" },
                 { m: "PHONE-01", scene: "mobile", task: "Mobile portal check", agent: "VISION" }],
        lines: [ L("VISION", "All 4 portals load, pay links valid, mobile clean. 0 issues.", .6) ] },
      { key: "report", title: "Produce monthly report", detail: "steward · KPIs + charts",
        assign: [{ m: "DESK-01", scene: "replay", task: "Rendering monthly report", agent: "OPS" }],
        lines: [ L("OPS", "March: 22 jobs, $214k booked, 4.9★ avg, 61% close rate.", .35),
                 L("ORCH", "Report archived. Operations complete.", .85) ], complete: true },
    ],
  };

  /* ============================================================
     MISSION: RESEARCH — multi-machine investigation
     ============================================================ */
  const research = {
    id: "research",
    title: "Investigate: is a heat-pump upgrade worth it for South Shore homes?",
    prompt: "Use multiple machines to investigate, compare sources, challenge conclusions, and assemble an evidence-backed report.",
    steps: [
      { key: "spread", title: "Fan out across sources", detail: "recon · 3 machines · 40 sources",
        assign: [{ m: "DESK-01", scene: "research", task: "Gov + utility data", agent: "RECON" },
                 { m: "DESK-02", scene: "research", task: "Vendor + review data", agent: "RECON" },
                 { m: "VPS-01", scene: "terminal", task: "Scraping rebate tables", agent: "RECON" }],
        lines: [ L("RECON", "40 sources queued across 3 machines. Dedup + credibility scoring on.", .4) ] },
      { key: "compare", title: "Compare & cross-check", detail: "recon · reconcile conflicts",
        assign: [{ m: "DESK-01", scene: "research", task: "Reconciling cost claims", agent: "RECON" }],
        lines: [ L("RECON", "Vendor payback claims (4yr) conflict with utility data (7–9yr).", .5) ] },
      { key: "challenge", title: "Challenge the conclusion", detail: "argus · red-team",
        assign: [{ m: "DESK-02", scene: "research", task: "Red-teaming assumptions", agent: "VISION" }],
        lines: [ L("VISION", "Vendor payback assumes best-case climate + subsidies. Flagged as biased.", .4),
                 L("VISION", "Independent estimate: 6–8yr payback in our climate zone.", .8) ] },
      { key: "assemble", title: "Assemble evidence-backed report", detail: "recon · cited report",
        assign: [{ m: "DESK-01", scene: "replay", task: "Writing cited report", agent: "RECON" }],
        lines: [ L("RECON", "Verdict: worth it for oil-heat homes, marginal for gas. 31 citations.", .4),
                 L("ORCH", "Report complete with confidence intervals and dissenting view.", .85) ], complete: true },
    ],
  };

  /* ============================================================
     MISSION: WAR ROOM — failing production system
     ============================================================ */
  const warroom = {
    id: "warroom",
    title: "INCIDENT — checkout returning 500s on production",
    prompt: "The live site is failing. Investigate logs, reproduce, propose a repair, and wait for approval before changing production.",
    steps: [
      { key: "detect", title: "Isolate affected systems", detail: "warden · triage",
        assign: [{ m: "SEC", scene: "security", task: "Correlating alerts", agent: "SECOPS" },
                 { m: "VPS-01", scene: "terminal", task: "Tailing prod logs", agent: "DEVOPS" }],
        lines: [ L("SECOPS", "Checkout 500 rate at 34%. Started 12m ago. No breach signature.", .3),
                 L("DEVOPS", "Errors localized to payment webhook handler on VPS-01.", .8) ] },
      { key: "repro", title: "Reproduce the issue", detail: "argus · staging repro",
        assign: [{ m: "DESK-02", scene: "checkout", task: "Reproducing on staging", agent: "VISION" }],
        lines: [ L("VISION", "Reproduced. Stripe API version bump broke webhook signature check.", .55) ] },
      { key: "propose", title: "Propose a repair", detail: "keep · fix + rollback plan",
        assign: [{ m: "DESK-01", scene: "code", task: "Patching signature verify", agent: "BACK" }],
        lines: [ L("BACK", "Fix: pin webhook API version + tolerant verify. Tested green on staging.", .4),
                 L("BACK", "Rollback plan attached. <b>Holding — production change needs approval.</b>", .8) ],
        gate: "Approve deploying the hotfix to PRODUCTION?" },
      { key: "apply", title: "Apply & verify fix", detail: "relay · guarded deploy",
        assign: [{ m: "VPS-01", scene: "terminal", task: "Deploying hotfix", agent: "DEVOPS" },
                 { m: "PHONE-01", scene: "checkout", task: "Live checkout test", agent: "VISION" }],
        lines: [ L("DEVOPS", "Hotfix live. 500 rate → 0% over 4 min.", .5),
                 L("VISION", "Live checkout verified on phone. Incident resolved.", .8),
                 L("ORCH", "Post-incident report generated and archived.", .92) ], complete: true },
    ],
  };

  /* ============================================================
     MISSION: ONEHAND — voice-first accessible control
     ============================================================ */
  const onehand = {
    id: "onehand",
    title: "OneHand — voice-first control of the fleet",
    prompt: "\"GHOST, wake the lab, pull last night's leads, and put the roofing quote on the big screen.\"",
    steps: [
      { key: "wake", title: "Wake the lab", detail: "voice · fleet power-on",
        assign: [{ m: "PIKVM", scene: "kvm", task: "Powering desks via smart plugs", agent: "OPS" },
                 { m: "NAS", scene: "terminal", task: "Mounting shares", agent: "OPS" }],
        lines: [ L("OPS", "Heard: “wake the lab.” Smart plugs on, 2 desks + NAS up in 9s.", .5) ] },
      { key: "leads", title: "Pull last night's leads", detail: "voice · crm read-back",
        assign: [{ m: "CRM", scene: "crm", task: "Reading 6 leads aloud", agent: "OPS" }],
        lines: [ L("OPS", "6 leads. Reading top 3 by score. Say “proposal” on any to draft it.", .55) ] },
      { key: "screen", title: "Put quote on the big screen", detail: "voice · cast to DESKTOP 01",
        assign: [{ m: "DESK-01", scene: "browser", task: "Casting roofing quote", agent: "OPS" }],
        lines: [ L("OPS", "Roofing quote #RSG-1183 on the big screen. Foot-pedal = scroll.", .5),
                 L("ORCH", "OneHand session active. Every machine reachable by voice.", .9) ], complete: true },
    ],
  };

  const missions = { build, company, research, warroom, onehand };

  G.DATA = { agents, agentList, machines, labDevices, modes, missions };
})();
