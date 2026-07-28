import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, isAdminContext, rateLimitAdminMutator } from "@/lib/admin-auth";
import { can, type SchedulingPermission } from "@/lib/scheduling/permissions";
import { writeAuditEvent } from "@/lib/audit";
import { isSupabaseConfigured } from "@/lib/supabase";
import { requireSupabase, links, periodMonth } from "@/lib/lifecycle/core";
import { listAssessments, markAssessmentReviewed } from "@/lib/lifecycle/assessments";
import { listQuestionnaires, waiveQuestionnaire } from "@/lib/lifecycle/questionnaires";
import {
  addProposalComment,
  createProposal,
  getProposal,
  listProposalEvents,
  listProposals,
  markProposalSent,
  replaceOptions,
  updateProposalContent,
  withdrawProposal,
} from "@/lib/lifecycle/proposals";
import {
  countersignContract,
  createContract,
  getContract,
  isFullyExecuted,
  listContracts,
  markContractSent,
  voidContract,
} from "@/lib/lifecycle/contracts";
import {
  createInvoice,
  getInvoice,
  listInvoices,
  recordManualPayment,
  voidInvoice,
} from "@/lib/lifecycle/billing";
import {
  addMilestone,
  createProject,
  createTask,
  getProjectWithDetail,
  listProjects,
  updateMilestone,
  updateProject,
  updateTask,
} from "@/lib/lifecycle/projects";
import {
  addMessage,
  createApproval,
  listMessages,
  listRequests,
  resolveRequest,
  updateRequest,
} from "@/lib/lifecycle/workspace";
import {
  createTrainingItem,
  assignTraining,
  ensureDefaultTraining,
  getTrainingItem,
  listTrainingItems,
  updateTrainingItem,
} from "@/lib/lifecycle/training";
import {
  getSlaPolicies,
  getTicket,
  listTickets,
  recordFirstResponseIfNeeded,
  resolveTicket,
  updateSlaPolicy,
  updateTicket,
} from "@/lib/lifecycle/support";
import {
  createDraftReport,
  listReports,
  publishReport,
  updateReport,
  upsertMetric,
} from "@/lib/lifecycle/reporting";
import {
  createExpansionItem,
  createRenewal,
  deleteExpansionItem,
  listExpansionItems,
  listRenewals,
  suggestExpansionOpportunities,
  updateExpansionItem,
  updateRenewal,
} from "@/lib/lifecycle/growth";
import {
  getAutomationSettings,
  listAutomationRuns,
  retryFailedRun,
  updateAutomationSetting,
} from "@/lib/lifecycle/automations";
import { listClientActivity, listRecentActivity } from "@/lib/lifecycle/activity";
import {
  getOpportunity,
  invoiceContact,
  listOpportunities,
  onContractSent,
  onInvoicePaid,
  onMilestoneStatusChanged,
  onProposalSent,
  onReportPublished,
  onTicketResolved,
  onTicketUpdated,
  onTrainingAssigned,
  updateOpportunity,
} from "@/lib/lifecycle/orchestrate";
import { periodLabel } from "@/lib/lifecycle/core";
import { getClientById, getClients } from "@/lib/store";
import type { Contract, Milestone } from "@/lib/lifecycle/types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Permission maps (mirrors the /api/admin/scheduling pattern)
// ---------------------------------------------------------------------------

const SECTION_PERMISSION: Record<string, SchedulingPermission> = {
  overview: "view_analytics",
  pipeline: "manage_leads",
  assessments: "manage_leads",
  questionnaires: "manage_leads",
  proposals: "manage_proposals",
  proposal_detail: "manage_proposals",
  contracts: "manage_proposals",
  billing: "manage_billing",
  clients: "manage_clients",
  client_detail: "manage_clients",
  projects: "manage_projects",
  project_detail: "manage_projects",
  requests: "manage_projects",
  request_thread: "manage_projects",
  tickets: "manage_support",
  ticket_thread: "manage_support",
  training: "manage_training",
  reports: "manage_clients",
  growth: "manage_clients",
  automations: "manage_automations",
  activity: "view_audit",
};

