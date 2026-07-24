/* ============================================================
   GHOST // planner.js — natural language → structured plan
   Every command becomes a visible plan with impact levels,
   involved systems, verification, and approval requirements
   BEFORE anything executes.
   ============================================================ */
(function () {
  "use strict";
  const G = window.G;
  const W = G.world;

  // impact taxonomy (spec §9)
  const IMPACT = {
    0: { name: "Observe", color: "var(--ok)", desc: "Read-only" },
    1: { name: "Reversible", color: "var(--blue)", desc: "Auto-rollback" },
    2: { name: "Controlled", color: "var(--cyan)", desc: "Bounded change" },
    3: { name: "High Impact", color: "var(--warn)", desc: "Needs approval" },
    4: { name: "Prohibited", color: "var(--danger)", desc: "Blocked" },
  };

  let stepSeq = 0;
  function step(o) {
    return Object.assign({
      id: "s" + (++stepSeq), agent: "ORCH", impact: 0, reversible: true,
      tool: "internal", effect: { op: "noop" }, verify: { method: "observe" }, deps: [],
    }, o);
  }
  function systemsFrom(ids) { return [...new Set(ids.filter(Boolean))]; }

  /* ---------- intent templates (first match wins) ---------- */
  const TEMPLATES = [
    { // DEMO 2 — production incident / performance
      id: "incident",
      test: (t) => /(slow|down|unavailable|outage|502|500|error rate|failing|incident|not working|broken)/.test(t),
      build(t) {
        const target = W.matchEntity(t) || W.entity("sys.site");
        const blast = W.blastRadius(target.id);
        return {
          goal: `Diagnose why ${target.name} is degraded and propose the safest fix`,
          mode: "warroom",
          systems: systemsFrom([target.id, "dev.vps01", "db.prod", "int.vercel", ...blast]),
          risks: ["Root cause may be in production data or infrastructure", "No production change is made without explicit approval"],
          steps: [
            step({ title: "Open incident", detail: `Create incident record for ${target.name}`, agent: "SECOPS", impact: 1, tool: "incident.create", effect: { op: "createIncident", target: target.id }, verify: { method: "collectionCount", coll: "entities", inc: 1 } }),
            step({ title: "Check deployment status", detail: "Vercel latest deploy + build health", agent: "DEVOPS", impact: 0, tool: "vercel.read" }),
            step({ title: "Check server & DB health", detail: "VPS-01 load, Supabase status, error logs", agent: "INFRA", impact: 0, tool: "metrics.read" }),
            step({ title: "Reproduce on staging", detail: "Replay failing request against staging", agent: "VISION", impact: 0, tool: "browser.assert" }),
            step({ title: "Propose corrective action", detail: "Draft rollback / hotfix with blast-radius", agent: "ORCH", impact: 0, tool: "plan.propose", verify: { method: "observe" }, holds: true }),
          ],
        };
      },
    },
    { // DEMO 1 — multi-computer workspace
      id: "workspace",
      test: (t) => /(workspace|work setup|dev(elopment)? environment|open .*(computers|machines)|start my (work|dev)|across (both|two|all))/.test(t),
      build(t) {
        const oneHanded = /(one.?hand|accessible|comfortable|right hand|left hand)/.test(t);
        return {
          goal: "Start the development workspace across Desktop 01 + Desktop 02" + (oneHanded ? " with OneHand controls" : ""),
          mode: oneHanded ? "onehand" : "build",
          systems: systemsFrom(["dev.desk01", "dev.desk02", "dev.pikvm"]),
          risks: ["Machines will be powered on and applications launched"],
          steps: [
            step({ title: "Wake machines", detail: "Wake-on-LAN Desktop 01 & 02", agent: "INFRA", impact: 2, reversible: true, tool: "device.wake", effect: { op: "wake", ids: ["dev.desk01", "dev.desk02"] }, verify: { method: "entityField", id: "dev.desk01", field: "status", equals: "online" } }),
            step({ title: "Open applications", detail: "VS Code + browser + terminal on both", agent: "COMPUTER", impact: 2, tool: "app.launch", deps: ["s?"] }),
            step({ title: "Arrange windows", detail: "Restore saved multi-monitor layout", agent: "COMPUTER", impact: 1, tool: "window.layout" }),
            step({ title: "Verify availability", detail: "Confirm both desktops reachable & responsive", agent: "VISION", impact: 0, tool: "device.probe", verify: { method: "entityField", id: "dev.desk02", field: "status", equals: "online" } }),
            oneHanded
              ? step({ title: "Activate OneHand profile", detail: "Apply PHANTOM HAND control layout", agent: "ACCESS", impact: 1, tool: "onehand.activate", effect: { op: "activateOnehand" }, verify: { method: "setting", key: "onehand" } })
              : step({ title: "Confirm workspace ready", detail: "Report workspace state", agent: "ORCH", impact: 0 }),
          ],
        };
      },
    },
    { // deploy
      id: "deploy",
      test: (t) => /(deploy|release|ship|push to prod|go live|publish)/.test(t),
      build(t) {
        const target = W.matchEntity(t) || W.entity("sys.site");
        const blast = W.blastRadius(target.id);
        return {
          goal: `Deploy the latest approved build of ${target.name} to production`,
          mode: "build",
          systems: systemsFrom([target.id, "repo.web", "int.vercel", "db.prod", ...blast]),
          risks: [`Production deploy affects ${blast.length} downstream system(s)`, "Irreversible unless rollback build is retained"],
          steps: [
            step({ title: "Verify build & tests green", detail: "CI status on latest commit", agent: "DEVOPS", impact: 0, tool: "ci.read" }),
            step({ title: "Snapshot current release", detail: "Retain rollback target", agent: "DEVOPS", impact: 1, tool: "deploy.snapshot" }),
            step({ title: "Deploy to production", detail: `vercel --prod → ${target.name}`, agent: "DEVOPS", impact: 3, reversible: true, tool: "vercel.deploy", effect: { op: "setField", id: target.id, field: "status", to: "deploying" } }),
            step({ title: "Verify deployment health", detail: "HTTP 200 + key routes + checkout", agent: "VISION", impact: 0, tool: "browser.assert", effect: { op: "setField", id: target.id, field: "status", to: "healthy" }, verify: { method: "entityField", id: target.id, field: "status", equals: "healthy" } }),
          ],
        };
      },
    },
    { // DEMO 3 — lead recovery
      id: "leads",
      test: (t) => /(lead|missed call|follow.?up|crm|pipeline|qualified)/.test(t),
      build(t) {
        return {
          goal: "Recover and route qualified leads, contacting them where approved",
          mode: "company",
          systems: systemsFrom(["sys.crm", "db.prod", "wf.missed", "int.twilio", "int.gmail"]),
          risks: ["External messages will be sent to clients (requires approval)", "Twilio integration is not connected — SMS will be blocked"],
          steps: [
            step({ title: "Read new leads", detail: "Pull leads in stage=new from CRM", agent: "OPS", impact: 0, tool: "crm.read" }),
            step({ title: "Score & qualify", detail: "Rank by fit + urgency", agent: "DATA", impact: 0, tool: "data.score" }),
            step({ title: "Move qualified → contacted", detail: "Advance qualified leads a stage", agent: "OPS", impact: 2, reversible: true, tool: "crm.update", effect: { op: "moveLeads", from: "new", to: "contacted", minScore: 75 }, verify: { method: "leadsInStage", stage: "contacted" } }),
            step({ title: "Draft outreach", detail: "Personalized reply per lead", agent: "OPS", impact: 1, tool: "message.draft" }),
            step({ title: "Send outreach", detail: "Email/SMS to qualified leads", agent: "OPS", impact: 3, reversible: false, tool: "message.send", effect: { op: "sendMessage", channel: "email" }, holds: true }),
            step({ title: "Verify CRM state", detail: "Confirm stages + logged activity", agent: "VISION", impact: 0, tool: "crm.read", verify: { method: "leadsInStage", stage: "contacted" } }),
          ],
        };
      },
    },
    { // backups
      id: "backup",
      test: (t) => /(backup|snapshot|restore point)/.test(t),
      build() {
        return {
          goal: "Confirm last night's backups completed across all systems",
          mode: "company",
          systems: systemsFrom(["wf.backup", "dev.nas", "db.prod"]),
          risks: [],
          steps: [
            step({ title: "Read backup workflow run", detail: "Nightly Backup Check last result", agent: "OPS", impact: 0, tool: "workflow.read" }),
            step({ title: "Verify NAS snapshots", detail: "Confirm NAS retained snapshot", agent: "INFRA", impact: 0, tool: "nas.read" }),
            step({ title: "Verify DB point-in-time", detail: "Supabase PITR window", agent: "INFRA", impact: 0, tool: "db.read", verify: { method: "observe" } }),
          ],
        };
      },
    },
    { // DEMO 4 — workflow builder
      id: "workflow",
      test: (t) => /(build|create|make).*(workflow|automation)|when .* (then|send|notify|open)|automate/.test(t),
      build(t) {
        const twilio = /(text|sms|call)/.test(t);
        return {
          goal: "Build a new automation workflow from your description",
          mode: "build",
          systems: systemsFrom(["sys.crm", twilio ? "int.twilio" : "int.gmail"]),
          risks: [twilio ? "Twilio (SMS) is not connected — credential required before activation" : "Workflow will be able to contact customers once activated"],
          steps: [
            step({ title: "Parse trigger & steps", detail: "Extract trigger, conditions, actions", agent: "WFBUILD", impact: 0, tool: "workflow.parse" }),
            step({ title: "Identify integrations", detail: "Map actions to connectors", agent: "WFBUILD", impact: 0, tool: "workflow.map" }),
            step({ title: "Check credentials", detail: "Flag missing/inactive integrations", agent: "SECOPS", impact: 0, tool: "cred.check" }),
            step({ title: "Test with sample data", detail: "Dry-run against fixtures", agent: "VISION", impact: 1, tool: "workflow.test" }),
            step({ title: "Prepare for activation", detail: "Save as draft, hold for activation", agent: "ORCH", impact: 2, reversible: true, tool: "workflow.save", holds: true }),
          ],
        };
      },
    },
    { // monitor / watch
      id: "monitor",
      test: (t) => /(watch|monitor|alert me|notify me if|disconnect|keep an eye)/.test(t),
      build(t) {
        const ds = W.reachableDevices();
        return {
          goal: "Monitor the named systems and alert on state change",
          mode: "company",
          systems: systemsFrom(ds.slice(0, 4).map((d) => d.id)),
          risks: [],
          steps: [
            step({ title: "Register monitors", detail: "Attach watchers to devices", agent: "INFRA", impact: 1, tool: "monitor.register" }),
            step({ title: "Set alert conditions", detail: "Notify on disconnect / error", agent: "INFRA", impact: 1, tool: "alert.configure" }),
            step({ title: "Activate monitoring", detail: "Begin polling & alerting", agent: "ORCH", impact: 2, reversible: true, tool: "monitor.start" }),
          ],
        };
      },
    },
    { // research
      id: "research",
      test: (t) => /(research|investigate .*(company|topic|subject)|organize .*findings|literature|compare sources)/.test(t),
      build() {
        return {
          goal: "Investigate the subject and assemble an evidence-backed report",
          mode: "research",
          systems: systemsFrom(["dev.desk01", "dev.desk02"]),
          risks: ["Sources may conflict — findings include a dissenting view"],
          steps: [
            step({ title: "Build research plan", detail: "Decompose into sub-questions", agent: "RECON", impact: 0, tool: "research.plan" }),
            step({ title: "Collect sources", detail: "Fan out across machines", agent: "RECON", impact: 0, tool: "web.search" }),
            step({ title: "Extract claims & evidence", detail: "Structure findings", agent: "DATA", impact: 0, tool: "data.extract" }),
            step({ title: "Red-team conclusions", detail: "Challenge and find contradictions", agent: "VISION", impact: 0, tool: "review.redteam" }),
            step({ title: "Assemble cited report", detail: "Export with citations", agent: "RECON", impact: 1, tool: "doc.write" }),
          ],
        };
      },
    },
    { // onehand / accessibility
      id: "onehand",
      test: (t) => /(one.?hand|accessible|easier to control|comfortable reach|reduce .*(key|combination)|adaptive|profile for)/.test(t),
      build(t) {
        return {
          goal: "Generate an accessible one-handed control layout for the current app",
          mode: "onehand",
          systems: systemsFrom(["dev.desk01"]),
          risks: [],
          steps: [
            step({ title: "Assess capability", detail: "Confirm comfortable movements & inputs", agent: "ACCESS", impact: 0, tool: "onehand.assess" }),
            step({ title: "Generate layout", detail: "Radial menu + sticky modifiers + reach zones", agent: "ACCESS", impact: 0, tool: "onehand.generate" }),
            step({ title: "Apply profile", detail: "Activate PHANTOM HAND controls", agent: "ACCESS", impact: 1, tool: "onehand.activate", effect: { op: "activateOnehand" }, verify: { method: "setting", key: "onehand" } }),
          ],
        };
      },
    },
  ];

  function fallback(t) {
    const ent = W.matchEntity(t);
    return {
      goal: `Inspect and report on: “${t.trim()}”`,
      mode: "build",
      systems: ent ? [ent.id] : [],
      risks: [],
      steps: [
        step({ title: "Interpret request", detail: "Classify intent & scope", agent: "ORCH", impact: 0 }),
        step({ title: "Gather current state", detail: ent ? `Read state of ${ent.name}` : "Read relevant systems", agent: "INFRA", impact: 0 }),
        step({ title: "Report findings", detail: "Summarize with evidence", agent: "ORCH", impact: 0 }),
      ],
    };
  }

  function plan(commandText) {
    stepSeq = 0;
    const t = (commandText || "").toLowerCase();
    const tpl = TEMPLATES.find((x) => x.test(t)) || { id: "generic", build: () => fallback(commandText) };
    const base = tpl.build(t);

    // wire sequential deps where unset (each step after the first depends on the previous)
    base.steps.forEach((s, i) => { if ((!s.deps || !s.deps.length || s.deps[0] === "s?") && i > 0) s.deps = [base.steps[i - 1].id]; else if (!s.deps) s.deps = []; });

    const maxImpact = base.steps.reduce((m, s) => Math.max(m, s.impact), 0);
    const approvalRequired = base.steps.some((s) => s.impact >= 3 || (!s.reversible && s.impact >= 2) || s.holds);
    const irreversible = base.steps.filter((s) => !s.reversible).length;

    const p = {
      id: G.id(), ts: Date.now(), command: commandText, intent: tpl.id,
      goal: base.goal, mode: base.mode, systems: base.systems, steps: base.steps,
      risks: base.risks || [],
      maxImpact, approvalRequired, irreversibleCount: irreversible,
      resource: {
        estSeconds: base.steps.length * 6 + (approvalRequired ? 20 : 0),
        estTokens: base.steps.length * 4200,
        estCost: (base.steps.length * 4200 / 1000) * 0.0125,
      },
      verificationSummary: `${base.steps.filter((s) => s.verify && s.verify.method !== "observe").length} step(s) independently verified against real state.`,
      status: "draft",
    };
    G.store.put("plans", p);
    G.store.audit({ type: "plan.created", actor: "planner", plan: p.id, summary: `Plan for “${commandText}” — ${p.steps.length} steps, max impact L${maxImpact}${approvalRequired ? ", approval required" : ""}.` });
    return p;
  }

  G.planner = { plan, IMPACT };
})();
