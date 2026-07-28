import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { hashPassword } from "./auth";
import { getSupabase } from "./supabase";
import { isDemoDataEnabled } from "./demo";
import { SEED_CLIENTS, DEMO_PASSWORD } from "./seed";
import type {
  ClientRecord,
  Lead,
  AdminRecord,
  ClientPatch,
  Subscriber,
  PageView,
} from "./types";

/**
 * File-backed store for local development only. Production fails closed
 * without Supabase — file/tmp paths are never treated as durable there.
 */

const IS_PROD = process.env.NODE_ENV === "production";

const DATA_DIR =
  process.env.DATA_DIR ??
  (IS_PROD
    ? path.join(os.tmpdir(), "rsg-data")
    : path.join(process.cwd(), "data"));
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");

async function ensureDir() {
  if (IS_PROD) return;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    /* read-only filesystem — writes will no-op below */
  }
}

/** Write JSON for local/dev only. Production always returns false. */
async function writeJson(file: string, data: unknown): Promise<boolean> {
  if (IS_PROD) {
    console.error(
      `[store] refusing file write in production (${path.basename(file)}). Configure Supabase.`
    );
    return false;
  }
  try {
    await ensureDir();
    await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch {
    console.warn(`[store] could not write ${path.basename(file)} (read-only fs).`);
    return false;
  }
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/*
 * Client accounts: Supabase when configured, local file store otherwise.
 * Every Supabase read is wrapped so that a missing table or a transient error
 * falls back to the file store (in dev) rather than locking anyone out — the
 * app is never left broken while the migration is pending.
 */

type ClientRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  company: string;
  plan: string;
  member_since: string | null;
  strategist: string | null;
  metrics: ClientRecord["metrics"] | null;
  systems: ClientRecord["systems"] | null;
  projects: ClientRecord["projects"] | null;
  activity: ClientRecord["activity"] | null;
  deliverables: ClientRecord["deliverables"] | null;
  invoices: ClientRecord["invoices"] | null;
};

function rowToClient(row: ClientRow): ClientRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    company: row.company,
    plan: row.plan,
    since: row.member_since ?? "",
    strategist: row.strategist ?? "Redmont Strategies Group",
    metrics: row.metrics ?? [],
    systems: row.systems ?? [],
    projects: row.projects ?? [],
    activity: row.activity ?? [],
    deliverables: row.deliverables ?? [],
    invoices: row.invoices ?? [],
    passwordHash: row.password_hash,
  };
}

/**
 * Local file-store clients. Returns whatever has been written to disk (e.g.
 * clients created via the admin while Supabase is unconfigured). Demo/sample
 * clients are seeded ONLY when isDemoDataEnabled() — never in production and
 * never in dev unless NEXT_PUBLIC_ENABLE_DEMO_DATA=true.
 */
async function fileClients(): Promise<ClientRecord[]> {
  const existing = await readJson<ClientRecord[] | null>(CLIENTS_FILE, null);
  if (existing && Array.isArray(existing) && existing.length) return existing;
  if (!isDemoDataEnabled()) return [];
  const hash = hashPassword(DEMO_PASSWORD);
  const seeded: ClientRecord[] = SEED_CLIENTS.map((c) => ({
    ...c,
    passwordHash: hash,
  }));
  await writeJson(CLIENTS_FILE, seeded);
  return seeded;
}

export async function getClients(): Promise<ClientRecord[]> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as ClientRow[]).map(rowToClient);
    } catch (err) {
      console.warn("[store] clients read from Supabase failed — using file store.", err);
    }
  }
  return fileClients();
}

export async function findClientByEmail(
  email: string
): Promise<ClientRecord | null> {
  const target = email.trim().toLowerCase();
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .ilike("email", target)
        .limit(1);
      if (error) throw error;
      const row = (data as ClientRow[])[0];
      return row ? rowToClient(row) : null;
    } catch (err) {
      console.warn("[store] client lookup from Supabase failed — using file store.", err);
    }
  }
  const clients = await fileClients();
  return clients.find((c) => c.email.toLowerCase() === target) ?? null;
}

