/**
 * Client Lifecycle Platform — projects, milestones, tasks, progress.
 *
 * Server-only data access for the delivery phase of the client journey:
 * project creation from the standard phase template, milestone workflow
 * (including client approvals), onboarding tasks, and the derived
 * progress / health / current-phase rollups persisted on the project row.
 */

import { requireSupabase, nowIso } from "@/lib/lifecycle/core";
import {
  MILESTONE_DONE_STATUSES,
  type Milestone,
  type MilestoneStatus,
  type Project,
  type ProjectHealth,
  type ProjectMember,
  type ProjectRole,
  type ProjectStatus,
  type ProjectTask,
  type ProjectTaskKind,
  type ProjectTaskStatus,
  type ResponsibleParty,
} from "@/lib/lifecycle/types";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

type PhaseTemplate = {
  name: string;
  description: string;
  owner_party: ResponsibleParty;
  approval_required: boolean;
  deliverables: { title: string; detail?: string }[];
  client_action?: string;
};

/** The standard 12-phase delivery roadmap every new project starts from. */
export const PROJECT_PHASE_TEMPLATE: PhaseTemplate[] = [
  {
    name: "Discovery",
    description:
      "We learn how your business runs today — your goals, your customers, and the day-to-day work your new system needs to support.",
    owner_party: "joint",
    approval_required: false,
    deliverables: [
      { title: "Kickoff meeting", detail: "A working session to align on goals, priorities, and how we'll work together." },
      { title: "Discovery summary", detail: "A plain-language write-up of what we learned and what matters most." },
      { title: "Project workspace access", detail: "Your team is set up in the client portal with everything in one place." },
    ],
  },
  {
    name: "Strategy",
    description:
      "We turn what we learned into a clear plan: what gets built, in what order, and how success will be measured.",
    owner_party: "rsg",
    approval_required: false,
    deliverables: [
      { title: "System blueprint", detail: "The plan for what your system will do and how the pieces fit together." },
      { title: "Success metrics", detail: "The specific outcomes we'll track so progress is measurable, not vague." },
      { title: "Delivery timeline", detail: "Phase-by-phase dates so you always know what's next." },
    ],
  },
  {
    name: "Architecture",
    description:
      "We map out how everything works behind the scenes so your system stays fast, secure, and easy to grow as your business does.",
    owner_party: "rsg",
    approval_required: false,
    deliverables: [
      { title: "System map", detail: "A visual overview of every component and how information moves between them." },
      { title: "Data and integration plan", detail: "How your existing tools and information connect into the new system." },
      { title: "Security approach", detail: "How access, backups, and sensitive information are protected." },
    ],
  },
  {
    name: "Design",
    description:
      "We design what you and your customers will actually see and use — built around your brand and how people really work.",
    owner_party: "rsg",
    approval_required: true,
    client_action:
      "Review the designs in your portal and either approve them or request changes so build work can begin.",
    deliverables: [
      { title: "Design concepts", detail: "The visual direction for your system before detailed work begins." },
      { title: "Screen designs", detail: "The key pages and screens, designed for clarity and ease of use." },
      { title: "Brand application", detail: "Your logo, colors, and voice applied consistently throughout." },
    ],
  },
  {
    name: "Development",
    description:
      "We build your system to the approved designs, with regular progress updates so you're never wondering where things stand.",
    owner_party: "rsg",
    approval_required: false,
    deliverables: [
      { title: "Working builds", detail: "Functional versions of your system as each area comes together." },
      { title: "Progress updates", detail: "Regular, plain-language updates on what's done and what's next." },
    ],
  },
  {
    name: "Integration",
    description:
      "We connect your system to the tools you already use so information flows automatically instead of being retyped.",
    owner_party: "rsg",
    approval_required: false,
    deliverables: [
      { title: "Connected tools", detail: "Your existing software linked so everything talks to each other." },
      { title: "Automation flows", detail: "The repetitive handoffs that now happen automatically." },
      { title: "Data migration", detail: "Existing records moved over cleanly where needed." },
    ],
  },
  {
    name: "Testing",
    description:
      "We test everything thoroughly — every form, workflow, and device — and fix issues before you ever see them.",
    owner_party: "rsg",
    approval_required: false,
    deliverables: [
      { title: "Quality review", detail: "Every feature checked against a structured testing checklist." },
      { title: "Cross-device review", detail: "Verified on phones, tablets, and desktops." },
      { title: "Fixes applied", detail: "Anything found during testing is resolved before your review." },
    ],
  },
  {
    name: "Client Review",
    description:
      "You walk through the finished system with us, share feedback, and give the final go-ahead before launch.",
    owner_party: "client",
    approval_required: true,
    client_action:
      "Walk through the completed system, share any feedback, and give final approval so we can schedule launch.",
    deliverables: [
      { title: "Guided review session", detail: "A walkthrough of the complete system with your team." },
      { title: "Feedback log", detail: "Every note you share, tracked to resolution." },
      { title: "Final adjustments", detail: "Refinements from your review, completed before launch." },
    ],
  },
  {
    name: "Training",
    description:
      "We teach your team how to run the system day to day, with materials you can revisit any time — no one is left guessing.",
    owner_party: "joint",
    approval_required: false,
    deliverables: [
      { title: "Live training sessions", detail: "Hands-on sessions tailored to how your team will use the system." },
      { title: "Guides and recordings", detail: "Step-by-step materials your team can revisit whenever they need." },
      { title: "Training library access", detail: "Everything organized in your portal for new hires later." },
    ],
  },
  {
    name: "Launch",
    description:
      "Your system goes live. We monitor closely through the transition to make sure everything runs smoothly from day one.",
    owner_party: "rsg",
    approval_required: false,
    deliverables: [
      { title: "Go-live", detail: "Your system switched on and open for business." },
      { title: "Launch monitoring", detail: "Close attention through the first days to catch anything early." },
      { title: "Launch confirmation", detail: "A checkpoint confirming everything is running as intended." },
    ],
  },
  {
    name: "Optimization",
    description:
      "After launch we watch how the system performs in the real world and fine-tune it based on how it's actually used.",
    owner_party: "rsg",
    approval_required: false,
    deliverables: [
      { title: "Performance review", detail: "How the system is performing against the success metrics we set." },
      { title: "Refinements", detail: "Adjustments based on real usage, not assumptions." },
      { title: "30-day check-in", detail: "A structured review one month after launch." },
    ],
  },
  {
    name: "Ongoing Support",
    description:
      "You're never on your own — support, updates, and regular strategy reviews keep your system improving over time.",
    owner_party: "joint",
    approval_required: false,
    deliverables: [
      { title: "Support access", detail: "A direct channel for questions and issues, with clear response expectations." },
      { title: "Monthly reporting", detail: "Plain-language reports on performance and results." },
      { title: "Strategy reviews", detail: "Regular sessions on what to improve or build next." },
    ],
  },
];