const ACTION_PERMISSION: Record<string, SchedulingPermission> = {
  update_opportunity: "manage_leads",
  mark_assessment_reviewed: "manage_leads",
  waive_questionnaire: "manage_leads",
  create_proposal: "manage_proposals",
  update_proposal: "manage_proposals",
  replace_options: "manage_proposals",
  send_proposal: "manage_proposals",
  withdraw_proposal: "manage_proposals",
  reply_proposal_comment: "manage_proposals",
  create_contract: "manage_proposals",
  send_contract: "manage_proposals",
  countersign_contract: "manage_proposals",
  void_contract: "manage_proposals",
  create_invoice: "manage_billing",
  record_payment: "manage_billing",
  void_invoice: "manage_billing",
  update_sla: "manage_support",
  create_project: "manage_projects",
  update_project: "manage_projects",
  update_milestone: "manage_milestone" as SchedulingPermission,
  add_milestone: "manage_projects",
  create_task: "manage_projects",
  update_task: "manage_projects",
  create_approval: "manage_projects",
  update_request: "manage_projects",
  resolve_request: "manage_projects",
  message: "manage_projects",
  update_ticket: "manage_support",
  reply_ticket: "manage_support",
  resolve_ticket: "manage_support",
  seed_training: "manage_training",
  create_training: "manage_training",
  update_training: "manage_training",
  assign_training: "manage_training",
  upsert_metric: "manage_clients",
  create_report: "manage_clients",
  update_report: "manage_clients",
  publish_report: "manage_clients",
  create_renewal: "manage_clients",
  update_renewal: "manage_clients",
  create_expansion: "manage_clients",
  update_expansion: "manage_clients",
  delete_expansion: "manage_clients",
  suggest_expansion: "manage_clients",
  update_automation: "manage_automations",
  retry_automation_run: "manage_automations",
};
// Fix the one deliberate placeholder above (milestones ride manage_projects).
ACTION_PERMISSION.update_milestone = "manage_projects";

function forbidden() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
function unavailable() {
  return NextResponse.json({ error: "Supabase required" }, { status: 503 });
}