export async function getClientById(
  id: string
): Promise<ClientRecord | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", id)
        .limit(1);
      if (error) throw error;
      const row = (data as ClientRow[])[0];
      return row ? rowToClient(row) : null;
    } catch (err) {
      console.warn("[store] client-by-id from Supabase failed — using file store.", err);
    }
  }
  const clients = await fileClients();
  return clients.find((c) => c.id === id) ?? null;
}

/** Apply an admin edit to a client and persist. Returns the updated record. */
export async function updateClient(
  id: string,
  patch: ClientPatch
): Promise<ClientRecord | null> {
  const current = await getClientById(id);
  if (!current) return null;

  const next: ClientRecord = { ...current };

  // Whitelisted profile fields only.
  const fields: (keyof ClientPatch)[] = [
    "name",
    "email",
    "company",
    "plan",
    "since",
    "strategist",
  ];
  for (const f of fields) {
    const val = patch[f];
    if (typeof val === "string" && val.trim()) {
      (next as Record<string, unknown>)[f] = val.trim();
    }
  }

  // Metric values (match by key, only update value/delta/hint/label).
  if (Array.isArray(patch.metrics)) {
    next.metrics = current.metrics.map((m) => {
      const edit = patch.metrics!.find((e) => e.key === m.key);
      if (!edit) return m;
      return {
        ...m,
        label: edit.label?.trim() || m.label,
        value: Number.isFinite(edit.value) ? Number(edit.value) : m.value,
        delta: edit.delta ?? m.delta,
        hint: edit.hint ?? m.hint,
      };
    });
  }

  // Optional password reset — also revoke any active sessions for this client.
  const passwordChanged =
    typeof patch.password === "string" && patch.password.length >= 6;
  if (passwordChanged) {
    next.passwordHash = hashPassword(patch.password!);
    await revokeClientSessions(id);
  }

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          name: next.name,
          email: next.email,
          company: next.company,
          plan: next.plan,
          member_since: next.since,
          strategist: next.strategist,
          metrics: next.metrics,
          password_hash: next.passwordHash,
        })
        .eq("id", id);
      if (error) throw error;
      return next;
    } catch (err) {
      console.warn("[store] client update to Supabase failed — using file store.", err);
    }
  }

  const clients = await fileClients();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx !== -1) {
    clients[idx] = next;
    await writeJson(CLIENTS_FILE, clients);
  }
  return next;
}

/** Provision a new client account. Caller should reject duplicate emails
 * first via findClientByEmail for a clean error message. */
export async function createClient(input: {
  name: string;
  company: string;
  email: string;
  password: string;
  plan?: string;
  since?: string;
  strategist?: string;
}): Promise<ClientRecord> {
  const record: ClientRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    company: input.company.trim(),
    plan: input.plan?.trim() || "Strategy Audit",
    since: input.since?.trim() || "",
    strategist: input.strategist?.trim() || "Redmont Strategies Group",
    metrics: [],
    systems: [],
    projects: [],
    activity: [],
    deliverables: [],
    invoices: [],
    passwordHash: hashPassword(input.password),
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("clients")
        .insert({
          email: record.email,
          password_hash: record.passwordHash,
          name: record.name,
          company: record.company,
          plan: record.plan,
          member_since: record.since,
          strategist: record.strategist,
        })
        .select("*")
        .limit(1);
      if (error) throw error;
      const row = (data as ClientRow[])[0];
      if (row) return rowToClient(row);
    } catch (err) {
      console.warn("[store] client create to Supabase failed — using file store.", err);
    }
  }

  const clients = await fileClients();
  clients.unshift(record);
  await writeJson(CLIENTS_FILE, clients);
  return record;
}

/* ------------------------- Client portal sessions ---------------------- */