/** Seeded into every new project so onboarding starts with a clear checklist. */
export const DEFAULT_ONBOARDING_TASKS: {
  title: string;
  description: string;
  kind: ProjectTaskKind;
  assignee_party: "rsg" | "client";
}[] = [
  {
    title: "Upload your brand assets",
    description:
      "Add your logo files, brand colors, fonts, and any photos or graphics you want used. If you don't have formal brand files, upload what you have and we'll work with it.",
    kind: "file_request",
    assignee_party: "client",
  },
  {
    title: "Confirm website and hosting access",
    description:
      "Confirm you can reach your current website, domain, and hosting accounts. Credentials are exchanged through a secure channel we'll set up together — never send passwords in messages.",
    kind: "access",
    assignee_party: "client",
  },
  {
    title: "List the tools you currently use",
    description:
      "Tell us the software your business runs on today — scheduling, invoicing, email, spreadsheets, anything. This shapes what we connect and what we replace.",
    kind: "onboarding",
    assignee_party: "client",
  },
  {
    title: "Schedule your kickoff call",
    description:
      "Pick a time for the project kickoff so we can align on goals, timeline, and how we'll work together.",
    kind: "onboarding",
    assignee_party: "client",
  },
  {
    title: "Confirm your primary point of contact",
    description:
      "Let us know who on your team makes day-to-day decisions for this project and who should receive updates.",
    kind: "onboarding",
    assignee_party: "client",
  },
  {
    title: "Set up the project workspace",
    description:
      "Create the internal delivery workspace, invite the client team to the portal, and confirm everyone has access.",
    kind: "onboarding",
    assignee_party: "rsg",
  },
  {
    title: "Prepare the kickoff agenda",
    description:
      "Draft the kickoff agenda from the consultation notes and proposal so the first session is focused and productive.",
    kind: "onboarding",
    assignee_party: "rsg",
  },
  {
    title: "Prepare the access checklist",
    description:
      "List every account and system we'll need access to, and set up the secure channel for exchanging credentials.",
    kind: "access",
    assignee_party: "rsg",
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

const OPEN_TASK_STATUSES: ProjectTaskStatus[] = ["open", "in_progress", "waiting"];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDone(status: MilestoneStatus): boolean {
  return MILESTONE_DONE_STATUSES.includes(status);
}

async function fetchMilestones(projectId: string): Promise<Milestone[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to load milestones for project ${projectId}: ${error.message}`);
  }
  return (data ?? []) as Milestone[];
}

async function fetchMilestone(id: string): Promise<Milestone> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("milestones")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load milestone ${id}: ${error.message}`);
  if (!data) throw new Error(`Milestone ${id} not found.`);
  return data as Milestone;
}

/** First non-done milestone's name, else the last milestone's name. */
function currentPhaseOf(milestones: Milestone[]): string | null {
  if (milestones.length === 0) return null;
  const active = milestones.find((m) => !isDone(m.status));
  return (active ?? milestones[milestones.length - 1]).name;
}

/**
 * Persist derived rollups (progress, health, current_phase) onto the parent
 * project after any milestone change. Returns the updated project row.
 */
async function recomputeProject(projectId: string, milestones?: Milestone[]): Promise<Project> {
  const sb = requireSupabase();
  const list = milestones ?? (await fetchMilestones(projectId));
  const patch: Record<string, unknown> = {
    progress: computeProgress(list),
    health: computeHealth(list),
    updated_at: nowIso(),
  };
  const phase = currentPhaseOf(list);
  if (phase) patch.current_phase = phase;
  const { data, error } = await sb
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .select()
    .single();
  if (error) throw new Error(`Failed to update project ${projectId} rollups: ${error.message}`);
  return data as Project;
}

/**
 * When a milestone finishes, move the next not_started milestone (by sort
 * order) to "upcoming" so the roadmap always shows what comes next.
 * Returns the full, refreshed milestone list.
 */
async function bumpNextMilestone(projectId: string, afterSortOrder: number): Promise<Milestone[]> {
  const sb = requireSupabase();
  const milestones = await fetchMilestones(projectId);
  const next = milestones.find(
    (m) => m.sort_order > afterSortOrder && m.status === "not_started"
  );
  if (!next) return milestones;
  const { data, error } = await sb
    .from("milestones")
    .update({ status: "upcoming" satisfies MilestoneStatus, updated_at: nowIso() })
    .eq("id", next.id)
    .select()
    .single();
  if (error) throw new Error(`Failed to advance milestone ${next.id} to upcoming: ${error.message}`);
  const index = milestones.findIndex((m) => m.id === next.id);
  milestones[index] = data as Milestone;
  return milestones;
}

// ---------------------------------------------------------------------------
// Progress & health
// ---------------------------------------------------------------------------

/** Percent (0–100, rounded) of milestones in a done status. */
export function computeProgress(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  const done = milestones.filter((m) => isDone(m.status)).length;
  return Math.round((done / milestones.length) * 100);
}

/**
 * Health from milestone state:
 *  - delayed: any active milestone is delayed/blocked, or past target by >7 days
 *  - at_risk: any active milestone past its target date, or changes requested
 *  - on_track otherwise
 */
export function computeHealth(milestones: Milestone[]): ProjectHealth {
  const now = Date.now();
  let atRisk = false;
  for (const m of milestones) {
    if (isDone(m.status)) continue;
    if (m.status === "delayed" || m.status === "blocked") return "delayed";
    if (m.status === "changes_requested") atRisk = true;
    if (m.target_date) {
      const overdueDays = Math.floor(
        (now - Date.parse(`${m.target_date}T00:00:00.000Z`)) / MS_PER_DAY
      );
      if (overdueDays > 7) return "delayed";
      if (overdueDays > 0) atRisk = true;
    }
  }
  return atRisk ? "at_risk" : "on_track";
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** "RSG-2026-004": year plus a zero-padded sequence within that year. */
export async function generateProjectCode(): Promise<string> {
  const sb = requireSupabase();
  const year = new Date().getUTCFullYear();
  const { count, error } = await sb
    .from("projects")
    .select("id", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01T00:00:00.000Z`)
    .lt("created_at", `${year + 1}-01-01T00:00:00.000Z`);
  if (error) throw new Error(`Failed to count projects for code generation: ${error.message}`);
  return `RSG-${year}-${String((count ?? 0) + 1).padStart(3, "0")}`;
}

export async function createProject(input: {
  clientId: string;
  opportunityId?: string | null;
  contractId?: string | null;
  name: string;
  summary?: string;
  managerAdminId?: string | null;
  startDate?: string | null;
  targetLaunchDate?: string | null;
  phases?: PhaseTemplate[];
}): Promise<{ project: Project; milestones: Milestone[]; tasks: ProjectTask[] }> {
  const sb = requireSupabase();
  const phases =
    input.phases && input.phases.length > 0 ? input.phases : PROJECT_PHASE_TEMPLATE;
  const code = await generateProjectCode();
  const now = nowIso();

  const { data: projectData, error: projectError } = await sb
    .from("projects")
    .insert({
      client_id: input.clientId,
      opportunity_id: input.opportunityId ?? null,
      contract_id: input.contractId ?? null,
      code,
      name: input.name,
      summary: input.summary ?? "",
      status: "onboarding" satisfies ProjectStatus,
      health: "on_track" satisfies ProjectHealth,
      current_phase: phases[0].name,
      progress: 0,
      start_date: input.startDate ?? null,
      target_launch_date: input.targetLaunchDate ?? null,
      manager_admin_id: input.managerAdminId ?? null,
      updated_at: now,
    })
    .select()
    .single();
  if (projectError) {
    throw new Error(`Failed to create project "${input.name}": ${projectError.message}`);
  }
  const project = projectData as Project;

  const { data: milestoneData, error: milestoneError } = await sb
    .from("milestones")
    .insert(
      phases.map((phase, index) => ({
        project_id: project.id,
        name: phase.name,
        description: phase.description,
        owner_party: phase.owner_party,
        sort_order: index,
        status: (index === 0 ? "upcoming" : "not_started") satisfies MilestoneStatus,
        deliverables: phase.deliverables,
        client_action: phase.client_action ?? null,
        approval_required: phase.approval_required,
        updated_at: now,
      }))
    )
    .select();
  if (milestoneError) {
    throw new Error(
      `Failed to create milestones for project ${project.id}: ${milestoneError.message}`
    );
  }
  const milestones = ((milestoneData ?? []) as Milestone[]).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const { data: taskData, error: taskError } = await sb
    .from("project_tasks")
    .insert(
      DEFAULT_ONBOARDING_TASKS.map((task, index) => ({
        project_id: project.id,
        title: task.title,
        description: task.description,
        kind: task.kind,
        assignee_party: task.assignee_party,
        status: "open" satisfies ProjectTaskStatus,
        sort_order: index,
        updated_at: now,
      }))
    )
    .select();
  if (taskError) {
    throw new Error(
      `Failed to create onboarding tasks for project ${project.id}: ${taskError.message}`
    );
  }
  const tasks = ((taskData ?? []) as ProjectTask[]).sort(
    (a, b) => a.sort_order - b.sort_order
  );

  return { project, milestones, tasks };
}

export async function getProject(id: string): Promise<Project | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to load project ${id}: ${error.message}`);
  return (data as Project) ?? null;
}

export async function getProjectWithDetail(id: string): Promise<{
  project: Project;
  milestones: Milestone[];
  tasks: ProjectTask[];
  members: ProjectMember[];
} | null> {
  const project = await getProject(id);
  if (!project) return null;
  const sb = requireSupabase();
  const [milestones, tasksResult, members] = await Promise.all([
    fetchMilestones(id),
    sb
      .from("project_tasks")
      .select("*")
      .eq("project_id", id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    listMembers(id),
  ]);
  if (tasksResult.error) {
    throw new Error(`Failed to load tasks for project ${id}: ${tasksResult.error.message}`);
  }
  return {
    project,
    milestones,
    tasks: (tasksResult.data ?? []) as ProjectTask[],
    members,
  };
}

export async function listProjectsForClient(clientId: string): Promise<Project[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("projects")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Failed to list projects for client ${clientId}: ${error.message}`);
  return (data ?? []) as Project[];
}

export async function listProjects(
  filters: { status?: ProjectStatus; limit?: number } = {}
): Promise<Project[]> {
  const sb = requireSupabase();
  let query = sb.from("projects").select("*").order("created_at", { ascending: false });
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.limit && filters.limit > 0) query = query.limit(filters.limit);
  const { data, error } = await query;
  if (error) throw new Error(`Failed to list projects: ${error.message}`);
  return (data ?? []) as Project[];
}

export async function updateProject(
  id: string,
  patch: {
    name?: string;
    summary?: string;
    status?: ProjectStatus;
    health?: ProjectHealth;
    managerAdminId?: string | null;
    startDate?: string | null;
    targetLaunchDate?: string | null;
    actualLaunchDate?: string | null;
  }
): Promise<Project> {
  const sb = requireSupabase();
  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.summary !== undefined) update.summary = patch.summary;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.health !== undefined) update.health = patch.health;
  if (patch.managerAdminId !== undefined) update.manager_admin_id = patch.managerAdminId;
  if (patch.startDate !== undefined) update.start_date = patch.startDate;
  if (patch.targetLaunchDate !== undefined) update.target_launch_date = patch.targetLaunchDate;
  if (patch.actualLaunchDate !== undefined) update.actual_launch_date = patch.actualLaunchDate;
  const { data, error } = await sb
    .from("projects")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update project ${id}: ${error.message}`);
  return data as Project;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export async function updateMilestone(
  id: string,
  patch: {
    status?: MilestoneStatus;
    name?: string;
    description?: string;
    startsOn?: string | null;
    targetDate?: string | null;
    completedOn?: string | null;
    notes?: string;
    clientAction?: string | null;
    approvalRequired?: boolean;
    deliverables?: { title: string; detail?: string }[];
    ownerParty?: ResponsibleParty;
    sortOrder?: number;
  }
): Promise<{ milestone: Milestone; project: Project }> {
  const sb = requireSupabase();
  const existing = await fetchMilestone(id);

  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.startsOn !== undefined) update.starts_on = patch.startsOn;
  if (patch.targetDate !== undefined) update.target_date = patch.targetDate;
  if (patch.completedOn !== undefined) update.completed_on = patch.completedOn;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.clientAction !== undefined) update.client_action = patch.clientAction;
  if (patch.approvalRequired !== undefined) update.approval_required = patch.approvalRequired;
  if (patch.deliverables !== undefined) update.deliverables = patch.deliverables;
  if (patch.ownerParty !== undefined) update.owner_party = patch.ownerParty;
  if (patch.sortOrder !== undefined) update.sort_order = patch.sortOrder;

  const becameDone =
    patch.status !== undefined && isDone(patch.status) && !isDone(existing.status);
  if (
    patch.status !== undefined &&
    isDone(patch.status) &&
    !existing.completed_on &&
    patch.completedOn === undefined
  ) {
    update.completed_on = todayDate();
  }

  const { data, error } = await sb
    .from("milestones")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update milestone ${id}: ${error.message}`);
  const milestone = data as Milestone;

  const milestones = becameDone
    ? await bumpNextMilestone(milestone.project_id, milestone.sort_order)
    : await fetchMilestones(milestone.project_id);
  const project = await recomputeProject(milestone.project_id, milestones);
  return { milestone, project };
}

export async function approveMilestone(
  id: string,
  input: { approvedBy: string }
): Promise<{ milestone: Milestone; project: Project }> {
  const sb = requireSupabase();
  const existing = await fetchMilestone(id);
  if (!existing.approval_required) {
    throw new Error(`Milestone ${id} does not require approval.`);
  }
  if (existing.status !== "under_review") {
    throw new Error(
      `Milestone ${id} cannot be approved from status "${existing.status}" — it must be under review.`
    );
  }

  const { data, error } = await sb
    .from("milestones")
    .update({
      status: "approved" satisfies MilestoneStatus,
      approved_at: nowIso(),
      approved_by: input.approvedBy,
      completed_on: existing.completed_on || todayDate(),
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to approve milestone ${id}: ${error.message}`);
  const milestone = data as Milestone;

  const milestones = await bumpNextMilestone(milestone.project_id, milestone.sort_order);
  const project = await recomputeProject(milestone.project_id, milestones);
  return { milestone, project };
}

