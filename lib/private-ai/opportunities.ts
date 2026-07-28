/**
 * Private AI opportunity storage (server-only).
 * Prefers Supabase; falls back to local JSON when unavailable.
 */

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getSupabase } from "@/lib/supabase";
import { processLead } from "@/lib/leads";
import { buildSimulatedArchitecture } from "./architecture";
import type { PrivateAiSubmitInput } from "./schema";
import type {
  PrivateAiOpportunity,
  PrivateAiPipelineStage,
} from "./types";
import { PRIVATE_AI_PIPELINE_STAGES } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "private-ai-opportunities.json");

async function readFileStore(): Promise<PrivateAiOpportunity[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as PrivateAiOpportunity[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFileStore(rows: PrivateAiOpportunity[]): Promise<void> {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_FILE_STORE) {
    console.warn(
      "[private-ai] refusing file write in production. Configure Supabase."
    );
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(rows, null, 2), "utf8");
}

function rowToOpportunity(row: Record<string, unknown>): PrivateAiOpportunity {
  const status = String(row.status ?? "new_inquiry") as PrivateAiPipelineStage;
  return {
    id: String(row.id),
    createdAt: String(row.created_at ?? row.createdAt ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.updatedAt ?? new Date().toISOString()),
    status: PRIVATE_AI_PIPELINE_STAGES.includes(status) ? status : "new_inquiry",
    name: String(row.name ?? ""),
    businessName: String(row.business_name ?? row.businessName ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    industry: String(row.industry ?? ""),
    employees: String(row.employees ?? ""),
    locations: String(row.locations ?? ""),
    currentSoftware: String(row.current_software ?? row.currentSoftware ?? ""),
    privacyConcerns: String(row.privacy_concerns ?? row.privacyConcerns ?? ""),
    timeline: String(row.timeline ?? ""),
    notes: String(row.notes ?? ""),
    owner: String(row.owner ?? ""),
    adminNotes: String(row.admin_notes ?? row.adminNotes ?? ""),
    leadId: row.lead_id ? String(row.lead_id) : row.leadId ? String(row.leadId) : undefined,
    config: (row.config as PrivateAiOpportunity["config"]) ?? {
      businessType: "",
      systemType: "internal_assistant",
      deployment: "private_cloud",
      dataSources: [],
      privacyControls: [],
    },
    architecture:
      (row.architecture as PrivateAiOpportunity["architecture"]) ??
      buildSimulatedArchitecture({
        businessType: "Other",
        systemType: "internal_assistant",
        deployment: "private_cloud",
        dataSources: [],
        privacyControls: [],
      }),
    deploymentPreference: (row.deployment_preference ??
      row.deploymentPreference ??
      "private_cloud") as PrivateAiOpportunity["deploymentPreference"],
    privacyLevel: String(row.privacy_level ?? row.privacyLevel ?? ""),
    existingInfrastructure: String(
      row.existing_infrastructure ?? row.existingInfrastructure ?? ""
    ),
    dataTypes: String(row.data_types ?? row.dataTypes ?? ""),
    requiredIntegrations: String(
      row.required_integrations ?? row.requiredIntegrations ?? ""
    ),
    estimatedUsers: String(row.estimated_users ?? row.estimatedUsers ?? ""),
    internetAvailability: String(
      row.internet_availability ?? row.internetAvailability ?? ""
    ),
    hardwareAvailability: String(
      row.hardware_availability ?? row.hardwareAvailability ?? ""
    ),
    complianceConsiderations: String(
      row.compliance_considerations ?? row.complianceConsiderations ?? ""
    ),
    approvalRequirements: String(
      row.approval_requirements ?? row.approvalRequirements ?? ""
    ),
    budgetRange: String(row.budget_range ?? row.budgetRange ?? ""),
    technicalNotes: String(row.technical_notes ?? row.technicalNotes ?? ""),
    securityNotes: String(row.security_notes ?? row.securityNotes ?? ""),
    activity: Array.isArray(row.activity)
      ? (row.activity as PrivateAiOpportunity["activity"])
      : [],
  };
}

export async function listPrivateAiOpportunities(): Promise<PrivateAiOpportunity[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("private_ai_opportunities")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      if (data?.length) return data.map((r) => rowToOpportunity(r as Record<string, unknown>));
    } catch (err) {
      console.warn("[private-ai] list failed — using file store.", err);
    }
  }
  const rows = await readFileStore();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPrivateAiOpportunity(
  id: string
): Promise<PrivateAiOpportunity | null> {
  const all = await listPrivateAiOpportunities();
  return all.find((r) => r.id === id) ?? null;
}

export async function createPrivateAiOpportunity(
  input: PrivateAiSubmitInput
): Promise<{ opportunity: PrivateAiOpportunity; leadId?: string }> {
  const architecture = buildSimulatedArchitecture(input.config);
  const now = new Date().toISOString();
  const id = randomUUID();

  const configSummary = [
    `Business type: ${input.config.businessType}`,
    `System: ${input.config.systemType}`,
    `Deployment: ${input.config.deployment}`,
    `Data sources: ${input.config.dataSources.join(", ") || "—"}`,
    `Privacy controls: ${input.config.privacyControls.join(", ") || "—"}`,
  ].join("\n");

  const leadResult = await processLead({
    name: input.name,
    company: input.businessName,
    email: input.email,
    phone: input.phone,
    website: "",
    industry: input.industry || input.config.businessType,
    problem: `Custom Private AI inquiry — ${input.config.systemType.replaceAll("_", " ")} (${input.config.deployment.replaceAll("_", " ")})`,
    improve: input.privacyConcerns || "Design a private AI system around our workflows and data.",
    submittedAt: now,
    timeline: input.timeline,
    pageUrl: input.pageUrl,
    referrer: input.referrer,
    utmSource: input.utmSource || "website",
    utmMedium: input.utmMedium || "private_ai_designer",
    utmCampaign: input.utmCampaign || "custom_private_ai_systems",
    source: "website_private_ai_designer",
    status: "new",
    notes: [
      configSummary,
      input.notes && `Visitor notes: ${input.notes}`,
      input.currentSoftware && `Current software: ${input.currentSoftware}`,
      input.employees && `Employees: ${input.employees}`,
      input.locations && `Locations: ${input.locations}`,
      input.complianceConsiderations &&
        `Compliance considerations: ${input.complianceConsiderations}`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });

  const opportunity: PrivateAiOpportunity = {
    id,
    createdAt: now,
    updatedAt: now,
    status: "new_inquiry",
    name: input.name,
    businessName: input.businessName,
    email: input.email,
    phone: input.phone,
    industry: input.industry || input.config.businessType,
    employees: input.employees,
    locations: input.locations,
    currentSoftware: input.currentSoftware,
    privacyConcerns: input.privacyConcerns,
    timeline: input.timeline,
    notes: input.notes,
    owner: "",
    adminNotes: "",
    leadId: leadResult.leadId,
    config: input.config,
    architecture,
    deploymentPreference: input.config.deployment,
    privacyLevel: input.config.privacyControls.join(", ") || "To be assessed",
    existingInfrastructure: input.existingInfrastructure,
    dataTypes: input.dataTypes,
    requiredIntegrations:
      input.requiredIntegrations || input.config.dataSources.join(", "),
    estimatedUsers: input.estimatedUsers,
    internetAvailability: input.internetAvailability,
    hardwareAvailability: input.hardwareAvailability,
    complianceConsiderations: input.complianceConsiderations,
    approvalRequirements: input.approvalRequirements,
    budgetRange: input.budgetRange,
    technicalNotes: "",
    securityNotes: "",
    activity: [
      {
        at: now,
        text: "Configuration submitted from Private AI System Designer",
      },
    ],
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("private_ai_opportunities").insert({
        id: opportunity.id,
        created_at: opportunity.createdAt,
        updated_at: opportunity.updatedAt,
        status: opportunity.status,
        name: opportunity.name,
        business_name: opportunity.businessName,
        email: opportunity.email,
        phone: opportunity.phone,
        industry: opportunity.industry,
        employees: opportunity.employees,
        locations: opportunity.locations,
        current_software: opportunity.currentSoftware,
        privacy_concerns: opportunity.privacyConcerns,
        timeline: opportunity.timeline,
        notes: opportunity.notes,
        owner: opportunity.owner,
        admin_notes: opportunity.adminNotes,
        lead_id: opportunity.leadId ?? null,
        config: opportunity.config,
        architecture: opportunity.architecture,
        deployment_preference: opportunity.deploymentPreference,
        privacy_level: opportunity.privacyLevel,
        existing_infrastructure: opportunity.existingInfrastructure,
        data_types: opportunity.dataTypes,
        required_integrations: opportunity.requiredIntegrations,
        estimated_users: opportunity.estimatedUsers,
        internet_availability: opportunity.internetAvailability,
        hardware_availability: opportunity.hardwareAvailability,
        compliance_considerations: opportunity.complianceConsiderations,
        approval_requirements: opportunity.approvalRequirements,
        budget_range: opportunity.budgetRange,
        technical_notes: opportunity.technicalNotes,
        security_notes: opportunity.securityNotes,
        activity: opportunity.activity,
      });
      if (error) throw error;
      return { opportunity, leadId: opportunity.leadId };
    } catch (err) {
      console.warn("[private-ai] Supabase insert failed — using file store.", err);
    }
  }

  const rows = await readFileStore();
  rows.unshift(opportunity);
  await writeFileStore(rows.slice(0, 500));
  return { opportunity, leadId: leadResult.leadId };
}

export async function updatePrivateAiOpportunity(
  id: string,
  patch: Partial<{
    status: PrivateAiPipelineStage;
    owner: string;
    adminNotes: string;
    technicalNotes: string;
    securityNotes: string;
    budgetRange: string;
    timeline: string;
  }>,
  actor?: string
): Promise<PrivateAiOpportunity | null> {
  const existing = await getPrivateAiOpportunity(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const activity = [...existing.activity];
  if (patch.status && patch.status !== existing.status) {
    activity.unshift({
      at: now,
      text: `Status changed to ${patch.status.replaceAll("_", " ")}`,
      by: actor,
    });
  }
  if (patch.owner !== undefined && patch.owner !== existing.owner) {
    activity.unshift({
      at: now,
      text: patch.owner ? `Assigned to ${patch.owner}` : "Owner cleared",
      by: actor,
    });
  }
  if (patch.adminNotes !== undefined && patch.adminNotes !== existing.adminNotes) {
    activity.unshift({ at: now, text: "Admin notes updated", by: actor });
  }

  const next: PrivateAiOpportunity = {
    ...existing,
    ...patch,
    updatedAt: now,
    activity: activity.slice(0, 100),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("private_ai_opportunities")
        .update({
          updated_at: next.updatedAt,
          status: next.status,
          owner: next.owner,
          admin_notes: next.adminNotes,
          technical_notes: next.technicalNotes,
          security_notes: next.securityNotes,
          budget_range: next.budgetRange,
          timeline: next.timeline,
          activity: next.activity,
        })
        .eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[private-ai] update failed — using file store.", err);
    }
  }

  const rows = await readFileStore();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) {
    rows.unshift(next);
  } else {
    rows[idx] = next;
  }
  await writeFileStore(rows);
  return next;
}