/**
 * DB-backed session records enable revocation. They are checked only on
 * full portal page loads and the keepalive ping — normal in-page browsing
 * relies on the fast local cookie-signature check and never touches the DB.
 * Every call degrades safely: if Supabase isn't configured (or the table is
 * missing), sessions behave like the previous stateless-cookie model.
 */

export async function createSessionRecord(params: {
  sessionId: string;
  clientId: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from("sessions").insert({
      id: params.sessionId,
      client_id: params.clientId,
      expires_at: params.expiresAt.toISOString(),
      user_agent: params.userAgent?.slice(0, 400) ?? null,
      ip: params.ip?.slice(0, 64) ?? null,
    });
    if (error) throw error;
  } catch (err) {
    console.warn("[store] could not record session (revocation disabled for it).", err);
  }
}

/**
 * True if the session id is live (exists, not revoked, not expired). When
 * Supabase isn't available this returns true — enforcement degrades to the
 * cookie signature + expiry, never a lockout.
 */
export async function isSessionLive(sessionId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("revoked_at, expires_at")
      .eq("id", sessionId)
      .limit(1);
    if (error) throw error;
    const row = data[0] as { revoked_at: string | null; expires_at: string } | undefined;
    if (!row) return false; // recorded sessions that vanish are revoked
    if (row.revoked_at) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;
    return true;
  } catch (err) {
    console.warn("[store] session check failed — allowing on signature only.", err);
    return true;
  }
}

export async function revokeSession(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionId);
  } catch (err) {
    console.warn("[store] could not revoke session.", err);
  }
}

/** Revoke every session for a client (e.g. after a password change). */
export async function revokeClientSessions(clientId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from("sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .is("revoked_at", null);
  } catch (err) {
    console.warn("[store] could not revoke client sessions.", err);
  }
}

/** Persist a lead to the local file store. Returns false on write failure. */
export async function saveLead(lead: Lead): Promise<boolean> {
  const leads = await readJson<Lead[]>(LEADS_FILE, []);
  const withId: Lead = {
    ...lead,
    id: lead.id ?? randomUUID(),
    status: lead.status ?? "new",
  };
  leads.unshift(withId);
  return writeJson(LEADS_FILE, leads);
}

type LeadRow = {
  id: string;
  name: string;
  business_name: string;
  website: string | null;
  email: string;
  phone: string | null;
  industry: string | null;
  biggest_problem: string | null;
  improvement_goal: string | null;
  preferred_contact: string | null;
  best_time: string | null;
  timeline: string | null;
  page_url: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  lead_score: number | null;
  source: string | null;
  status: string | null;
  notes: string | null;
  owner: string | null;
  archived_at: string | null;
  created_at: string;
  qualification_snapshot?: Record<string, unknown> | null;
  service_plan_answers?: Record<string, unknown> | null;
  recommended_plan?: string | null;
};