export async function requestMilestoneChanges(
  id: string,
  input: { note: string }
): Promise<{ milestone: Milestone; project: Project }> {
  const sb = requireSupabase();
  const existing = await fetchMilestone(id);
  const note = input.note.trim();
  const notes = note ? (existing.notes ? `${existing.notes}\n${note}` : note) : existing.notes;

  const { data, error } = await sb
    .from("milestones")
    .update({
      status: "changes_requested" satisfies MilestoneStatus,
      notes,
      updated_at: nowIso(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to request changes on milestone ${id}: ${error.message}`);
  }
  const milestone = data as Milestone;
  const project = await recomputeProject(milestone.project_id);
  return { milestone, project };
}

export async function addMilestone(
  projectId: string,
  input: {
    name: string;
    description?: string;
    ownerParty?: ResponsibleParty;
    ownerAdminId?: string | null;
    status?: MilestoneStatus;
    startsOn?: string | null;
    targetDate?: string | null;
    deliverables?: { title: string; detail?: string }[];
    clientAction?: string | null;
    approvalRequired?: boolean;
    sortOrder?: number;
    notes?: string;
  }
): Promise<{ milestone: Milestone; project: Project }> {
  const sb = requireSupabase();
  const existing = await fetchMilestones(projectId);
  const sortOrder =
    input.sortOrder !== undefined
      ? input.sortOrder
      : existing.length > 0
        ? Math.max(...existing.map((m) => m.sort_order)) + 1
        : 0;

  const { data, error } = await sb
    .from("milestones")
    .insert({
      project_id: projectId,
      name: input.name,
      description: input.description ?? "",
      owner_party: input.ownerParty ?? "rsg",
      owner_admin_id: input.ownerAdminId ?? null,
      sort_order: sortOrder,
      status: input.status ?? ("not_started" satisfies MilestoneStatus),
      starts_on: input.startsOn ?? null,
      target_date: input.targetDate ?? null,
      deliverables: input.deliverables ?? [],
      client_action: input.clientAction ?? null,
      approval_required: input.approvalRequired ?? false,
      notes: input.notes ?? "",
      updated_at: nowIso(),
    })
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to add milestone to project ${projectId}: ${error.message}`);
  }
  const milestone = data as Milestone;
  const project = await recomputeProject(projectId);
  return { milestone, project };
}

export async function reorderMilestones(
  projectId: string,
  orderedIds: string[]
): Promise<{ milestones: Milestone[]; project: Project }> {
  const sb = requireSupabase();
  for (const [index, milestoneId] of orderedIds.entries()) {
    const { error } = await sb
      .from("milestones")
      .update({ sort_order: index, updated_at: nowIso() })
      .eq("id", milestoneId)
      .eq("project_id", projectId);
    if (error) {
      throw new Error(
        `Failed to reorder milestone ${milestoneId} in project ${projectId}: ${error.message}`
      );
    }
  }
  const milestones = await fetchMilestones(projectId);
  const project = await recomputeProject(projectId, milestones);
  return { milestones, project };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function createTask(
  projectId: string,
  input: {
    milestoneId?: string | null;
    title: string;
    description?: string;
    kind?: ProjectTaskKind;
    assigneeParty: "rsg" | "client";
    assigneeClientUserId?: string | null;
    assigneeAdminId?: string | null;
    dueAt?: string | null;
  }
): Promise<ProjectTask> {
  const sb = requireSupabase();
  const { count, error: countError } = await sb
    .from("project_tasks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (countError) {
    throw new Error(`Failed to count tasks for project ${projectId}: ${countError.message}`);
  }

  const { data, error } = await sb
    .from("project_tasks")
    .insert({
      project_id: projectId,
      milestone_id: input.milestoneId ?? null,
      title: input.title,
      description: input.description ?? "",
      kind: input.kind ?? ("general" satisfies ProjectTaskKind),
      assignee_party: input.assigneeParty,
      assignee_admin_id: input.assigneeAdminId ?? null,
      assignee_client_user_id: input.assigneeClientUserId ?? null,
      status: "open" satisfies ProjectTaskStatus,
      due_at: input.dueAt ?? null,
      sort_order: count ?? 0,
      updated_at: nowIso(),
    })
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to create task in project ${projectId}: ${error.message}`);
  }
  return data as ProjectTask;
}

export async function updateTask(
  id: string,
  patch: {
    status?: ProjectTaskStatus;
    title?: string;
    description?: string;
    dueAt?: string | null;
  }
): Promise<ProjectTask> {
  const sb = requireSupabase();
  const { data: existingData, error: loadError } = await sb
    .from("project_tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (loadError) throw new Error(`Failed to load task ${id}: ${loadError.message}`);
  if (!existingData) throw new Error(`Task ${id} not found.`);
  const existing = existingData as ProjectTask;

  const update: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status === "done") {
      update.completed_at = existing.completed_at ?? nowIso();
    } else if (existing.completed_at) {
      update.completed_at = null;
    }
  }

  const { data, error } = await sb
    .from("project_tasks")
    .update(update)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update task ${id}: ${error.message}`);
  return data as ProjectTask;
}

/** Client-assigned tasks still needing attention (open / in progress / waiting). */
export async function listOpenClientTasks(projectId: string): Promise<ProjectTask[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("project_tasks")
    .select("*")
    .eq("project_id", projectId)
    .eq("assignee_party", "client")
    .in("status", OPEN_TASK_STATUSES)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to list open client tasks for project ${projectId}: ${error.message}`);
  }
  return (data ?? []) as ProjectTask[];
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function addProjectMember(
  projectId: string,
  member: {
    memberType: "admin" | "client_user";
    adminId?: string | null;
    clientUserId?: string | null;
    projectRole: ProjectRole;
  }
): Promise<ProjectMember> {
  if (member.memberType === "admin" && !member.adminId) {
    throw new Error("An admin project member requires adminId.");
  }
  if (member.memberType === "client_user" && !member.clientUserId) {
    throw new Error("A client project member requires clientUserId.");
  }
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("project_members")
    .insert({
      project_id: projectId,
      member_type: member.memberType,
      admin_id: member.memberType === "admin" ? member.adminId : null,
      client_user_id: member.memberType === "client_user" ? member.clientUserId : null,
      project_role: member.projectRole,
    })
    .select()
    .single();
  if (error) {
    throw new Error(`Failed to add member to project ${projectId}: ${error.message}`);
  }
  return data as ProjectMember;
}

export async function listMembers(projectId: string): Promise<ProjectMember[]> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("project_members")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to list members for project ${projectId}: ${error.message}`);
  }
  return (data ?? []) as ProjectMember[];
}

export async function removeProjectMember(id: string): Promise<void> {
  const sb = requireSupabase();
  const { error } = await sb.from("project_members").delete().eq("id", id);
  if (error) throw new Error(`Failed to remove project member ${id}: ${error.message}`);
}
