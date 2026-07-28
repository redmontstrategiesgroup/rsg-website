import { randomBytes } from "node:crypto";
import {
  getSession,
  hashPassword,
  verifyPassword,
  verifyPasswordDecoy,
} from "@/lib/auth";
import {
  createClient,
  findClientByEmail,
  getClientById,
  isSessionLive,
} from "@/lib/store";
import { newToken, nowIso, requireSupabase } from "@/lib/lifecycle/core";
import type { ClientUser, ClientUserRole } from "@/lib/lifecycle/types";

/**
 * Portal access control: resolves who is signed in (legacy single-login
 * client accounts OR client_users team members), enforces per-client data
 * separation, and provisions clients/teams during portal activation.
 *
 * Every portal API must obtain a PortalContext and scope EVERY query by
 * context.client.id — this module is the single choke point for that rule.
 */

export type PortalRole = ClientUserRole;

export type PortalContext = {
  client: {
    id: string;
    name: string;
    company: string;
    email: string;
    status: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: PortalRole;
    isLegacyOwner: boolean;
  };
};

// ---------------------------------------------------------------------------
// Context resolution
// ---------------------------------------------------------------------------

async function getClientUserById(id: string): Promise<ClientUser | null> {
  const sb = requireSupabase();
  const { data } = await sb
    .from("client_users")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  return (data as ClientUser | null) ?? null;
}

async function clientRow(id: string): Promise<Record<string, unknown> | null> {
  const sb = requireSupabase();
  const { data } = await sb.from("clients").select("*").eq("id", id).maybeSingle();
  return (data as Record<string, unknown> | null) ?? null;
}

/**
 * Resolve a session subject to a portal context.
 * Order: legacy client account (sub = clients.id) first, then team member
 * (sub = client_users.id).
 */
export async function resolvePortalContext(session: {
  sub: string;
  email: string;
}): Promise<PortalContext | null> {
  const client = await getClientById(session.sub);
  if (client) {
    const row = await clientRow(client.id).catch(() => null);
    return {
      client: {
        id: client.id,
        name: client.name,
        company: client.company,
        email: client.email,
        status: typeof row?.status === "string" ? (row.status as string) : "active",
      },
      user: {
        id: client.id,
        name: client.name,
        email: client.email,
        role: "owner",
        isLegacyOwner: true,
      },
    };
  }

  let user: ClientUser | null = null;
  try {
    user = await getClientUserById(session.sub);
  } catch {
    // Supabase unavailable → only legacy path can work.
    return null;
  }
  if (!user) return null;

  const row = await clientRow(user.client_id);
  if (!row) return null;
  return {
    client: {
      id: String(row.id),
      name: String(row.name ?? ""),
      company: String(row.company ?? ""),
      email: String(row.email ?? ""),
      status: typeof row.status === "string" ? row.status : "active",
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isLegacyOwner: false,
    },
  };
}

/**
 * Server-side guard for portal pages and /api/portal routes.
 * Returns null (callers decide: 401 for APIs, redirect for pages).
 */
export async function requirePortalContext(): Promise<PortalContext | null> {
  const session = await getSession();
  if (!session) return null;
  if (session.sid && !(await isSessionLive(session.sid))) return null;
  return resolvePortalContext(session);
}

// ---------------------------------------------------------------------------
// Portal permissions (pure)
// ---------------------------------------------------------------------------

export function canManageTeam(role: PortalRole): boolean {
  return role === "owner" || role === "admin";
}
export function canApproveDeliverables(role: PortalRole): boolean {
  return role === "owner" || role === "admin";
}
export function canViewBilling(role: PortalRole): boolean {
  return role === "owner" || role === "admin";
}
export function canOpenTickets(_role: PortalRole): boolean {
  return true;
}
export function canUploadFiles(_role: PortalRole): boolean {
  return true;
}

// ---------------------------------------------------------------------------
// Authentication (login route delegates here)
// ---------------------------------------------------------------------------

export type PortalAccount = {
  kind: "client" | "client_user";
  accountId: string;
  clientId: string;
  name: string;
  email: string;
};

/**
 * Email+password check across both account kinds. Legacy client logins take
 * precedence (existing behavior must not change). Constant-time-ish: a decoy
 * hash comparison runs when no account matches.
 */