/** Pull interactive-demo context out of the scheduling snapshot, if present. */
function demoMetaFromSnapshot(
  snapshot: Record<string, unknown> | null | undefined
): Lead["demo"] {
  const raw = snapshot?.demoRequest;
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  if (typeof d.slug !== "string" || typeof d.system !== "string") return undefined;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  return {
    slug: d.slug,
    system: d.system,
    businessCategory: typeof d.businessCategory === "string" ? d.businessCategory : "",
    featuresExplored: strings(d.featuresExplored),
    featuresRequested: strings(d.featuresRequested),
    scenariosRun: typeof d.scenariosRun === "number" ? d.scenariosRun : undefined,
    demoBusinessName: typeof d.demoBusinessName === "string" ? d.demoBusinessName : undefined,
    businessSize: typeof d.businessSize === "string" ? d.businessSize : undefined,
    preferredDate: typeof d.preferredDate === "string" ? d.preferredDate : undefined,
    preferredTime: typeof d.preferredTime === "string" ? d.preferredTime : undefined,
    extras:
      d.extras && typeof d.extras === "object" && !Array.isArray(d.extras)
        ? Object.fromEntries(
            Object.entries(d.extras as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined,
  };
}

function rowToLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    company: row.business_name,
    website: row.website ?? "",
    email: row.email,
    phone: row.phone ?? "",
    industry: row.industry ?? "",
    problem: row.biggest_problem ?? "",
    improve: row.improvement_goal ?? "",
    preferredContact: row.preferred_contact ?? "",
    bestTime: row.best_time ?? "",
    timeline: row.timeline ?? "",
    pageUrl: row.page_url ?? "",
    referrer: row.referrer ?? "",
    utmSource: row.utm_source ?? "",
    utmMedium: row.utm_medium ?? "",
    utmCampaign: row.utm_campaign ?? "",
    utmContent: row.utm_content ?? "",
    utmTerm: row.utm_term ?? "",
    score: row.lead_score ?? 0,
    source: row.source ?? "website_contact_form",
    status: (row.status as Lead["status"]) ?? "new",
    notes: row.notes ?? "",
    owner: row.owner ?? "",
    archivedAt: row.archived_at ?? undefined,
    submittedAt: row.created_at,
    demo: demoMetaFromSnapshot(row.qualification_snapshot),
    servicePlanAnswers: servicePlanAnswersFromRow(row.service_plan_answers),
    recommendedPlan: row.recommended_plan ?? undefined,
  };
}

/** Keep only string-valued answers (defensive against malformed JSONB). */
function servicePlanAnswersFromRow(
  value: Record<string, unknown> | null | undefined
): Record<string, string> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

/**
 * Leads for the admin console. Prefer Supabase (durable production storage),
 * then merge any file-store-only leads so local/dev submissions still appear.
 */
export async function getLeads(): Promise<Lead[]> {
  const fileLeads = await readJson<Lead[]>(LEADS_FILE, []);
  const supabase = getSupabase();
  if (!supabase) return fileLeads;

  try {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    const remote = ((data as LeadRow[]) ?? []).map(rowToLead);
    // Prefer remote records; append file-only leads that aren't already present.
    const remoteEmails = new Set(
      remote.map((l) => `${l.email.toLowerCase()}|${l.submittedAt}`)
    );
    const extras = fileLeads.filter(
      (l) => !remoteEmails.has(`${l.email.toLowerCase()}|${l.submittedAt}`)
    );
    return [...remote, ...extras].sort(
      (a, b) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  } catch (err) {
    console.warn("[store] leads read from Supabase failed — using file store.", err);
    return fileLeads;
  }
}

/** True if the same email submitted within the last `windowMs` (dedupe). */
export async function findRecentLeadByEmail(
  email: string,
  windowMs = 10 * 60_000
): Promise<Lead | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const since = new Date(Date.now() - windowMs).toISOString();

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .ilike("email", target)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = (data as LeadRow[])?.[0];
      if (row) return rowToLead(row);
    } catch (err) {
      console.warn("[store] recent lead lookup failed.", err);
    }
  }

  const fileLeads = await readJson<Lead[]>(LEADS_FILE, []);
  return (
    fileLeads.find(
      (l) =>
        l.email.toLowerCase() === target &&
        new Date(l.submittedAt).getTime() >= Date.now() - windowMs
    ) ?? null
  );
}

export type LeadPatch = {
  status?: Lead["status"];
  notes?: string;
  owner?: string;
  archivedAt?: string | null;
  /** Managed-service plan recommendation override (plan key or ""). */
  recommendedPlan?: string;
};