async function clientContactFor(clientId: string | null, leadId: string | null) {
  const sb = requireSupabase();
  if (clientId) {
    const client = await getClientById(clientId);
    if (client) return { name: client.name, email: client.email, company: client.company };
  }
  if (leadId) {
    const { data } = await sb
      .from("leads")
      .select("name, email, business_name")
      .eq("id", leadId)
      .maybeSingle();
    if (data?.email) {
      return {
        name: String(data.name ?? ""),
        email: String(data.email),
        company: String(data.business_name ?? ""),
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// GET — sections
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  // Client OS lifecycle — gate on manage_clients (consistent with the sibling
  // proposals/industries admin routes) so RBAC + forced-MFA apply. (audit L2)
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;
  if (!isSupabaseConfigured()) return unavailable();

  const url = new URL(request.url);
  const section = url.searchParams.get("section") ?? "overview";
  const id = url.searchParams.get("id");
  const permission = SECTION_PERMISSION[section];
  if (!permission || !can(permission, ctx.role)) return forbidden();

  const sb = requireSupabase();

  try {
    switch (section) {
      case "overview": {
        const [opportunities, tickets, invoices, projects] = await Promise.all([
          listOpportunities({ limit: 200 }),
          listTickets({ limit: 200 }),
          listInvoices({ limit: 200 }),
          listProjects({ limit: 200 }),
        ]);
        return NextResponse.json({
          opportunities: opportunities.slice(0, 25),
          counts: {
            activeOpportunities: opportunities.filter(
              (o) => !["won", "lost", "dormant"].includes(o.stage),
            ).length,
            openTickets: tickets.filter((t) => !["resolved", "closed"].includes(t.status)).length,
            openInvoices: invoices.filter((i) => ["open", "processing"].includes(i.status)).length,
            activeProjects: projects.filter(
              (p) => !["completed", "archived"].includes(p.status),
            ).length,
          },
        });
      }
      case "pipeline": {
        const [opportunities, assessments, questionnaires, proposals, contracts] =
          await Promise.all([
            listOpportunities({ limit: 200 }),
            listAssessments({ limit: 100 }),
            listQuestionnaires({ limit: 100 }),
            listProposals({ limit: 100 }),
            listContracts({ limit: 100 }),
          ]);
        // Lead names for the board.
        const leadIds = [...new Set(opportunities.map((o) => o.lead_id).filter(Boolean))];
        const leads: Record<string, { name: string; email: string; business_name: string }> = {};
        if (leadIds.length > 0) {
          const { data } = await sb
            .from("leads")
            .select("id, name, email, business_name")
            .in("id", leadIds as string[]);
          for (const row of data ?? []) {
            leads[String(row.id)] = {
              name: String(row.name ?? ""),
              email: String(row.email ?? ""),
              business_name: String(row.business_name ?? ""),
            };
          }
        }
        return NextResponse.json({ opportunities, assessments, questionnaires, proposals, contracts, leads });
      }
      case "assessments":
        return NextResponse.json({ assessments: await listAssessments({ limit: 200 }) });
      case "questionnaires":
        return NextResponse.json({ questionnaires: await listQuestionnaires({ limit: 200 }) });
      case "proposals":
        return NextResponse.json({ proposals: await listProposals({ limit: 200 }) });
      case "proposal_detail": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const loaded = await getProposal(id);
        if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const events = await listProposalEvents(id, 100);
        return NextResponse.json({ ...loaded, events });
      }
      case "contracts": {
        const contracts = await listContracts({ limit: 200 });
        return NextResponse.json({ contracts });
      }
      case "billing": {
        const [invoices, slas] = await Promise.all([
          listInvoices({ limit: 200 }),
          getSlaPolicies(),
        ]);
        return NextResponse.json({ invoices, slaPolicies: slas });
      }
      case "clients": {
        const clients = await getClients();
        return NextResponse.json({
          clients: clients.map((c) => ({
            id: c.id,
            name: c.name,
            company: c.company,
            email: c.email,
            plan: c.plan,
          })),
        });
      }
      case "client_detail": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const client = await getClientById(id);
        if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
        // The unified record: full history from first touch to today.
        const [
          opportunities,
          proposals,
          contracts,
          invoices,
          projects,
          requests,
          tickets,
          reports,
          renewals,
          expansion,
          activity,
        ] = await Promise.all([
          listOpportunities({ clientId: id, limit: 50 }),
          listProposals({ clientId: id, limit: 50 }),
          listContracts({ clientId: id, limit: 50 }),
          listInvoices({ clientId: id, limit: 100 }),
          listProjects({ limit: 300 }).then((all) => all.filter((p) => p.client_id === id)),
          listRequests({ limit: 300 }).then((all) => all.filter((r) => r.client_id === id)),
          listTickets({ limit: 300 }).then((all) => all.filter((t) => t.client_id === id)),
          listReports(id, { limit: 24 }),
          listRenewals({ limit: 200 }).then((all) => all.filter((r) => r.client_id === id)),
          listExpansionItems(id, {}),
          listClientActivity(id, { visibleOnly: false, limit: 100 }),
        ]);
        const lead = opportunities[0]?.lead_id
          ? (
              await sb
                .from("leads")
                .select("*")
                .eq("id", opportunities[0].lead_id)
                .maybeSingle()
            ).data
          : null;
        return NextResponse.json({
          client: { id: client.id, name: client.name, company: client.company, email: client.email },
          lead,
          opportunities,
          proposals,
          contracts,
          invoices,
          projects,
          requests,
          tickets,
          reports,
          renewals,
          expansion,
          activity,
        });
      }
      case "projects":
        return NextResponse.json({ projects: await listProjects({ limit: 200 }) });
      case "project_detail": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const detail = await getProjectWithDetail(id);
        if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
        return NextResponse.json(detail);
      }
      case "requests":
        return NextResponse.json({ requests: await listRequests({ limit: 200 }) });
      case "request_thread": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const messages = await listMessages(
          { requestId: id },
          { includeInternal: true, limit: 200 },
        );
        return NextResponse.json({ messages });
      }
      case "tickets":
        return NextResponse.json({
          tickets: await listTickets({ limit: 200 }),
          slaPolicies: await getSlaPolicies(),
        });
      case "ticket_thread": {
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const messages = await listMessages(
          { ticketId: id },
          { includeInternal: true, limit: 200 },
        );
        return NextResponse.json({ messages });
      }
      case "training":
        return NextResponse.json({
          items: await listTrainingItems({ publishedOnly: false, limit: 200 }),
        });
      case "reports": {
        const clientId = url.searchParams.get("clientId");
        return NextResponse.json({
          reports: await listReports(clientId ?? undefined, { limit: 100 }),
        });
      }
      case "growth": {
        const [renewals, clients] = await Promise.all([
          listRenewals({ limit: 200 }),
          getClients(),
        ]);
        const clientId = url.searchParams.get("clientId");
        return NextResponse.json({
          renewals,
          expansion: clientId ? await listExpansionItems(clientId, {}) : [],
          clients: clients.map((c) => ({ id: c.id, company: c.company })),
        });
      }
      case "automations": {
        const [settings, runs] = await Promise.all([
          getAutomationSettings(),
          listAutomationRuns({ limit: 100 }),
        ]);
        return NextResponse.json({ settings, runs });
      }
      case "activity":
        return NextResponse.json({ activity: await listRecentActivity(200) });
      default:
        return NextResponse.json({ error: "Unknown section" }, { status: 400 });
    }
  } catch (error) {
    console.error(`[admin/lifecycle] GET ${section} failed`, error);
    return NextResponse.json({ error: "Failed to load section." }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST — actions
// ---------------------------------------------------------------------------

const actionSchema = z
  .object({ action: z.string().max(60) })
  .passthrough();

export async function POST(request: Request) {
  const ctx = await requireAdmin("manage_clients");
  if (!isAdminContext(ctx)) return ctx;
  if (!isSupabaseConfigured()) return unavailable();
  const limited = await rateLimitAdminMutator(request, ctx.admin.id);
  if (limited) return limited;

  let raw: Record<string, unknown>;
  try {
    raw = actionSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const action = String(raw.action);
  const permission = ACTION_PERMISSION[action];
  if (!permission || !can(permission, ctx.role)) return forbidden();

  const adminName = ctx.admin.name || ctx.admin.email;

  await writeAuditEvent({
    actorType: "admin",
    actorId: ctx.admin.id,
    actorEmail: ctx.admin.email,
    action: `lifecycle.${action}`,
    entityType: "lifecycle",
    entityId: typeof raw.id === "string" ? raw.id : undefined,
    metadata: { action },
  });

  const str = (key: string, max = 10_000): string =>
    typeof raw[key] === "string" ? (raw[key] as string).trim().slice(0, max) : "";
  const num = (key: string): number | undefined =>
    typeof raw[key] === "number" && Number.isFinite(raw[key]) ? (raw[key] as number) : undefined;
  const bool = (key: string): boolean | undefined =>
    typeof raw[key] === "boolean" ? (raw[key] as boolean) : undefined;

  try {
    switch (action) {
      // ---- pipeline -----------------------------------------------------
      case "update_opportunity": {
        const updated = await updateOpportunity(str("id"), {
          stage: (str("stage") || undefined) as never,
          ownerAdminId: str("ownerAdminId") || undefined,
          nextAction: str("nextAction") || undefined,
          nextActionDue: str("nextActionDue") || undefined,
          nextActionParty: (str("nextActionParty") || undefined) as never,
          consultationNotes: raw.consultationNotes !== undefined ? str("consultationNotes") : undefined,
          valueCents: num("valueCents") ?? undefined,
          lostReason: str("lostReason") || undefined,
        });
        return NextResponse.json({ ok: true, opportunity: updated });
      }
      case "mark_assessment_reviewed":
        return NextResponse.json({
          ok: true,
          assessment: await markAssessmentReviewed(str("id"), adminName),
        });
      case "waive_questionnaire":
        return NextResponse.json({ ok: true, questionnaire: await waiveQuestionnaire(str("id")) });

      // ---- proposals ----------------------------------------------------
      case "create_proposal": {
        const opportunityId = str("opportunityId");
        const opportunity = opportunityId ? await getOpportunity(opportunityId) : null;
        const contact = await clientContactFor(
          opportunity?.client_id ?? null,
          opportunity?.lead_id ?? null,
        );
        const created = await createProposal({
          opportunityId: opportunityId || undefined,
          leadId: opportunity?.lead_id ?? undefined,
          clientId: opportunity?.client_id ?? undefined,
          templateKey: str("templateKey") || "business_systems",
          businessName: str("businessName") || contact?.company || opportunity?.name || "your business",
          challenges: Array.isArray(raw.challenges) ? (raw.challenges as string[]).slice(0, 10) : [],
          outcomes: Array.isArray(raw.outcomes) ? (raw.outcomes as string[]).slice(0, 10) : [],
          totalCents: num("totalCents") ?? 0,
          depositCents: num("depositCents") ?? 0,
          expiresInDays: num("expiresInDays"),
          createdBy: adminName,
        });
        return NextResponse.json({ ok: true, ...created });
      }
      case "update_proposal": {
        const updated = await updateProposalContent(str("id"), {
          title: str("title") || undefined,
          sections: Array.isArray(raw.sections) ? (raw.sections as never) : undefined,
          totalCents: num("totalCents"),
          depositCents: num("depositCents"),
          expiresAt: str("expiresAt") || undefined,
        });
        return NextResponse.json({ ok: true, proposal: updated });
      }
      case "replace_options": {
        const options = await replaceOptions(
          str("id"),
          Array.isArray(raw.options) ? (raw.options as never[]) : [],
        );
        return NextResponse.json({ ok: true, options });
      }
      case "send_proposal": {
        const loaded = await getProposal(str("id"));
        if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const contact = await clientContactFor(loaded.proposal.client_id, loaded.proposal.lead_id);
        if (!contact) {
          return NextResponse.json(
            { error: "No client or lead contact is linked to this proposal." },
            { status: 400 },
          );
        }
        const sent = await markProposalSent(loaded.proposal.id);
        await onProposalSent(sent, contact);
        return NextResponse.json({ ok: true, proposal: sent, sentTo: contact.email });
      }
      case "withdraw_proposal":
        return NextResponse.json({ ok: true, proposal: await withdrawProposal(str("id")) });
      case "reply_proposal_comment": {
        const comment = await addProposalComment(str("id"), {
          authorType: "admin",
          authorName: adminName,
          sectionKey: str("sectionKey") || undefined,
          body: str("body"),
        });
        return NextResponse.json({ ok: true, comment });
      }

      // ---- contracts ----------------------------------------------------
      case "create_contract": {
        const proposalId = str("proposalId");
        const loaded = proposalId ? await getProposal(proposalId) : null;
        const opportunity = loaded?.proposal.opportunity_id
          ? await getOpportunity(loaded.proposal.opportunity_id)
          : null;
        const contact = await clientContactFor(
          loaded?.proposal.client_id ?? null,
          loaded?.proposal.lead_id ?? null,
        );
        if (!contact) {
          return NextResponse.json(
            { error: "Link the contract to a proposal with a client or lead first." },
            { status: 400 },
          );
        }
        const totals = loaded
          ? { total: loaded.proposal.total_cents, deposit: loaded.proposal.deposit_cents }
          : { total: 0, deposit: 0 };
        const { contract, signatures } = await createContract({
          kind: (str("kind") || "project") as Contract["kind"],
          opportunityId: opportunity?.id,
          proposalId: proposalId || undefined,
          clientId: loaded?.proposal.client_id ?? undefined,
          leadId: loaded?.proposal.lead_id ?? undefined,
          vars: {
            client_business: contact.company || contact.name,
            client_name: contact.name,
            effective_date: new Date().toISOString().slice(0, 10),
            total_investment: `$${(totals.total / 100).toLocaleString("en-US")}`,
            deposit: `$${(totals.deposit / 100).toLocaleString("en-US")}`,
            scope_summary: loaded?.proposal.title ?? "the services described in the accepted proposal",
            payment_schedule: (loaded?.proposal.payment_schedule ?? [])
              .map((p) => `${p.label}: $${(p.amount_cents / 100).toLocaleString("en-US")} (${p.due})`)
              .join("; "),
            term_length: str("termLength") || "the project duration",
          },
          signerName: contact.name,
          signerEmail: contact.email,
          createdBy: adminName,
        });
        return NextResponse.json({ ok: true, contract, signatures });
      }
      case "send_contract": {
        const loaded = await getContract(str("id"));
        if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const signer = loaded.signatures.find((s) => s.signer_type === "client");
        if (!signer?.signer_email) {
          return NextResponse.json({ error: "No signer email on file." }, { status: 400 });
        }
        const sent = await markContractSent(loaded.contract.id);
        await onContractSent(sent, { email: signer.signer_email, name: signer.signer_name });
        return NextResponse.json({ ok: true, contract: sent, sentTo: signer.signer_email });
      }
      case "countersign_contract": {
        const result = await countersignContract(str("id"), {
          adminId: ctx.admin.id,
          adminName,
          adminEmail: ctx.admin.email,
          signedName: str("signedName") || adminName,
          ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "internal",
          userAgent: request.headers.get("user-agent") ?? "",
        });
        if (isFullyExecuted(result.contract)) {
          const signer = result.signatures.find((s) => s.signer_type === "client");
          if (signer?.signer_email) {
            const { onContractExecuted } = await import("@/lib/lifecycle/orchestrate");
            await onContractExecuted(result.contract, {
              email: signer.signer_email,
              name: signer.signer_name,
            }).catch((e) => console.error("[admin/lifecycle] execution hook failed", e));
          }
        }
        return NextResponse.json({ ok: true, ...result });
      }
      case "void_contract":
        return NextResponse.json({
          ok: true,
          contract: await voidContract(str("id"), str("reason") || "Voided by administrator"),
        });

      // ---- billing --------------------------------------------------------
      case "create_invoice": {
        const invoice = await createInvoice({
          clientId: str("clientId") || undefined,
          opportunityId: str("opportunityId") || undefined,
          contractId: str("contractId") || undefined,
          projectId: str("projectId") || undefined,
          kind: (str("kind") || "other") as never,
          description: str("description"),
          lineItems: Array.isArray(raw.lineItems) ? (raw.lineItems as never[]) : [],
          taxCents: num("taxCents"),
          dueAt: str("dueAt") || undefined,
          createdBy: adminName,
        });
        return NextResponse.json({ ok: true, invoice, payUrl: links.pay(invoice.token) });
      }
      case "record_payment": {
        const invoice = await getInvoice(str("id"));
        if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const result = await recordManualPayment(invoice.id, {
          provider: (str("provider") || "manual") as never,
          providerRef: str("providerRef") || undefined,
          amountCents: num("amountCents") ?? 0,
          methodSummary: str("methodSummary") || undefined,
          recordedBy: adminName,
        });
        // A manually recorded deposit still activates the portal + project.
        if (result.invoice.status === "paid") {
          const payer = await invoiceContact(result.invoice);
          if (payer) {
            await onInvoicePaid(result.invoice, payer).catch((e) =>
              console.error("[admin/lifecycle] paid hook failed", e),
            );
          }
        }
        return NextResponse.json({ ok: true, ...result });
      }
      case "void_invoice":
        return NextResponse.json({ ok: true, invoice: await voidInvoice(str("id")) });
      case "update_sla": {
        const policy = await updateSlaPolicy(str("priority") as never, {
          targetResponseMinutes: num("targetResponseMinutes"),
          targetResolutionMinutes: num("targetResolutionMinutes"),
          enabled: bool("enabled"),
        });
        return NextResponse.json({ ok: true, policy });
      }

      // ---- projects -------------------------------------------------------
      case "create_project": {
        const created = await createProject({
          clientId: str("clientId"),
          opportunityId: str("opportunityId") || undefined,
          contractId: str("contractId") || undefined,
          name: str("name"),
          summary: str("summary"),
          managerAdminId: ctx.admin.id,
          startDate: str("startDate") || undefined,
          targetLaunchDate: str("targetLaunchDate") || undefined,
        });
        return NextResponse.json({ ok: true, ...created });
      }
      case "update_project": {
        const project = await updateProject(str("id"), {
          name: str("name") || undefined,
          summary: raw.summary !== undefined ? str("summary") : undefined,
          status: (str("status") || undefined) as never,
          health: (str("health") || undefined) as never,
          targetLaunchDate: str("targetLaunchDate") || undefined,
          actualLaunchDate: str("actualLaunchDate") || undefined,
        });
        return NextResponse.json({ ok: true, project });
      }
      case "update_milestone": {
        const previous = str("previousStatus");
        const { milestone, project } = await updateMilestone(str("id"), {
          status: (str("status") || undefined) as Milestone["status"] | undefined,
          name: str("name") || undefined,
          description: raw.description !== undefined ? str("description") : undefined,
          targetDate: str("targetDate") || undefined,
          startsOn: str("startsOn") || undefined,
          notes: raw.notes !== undefined ? str("notes") : undefined,
          clientAction: raw.clientAction !== undefined ? str("clientAction") : undefined,
          approvalRequired: bool("approvalRequired"),
        });
        // Client-facing notifications on meaningful transitions.
        if (str("status") && project) {
          const client = project.client_id ? await getClientById(project.client_id) : null;
          if (client) {
            await onMilestoneStatusChanged({
              milestone,
              projectName: project.name,
              previousStatus: previous || "unknown",
              client: { id: client.id, email: client.email, name: client.name },
              note: str("note") || undefined,
            }).catch((e) => console.error("[admin/lifecycle] milestone hook failed", e));
          }
        }
        return NextResponse.json({ ok: true, milestone, project });
      }
      case "add_milestone": {
        const milestone = await addMilestone(str("projectId"), {
          name: str("name"),
          description: str("description"),
          ownerParty: (str("ownerParty") || "rsg") as never,
          targetDate: str("targetDate") || undefined,
          approvalRequired: bool("approvalRequired") ?? false,
        } as never);
        return NextResponse.json({ ok: true, milestone });
      }
      case "create_task": {
        const task = await createTask(str("projectId"), {
          milestoneId: str("milestoneId") || undefined,
          title: str("title"),
          description: str("description"),
          kind: (str("kind") || "general") as never,
          assigneeParty: (str("assigneeParty") || "client") as never,
          dueAt: str("dueAt") || undefined,
        });
        return NextResponse.json({ ok: true, task });
      }
      case "update_task": {
        const task = await updateTask(str("id"), {
          status: (str("status") || undefined) as never,
          title: str("title") || undefined,
          dueAt: str("dueAt") || undefined,
        });
        return NextResponse.json({ ok: true, task });
      }
      case "create_approval": {
        const approval = await createApproval({
          clientId: str("clientId"),
          projectId: str("projectId") || undefined,
          milestoneId: str("milestoneId") || undefined,
          title: str("title"),
          description: str("description"),
          requestedBy: adminName,
          dueAt: str("dueAt") || undefined,
        });
        return NextResponse.json({ ok: true, approval });
      }

      // ---- requests & messages ---------------------------------------------
      case "update_request": {
        const updated = await updateRequest(str("id"), {
          status: (str("status") || undefined) as never,
          priority: (str("priority") || undefined) as never,
          assignedAdminId: str("assignedAdminId") || undefined,
          dueAt: str("dueAt") || undefined,
          changeOrderRequired: bool("changeOrderRequired"),
        });
        return NextResponse.json({ ok: true, request: updated });
      }
      case "resolve_request":
        return NextResponse.json({
          ok: true,
          request: await resolveRequest(str("id"), { resolution: str("resolution") }),
        });
      case "message": {
        const message = await addMessage({
          clientId: str("clientId"),
          requestId: str("requestId") || undefined,
          ticketId: str("ticketId") || undefined,
          projectId: str("projectId") || undefined,
          authorType: "admin",
          authorAdminId: ctx.admin.id,
          authorName: adminName,
          body: str("body"),
          internal: bool("internal") ?? false,
        });
        // Admin reply to a ticket → notify client + first-response clock.
        if (str("ticketId") && !(bool("internal") ?? false)) {
          const ticket = await getTicket(str("ticketId"));
          if (ticket) {
            await recordFirstResponseIfNeeded(ticket.id);
            const client = await getClientById(ticket.client_id);
            if (client) {
              await onTicketUpdated(
                ticket,
                { id: client.id, name: client.name, email: client.email },
                { qualifier: message.id, note: "Our team replied to your ticket." },
              ).catch(() => {});
            }
          }
        }
        return NextResponse.json({ ok: true, message });
      }

      // ---- tickets ---------------------------------------------------------
      case "update_ticket": {
        const ticket = await updateTicket(str("id"), {
          status: (str("status") || undefined) as never,
          priority: (str("priority") || undefined) as never,
          assignedAdminId: str("assignedAdminId") || undefined,
        });
        return NextResponse.json({ ok: true, ticket });
      }
      case "resolve_ticket": {
        const ticket = await resolveTicket(str("id"), {
          resolutionNotes: str("resolutionNotes"),
        });
        const client = await getClientById(ticket.client_id);
        if (client) {
          await onTicketResolved(ticket, {
            id: client.id,
            name: client.name,
            email: client.email,
          }).catch(() => {});
        }
        return NextResponse.json({ ok: true, ticket });
      }

      // ---- training ----------------------------------------------------------
      case "seed_training":
        return NextResponse.json({ ok: true, inserted: await ensureDefaultTraining() });
      case "create_training": {
        const item = await createTrainingItem({
          title: str("title"),
          description: str("description"),
          kind: (str("kind") || "guide") as never,
          systemTag: str("systemTag"),
          topic: str("topic"),
          difficulty: (str("difficulty") || "beginner") as never,
          url: str("url") || undefined,
          body: str("body", 50_000),
          durationMinutes: num("durationMinutes"),
        } as never);
        return NextResponse.json({ ok: true, item });
      }
      case "update_training": {
        const item = await updateTrainingItem(str("id"), {
          title: str("title") || undefined,
          description: raw.description !== undefined ? str("description") : undefined,
          body: raw.body !== undefined ? str("body", 50_000) : undefined,
          published: bool("published"),
        } as never);
        return NextResponse.json({ ok: true, item });
      }
      case "assign_training": {
        const assignment = await assignTraining({
          trainingItemId: str("trainingItemId"),
          clientId: str("clientId"),
          clientUserId: str("clientUserId") || undefined,
          required: bool("required") ?? false,
          dueAt: str("dueAt") || undefined,
          assignedBy: adminName,
        });
        const [item, client] = await Promise.all([
          getTrainingItem(str("trainingItemId")),
          getClientById(str("clientId")),
        ]);
        if (item && client) {
          await onTrainingAssigned(assignment, item, {
            id: client.id,
            name: client.name,
            email: client.email,
          }).catch(() => {});
        }
        return NextResponse.json({ ok: true, assignment });
      }

      // ---- reporting -----------------------------------------------------------
      case "upsert_metric": {
        const metric = await upsertMetric({
          clientId: str("clientId"),
          periodMonth: str("periodMonth") || periodMonth(),
          key: str("key"),
          label: str("label") || undefined,
          value: num("value") ?? 0,
          unit: str("unit") || undefined,
          goal: num("goal"),
          baseline: num("baseline"),
          source: (str("source") || "manual") as never,
          createdBy: adminName,
        });
        return NextResponse.json({ ok: true, metric });
      }
      case "create_report": {
        const report = await createDraftReport({
          clientId: str("clientId"),
          periodMonth: str("periodMonth") || periodMonth(),
          title: str("title") || undefined,
          createdBy: adminName,
        });
        return NextResponse.json({ ok: true, report });
      }
      case "update_report": {
        const report = await updateReport(str("id"), {
          title: str("title") || undefined,
          executiveSummary:
            raw.executiveSummary !== undefined ? str("executiveSummary", 20_000) : undefined,
          keyWins: Array.isArray(raw.keyWins) ? (raw.keyWins as string[]) : undefined,
          risks: Array.isArray(raw.risks) ? (raw.risks as string[]) : undefined,
          recommendations: Array.isArray(raw.recommendations)
            ? (raw.recommendations as string[])
            : undefined,
          nextPriorities: Array.isArray(raw.nextPriorities)
            ? (raw.nextPriorities as string[])
            : undefined,
          expansionNotes:
            raw.expansionNotes !== undefined ? str("expansionNotes", 5000) : undefined,
        });
        return NextResponse.json({ ok: true, report });
      }
      case "publish_report": {
        const report = await publishReport(str("id"));
        const client = await getClientById(report.client_id);
        if (client) {
          await onReportPublished(
            report,
            { id: client.id, name: client.name, email: client.email },
            periodLabel(report.period_month),
          ).catch(() => {});
        }
        return NextResponse.json({ ok: true, report });
      }

      // ---- growth -----------------------------------------------------------
      case "create_renewal": {
        const renewal = await createRenewal({
          clientId: str("clientId"),
          contractId: str("contractId") || undefined,
          kind: (str("kind") || "contract") as never,
          name: str("name"),
          renewsOn: str("renewsOn"),
          term: str("term") || undefined,
          valueCents: num("valueCents"),
        });
        return NextResponse.json({ ok: true, renewal });
      }
      case "update_renewal": {
        const renewal = await updateRenewal(str("id"), {
          status: (str("status") || undefined) as never,
          renewsOn: str("renewsOn") || undefined,
          notes: raw.notes !== undefined ? str("notes") : undefined,
        } as never);
        return NextResponse.json({ ok: true, renewal });
      }
      case "create_expansion": {
        const item = await createExpansionItem({
          clientId: str("clientId"),
          title: str("title"),
          problem: str("problem"),
          solution: str("solution"),
          expectedOutcome: str("expectedOutcome"),
          priority: (str("priority") || "medium") as never,
          timing: str("timing"),
          dependencies: str("dependencies"),
          investmentRange: str("investmentRange"),
          status: (str("status") || "recommended") as never,
          source: (str("source") || "manual") as never,
        } as never);
        return NextResponse.json({ ok: true, item });
      }
      case "update_expansion": {
        const item = await updateExpansionItem(str("id"), {
          status: (str("status") || undefined) as never,
          priority: (str("priority") || undefined) as never,
          title: str("title") || undefined,
          problem: raw.problem !== undefined ? str("problem") : undefined,
          solution: raw.solution !== undefined ? str("solution") : undefined,
          expectedOutcome:
            raw.expectedOutcome !== undefined ? str("expectedOutcome") : undefined,
          timing: raw.timing !== undefined ? str("timing") : undefined,
          investmentRange:
            raw.investmentRange !== undefined ? str("investmentRange") : undefined,
        });
        return NextResponse.json({ ok: true, item });
      }
      case "delete_expansion":
        await deleteExpansionItem(str("id"));
        return NextResponse.json({ ok: true });
      case "suggest_expansion":
        return NextResponse.json({
          ok: true,
          suggestions: await suggestExpansionOpportunities(str("clientId")),
        });

      // ---- automations ------------------------------------------------------
      case "update_automation": {
        const setting = await updateAutomationSetting(
          str("id"),
          {
            enabled: bool("enabled"),
            delayMinutes: num("delayMinutes"),
            channel: (str("channel") || undefined) as never,
          },
          adminName,
        );
        return NextResponse.json({ ok: true, setting });
      }
      case "retry_automation_run":
        return NextResponse.json({ ok: true, run: await retryFailedRun(str("id")) });

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    console.error(`[admin/lifecycle] ${action} failed`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed." },
      { status: 500 },
    );
  }
}