export async function authenticatePortalUser(
  email: string,
  password: string,
): Promise<PortalAccount | null> {
  const normalized = email.trim().toLowerCase();

  // Legacy client account first (pre-lifecycle logins). On mismatch we still
  // fall through to client_users — newly provisioned clients hold an unusable
  // random password on the clients row and sign in through their owner seat.
  const client = await findClientByEmail(normalized);
  if (client?.passwordHash && verifyPassword(password, client.passwordHash)) {
    return {
      kind: "client",
      accountId: client.id,
      clientId: client.id,
      name: client.name,
      email: client.email,
    };
  }

  let user: (ClientUser & { password_hash: string }) | null = null;
  try {
    const sb = requireSupabase();
    const { data } = await sb
      .from("client_users")
      .select("*")
      .ilike("email", normalized)
      .eq("active", true)
      .not("password_hash", "is", null)
      .limit(1)
      .maybeSingle();
    user = (data as (ClientUser & { password_hash: string }) | null) ?? null;
  } catch {
    user = null;
  }

  if (!user) {
    verifyPasswordDecoy(password);
    return null;
  }
  if (!verifyPassword(password, user.password_hash)) return null;

  const sb = requireSupabase();
  await sb
    .from("client_users")
    .update({ last_login_at: nowIso(), updated_at: nowIso() })
    .eq("id", user.id);

  return {
    kind: "client_user",
    accountId: user.id,
    clientId: user.client_id,
    name: user.name,
    email: user.email,
  };
}

// ---------------------------------------------------------------------------
// Team management
// ---------------------------------------------------------------------------

export type SafeClientUser = Omit<ClientUser, "password_hash" | "invite_token"> & {
  has_accepted: boolean;
};

function toSafe(user: ClientUser): SafeClientUser {
  // password_hash + invite_token are intentionally dropped from the returned object.
  const { password_hash, invite_token: _invite_token, ...rest } = user;
  return { ...rest, has_accepted: Boolean(password_hash) };
}

export async function listTeam(clientId: string): Promise<{
  users: SafeClientUser[];
  legacyOwner: { email: string; name: string } | null;
}> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from("client_users")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to list team: ${error.message}`);

  const client = await getClientById(clientId);
  return {
    users: ((data ?? []) as ClientUser[]).map(toSafe),
    legacyOwner: client ? { email: client.email, name: client.name } : null,
  };
}

const INVITE_DAYS = 7;

export async function createTeamInvite(input: {
  clientId: string;
  email: string;
  name: string;
  title?: string;
  role: Exclude<PortalRole, "owner">;
  invitedBy: string;
}): Promise<{ user: SafeClientUser; inviteToken: string }> {
  const sb = requireSupabase();
  const email = input.email.trim().toLowerCase();

  const client = await getClientById(input.clientId);
  if (client && client.email.toLowerCase() === email) {
    throw new Error("That email already has portal access as the account owner.");
  }
  const { data: existing } = await sb
    .from("client_users")
    .select("id")
    .ilike("email", email)
    .limit(1)
    .maybeSingle();
  if (existing) {
    throw new Error("That email already has a portal account.");
  }

  const inviteToken = newToken();
  const { data, error } = await sb
    .from("client_users")
    .insert({
      client_id: input.clientId,
      email,
      name: input.name.trim(),
      title: input.title?.trim() || null,
      role: input.role,
      invite_token: inviteToken,
      invite_expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
      invited_by: input.invitedBy,
      active: false,
      updated_at: nowIso(),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to create invite: ${error?.message ?? "no row returned"}`);
  }
  return { user: toSafe(data as ClientUser), inviteToken };
}

export async function getInviteByToken(token: string): Promise<{
  user: SafeClientUser;
  company: string;
} | null> {
  if (!token || token.length < 16) return null;
  const sb = requireSupabase();
  const { data } = await sb
    .from("client_users")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  if (!data) return null;
  const user = data as ClientUser;
  if (user.password_hash) return null; // already accepted
  if (user.invite_expires_at && new Date(user.invite_expires_at).getTime() < Date.now()) {
    return null;
  }
  const client = await getClientById(user.client_id);
  return { user: toSafe(user), company: client?.company ?? "" };
}