/** Update lead pipeline fields. Prefers Supabase; falls back to file store. */
export async function updateLead(
  id: string,
  patch: LeadPatch
): Promise<Lead | null> {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (patch.status) updates.status = patch.status;
      if (typeof patch.notes === "string") updates.notes = patch.notes.slice(0, 8000);
      if (typeof patch.owner === "string") updates.owner = patch.owner.slice(0, 200);
      if (patch.archivedAt === null) updates.archived_at = null;
      else if (typeof patch.archivedAt === "string") updates.archived_at = patch.archivedAt;
      if (patch.status === "archived" && !patch.archivedAt) {
        updates.archived_at = new Date().toISOString();
      }
      if (typeof patch.recommendedPlan === "string") {
        updates.recommended_plan = patch.recommendedPlan.slice(0, 100) || null;
      }

      const { data, error } = await supabase
        .from("leads")
        .update(updates)
        .eq("id", id)
        .select("*")
        .limit(1);
      if (error) throw error;
      const row = (data as LeadRow[])?.[0];
      if (row) return rowToLead(row);
    } catch (err) {
      console.warn("[store] lead update to Supabase failed — trying file store.", err);
    }
  }

  const leads = await readJson<Lead[]>(LEADS_FILE, []);
  const idx = leads.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const current = leads[idx];
  const next: Lead = {
    ...current,
    status: patch.status ?? current.status,
    notes: typeof patch.notes === "string" ? patch.notes.slice(0, 8000) : current.notes,
    owner: typeof patch.owner === "string" ? patch.owner.slice(0, 200) : current.owner,
    recommendedPlan:
      typeof patch.recommendedPlan === "string"
        ? patch.recommendedPlan.slice(0, 100) || undefined
        : current.recommendedPlan,
    archivedAt:
      patch.archivedAt === null
        ? undefined
        : typeof patch.archivedAt === "string"
          ? patch.archivedAt
          : patch.status === "archived"
            ? new Date().toISOString()
            : current.archivedAt,
  };
  leads[idx] = next;
  await writeJson(LEADS_FILE, leads);
  return next;
}

/* ---------------------------- Subscribers ------------------------------ */

/**
 * Add an email to the marketing list. De-duplicates by email.
 * Returns: "created" | "duplicate" | "failed".
 */
export async function saveSubscriber(
  sub: Subscriber
): Promise<"created" | "duplicate" | "failed"> {
  const subs = await readJson<Subscriber[]>(SUBSCRIBERS_FILE, []);
  const exists = subs.some(
    (s) => s.email.toLowerCase() === sub.email.toLowerCase()
  );
  if (exists) return "duplicate";
  subs.unshift(sub);
  const ok = await writeJson(SUBSCRIBERS_FILE, subs);
  return ok ? "created" : "failed";
}

export async function getSubscribers(): Promise<Subscriber[]> {
  return readJson<Subscriber[]>(SUBSCRIBERS_FILE, []);
}

/* ----------------------------- Analytics ------------------------------- */

const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");
/** Keep the event log bounded; ~20k page views is months of small-site data. */
const MAX_ANALYTICS_EVENTS = 20_000;

export async function recordPageView(view: PageView): Promise<void> {
  const events = await readJson<PageView[]>(ANALYTICS_FILE, []);
  events.unshift(view);
  await writeJson(ANALYTICS_FILE, events.slice(0, MAX_ANALYTICS_EVENTS));
}

export async function getPageViews(): Promise<PageView[]> {
  return readJson<PageView[]>(ANALYTICS_FILE, []);
}

/* -------------------------------- Admins ------------------------------- */

type AdminRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  mfa_secret: string | null;
  mfa_enabled: boolean;
  active: boolean;
};

function mapAdminRow(row: AdminRow): AdminRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: (row.role as AdminRecord["role"]) || "administrator",
    mfaEnabled: Boolean(row.mfa_enabled),
    mfaSecret: row.mfa_secret,
  };
}

/** Cached env-admin password hash (stable salt across lookups in-process). */
let envAdminHash: { email: string; hash: string } | null = null;

function envAdminRecord(): AdminRecord | null {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword.length < 8) {
    return null;
  }
  const email = adminEmail.trim().toLowerCase();
  if (!envAdminHash || envAdminHash.email !== email) {
    envAdminHash = { email, hash: hashPassword(adminPassword) };
  }
  return {
    id: "rsg-env-admin",
    name: "RSG Administrator",
    email: adminEmail.trim(),
    passwordHash: envAdminHash.hash,
    role: "owner",
    mfaEnabled: false,
    mfaSecret: null,
  };
}

/**
 * Resolve an admin by email: DB admins first, then env bootstrap owner.
 * Fails closed when neither is configured.
 */
export async function findAdminByEmail(
  email: string
): Promise<AdminRecord | null> {
  const normalized = email.trim().toLowerCase();
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .eq("active", true)
        .limit(20);
      if (!error && data) {
        const match = (data as AdminRow[]).find(
          (r) => r.email.trim().toLowerCase() === normalized
        );
        if (match) return mapAdminRow(match);
      }
    } catch (err) {
      console.warn("[store] admin lookup failed", err);
    }
  }

  const envAdmin = envAdminRecord();
  if (!envAdmin) {
    console.warn(
      "[auth] Admin login disabled — set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars), or seed public.admins."
    );
    return null;
  }
  if (envAdmin.email.trim().toLowerCase() !== normalized) return null;
  return envAdmin;
}

/**
 * All active admin accounts (DB admins plus the env bootstrap owner when
 * configured). Callers MUST strip passwordHash/mfaSecret before sending
 * anywhere near a client.
 */
export async function listAdmins(): Promise<AdminRecord[]> {
  const admins: AdminRecord[] = [];
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("admins")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      admins.push(...((data as AdminRow[]) ?? []).map(mapAdminRow));
    } catch (err) {
      console.warn("[store] admins list failed", err);
    }
  }
  const envAdmin = envAdminRecord();
  if (
    envAdmin &&
    !admins.some(
      (a) => a.email.trim().toLowerCase() === envAdmin.email.trim().toLowerCase()
    )
  ) {
    admins.push(envAdmin);
  }
  return admins;
}

export async function getAdminById(id: string): Promise<AdminRecord | null> {
  if (id === "rsg-env-admin" || id === "rsg-admin") return envAdminRecord();
  const supabase = getSupabase();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .eq("id", id)
      .eq("active", true)
      .limit(1);
    if (error) throw error;
    const row = data?.[0] as AdminRow | undefined;
    return row ? mapAdminRow(row) : null;
  } catch {
    return null;
  }
}

export async function createAdminSessionRecord(params: {
  sessionId: string;
  adminId: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    const { error } = await supabase.from("admin_sessions").insert({
      id: params.sessionId,
      admin_id: params.adminId,
      expires_at: params.expiresAt.toISOString(),
      user_agent: params.userAgent?.slice(0, 400) ?? null,
      ip: params.ip?.slice(0, 64) ?? null,
    });
    if (error) throw error;
  } catch (err) {
    console.warn("[store] could not record admin session.", err);
  }
}

export async function isAdminSessionLive(sessionId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  try {
    const { data, error } = await supabase
      .from("admin_sessions")
      .select("revoked_at, expires_at")
      .eq("id", sessionId)
      .limit(1);
    if (error) throw error;
    const row = data?.[0] as
      | { revoked_at: string | null; expires_at: string }
      | undefined;
    if (!row) return false;
    if (row.revoked_at) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;
    return true;
  } catch (err) {
    console.warn("[store] admin session check failed — allowing on signature.", err);
    return true;
  }
}

export async function revokeAdminSession(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", sessionId);
  } catch (err) {
    console.warn("[store] could not revoke admin session.", err);
  }
}

export async function updateAdminMfa(params: {
  adminId: string;
  secret?: string | null;
  enabled: boolean;
}): Promise<boolean> {
  if (params.adminId === "rsg-env-admin" || params.adminId === "rsg-admin") {
    console.warn("[store] MFA for env admin requires a DB admin row.");
    return false;
  }
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("admins")
    .update({
      mfa_secret: params.secret ?? null,
      mfa_enabled: params.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.adminId);
  return !error;
}