export async function acceptInvite(
  token: string,
  input: { password: string },
): Promise<SafeClientUser> {
  if (input.password.length < 10) {
    throw new Error("Password must be at least 10 characters.");
  }
  const sb = requireSupabase();
  const { data } = await sb
    .from("client_users")
    .select("*")
    .eq("invite_token", token)
    .maybeSingle();
  const user = (data as ClientUser | null) ?? null;
  if (!user || user.password_hash) throw new Error("This invitation is no longer valid.");
  if (user.invite_expires_at && new Date(user.invite_expires_at).getTime() < Date.now()) {
    throw new Error("This invitation has expired. Ask your account owner to re-invite you.");
  }

  const { data: updated, error } = await sb
    .from("client_users")
    .update({
      password_hash: hashPassword(input.password),
      active: true,
      invite_token: null,
      invite_expires_at: null,
      updated_at: nowIso(),
    })
    .eq("id", user.id)
    .select("*")
    .single();
  if (error || !updated) {
    throw new Error(`Failed to accept invite: ${error?.message ?? "no row returned"}`);
  }
  return toSafe(updated as ClientUser);
}

export async function updateTeamMember(
  id: string,
  patch: { role?: Exclude<PortalRole, "owner">; title?: string; active?: boolean },
): Promise<SafeClientUser> {
  const sb = requireSupabase();
  const row: Record<string, unknown> = { updated_at: nowIso() };
  if (patch.role !== undefined) row.role = patch.role;
  if (patch.title !== undefined) row.title = patch.title.trim() || null;
  if (patch.active !== undefined) row.active = patch.active;
  const { data, error } = await sb
    .from("client_users")
    .update(row)
    .eq("id", id)
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(`Failed to update team member: ${error?.message ?? "no row"}`);
  }
  return toSafe(data as ClientUser);
}

/**
 * Deactivate (soft removal). Note: portal session records are keyed by the
 * parent client, so an existing signed cookie survives until expiry — but
 * resolvePortalContext filters on active=true, so access ends immediately.
 */
export async function removeTeamMember(id: string): Promise<void> {
  await updateTeamMember(id, { active: false });
}

// ---------------------------------------------------------------------------
// Provisioning (deposit paid → portal activation)
// ---------------------------------------------------------------------------

export async function provisionClientForOpportunity(input: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  website?: string;
  industry?: string;
  leadId?: string | null;
}): Promise<{
  client: { id: string; created: boolean };
  ownerInvite: { userId: string; token: string } | null;
}> {
  const sb = requireSupabase();
  const email = input.email.trim().toLowerCase();

  const existing = await findClientByEmail(email);
  if (existing) {
    await sb
      .from("clients")
      .update({
        status: "onboarding",
        lead_id: input.leadId ?? null,
        portal_activated_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", existing.id);
    return { client: { id: existing.id, created: false }, ownerInvite: null };
  }

  // Brand-new client: the account gets an unusable random password; the
  // welcome email carries a set-password invite instead of a credential.
  const unusablePassword = randomBytes(24).toString("base64url");
  const record = await createClient({
    name: input.contactName.trim(),
    company: input.businessName.trim(),
    email,
    password: unusablePassword,
  });

  await sb
    .from("clients")
    .update({
      status: "onboarding",
      lead_id: input.leadId ?? null,
      phone: input.phone?.trim() || null,
      website: input.website?.trim() || null,
      industry: input.industry?.trim() || null,
      portal_activated_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", record.id);

  // Owner seat in client_users so the set-password invite flow works. The
  // login email differs from none — same email as the client row is fine
  // because authenticatePortalUser checks clients first only when a password
  // hash matches; this owner seat is the practical login path.
  const inviteToken = newToken();
  const { data: seat, error } = await sb
    .from("client_users")
    .insert({
      client_id: record.id,
      email,
      name: input.contactName.trim(),
      role: "owner",
      invite_token: inviteToken,
      invite_expires_at: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString(),
      invited_by: "system",
      active: false,
      updated_at: nowIso(),
    })
    .select("id")
    .single();
  if (error || !seat) {
    // Non-fatal: the client exists; admin can send a reset manually.
    console.error("provisionClientForOpportunity: owner seat failed", error?.message);
    return { client: { id: record.id, created: true }, ownerInvite: null };
  }
  return {
    client: { id: record.id, created: true },
    ownerInvite: { userId: (seat as { id: string }).id, token: inviteToken },
  };
}
