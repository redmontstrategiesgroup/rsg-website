import { promises as fs } from "node:fs";
import path from "node:path";
import { hashPassword } from "./auth";
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
 * Tiny file-backed store. Good enough for a demo/portfolio portal — swap the
 * read/write helpers for a real database (Postgres, Supabase, etc.) later
 * without touching the callers.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Seed the clients file on first run, hashing the shared demo password. */
async function ensureSeed(): Promise<ClientRecord[]> {
  await ensureDir();
  const existing = await readJson<ClientRecord[] | null>(CLIENTS_FILE, null);
  if (existing && Array.isArray(existing) && existing.length) return existing;

  const hash = hashPassword(DEMO_PASSWORD);
  const seeded: ClientRecord[] = SEED_CLIENTS.map((c) => ({
    ...c,
    passwordHash: hash,
  }));
  await fs.writeFile(CLIENTS_FILE, JSON.stringify(seeded, null, 2), "utf8");
  return seeded;
}

export async function getClients(): Promise<ClientRecord[]> {
  return ensureSeed();
}

export async function findClientByEmail(
  email: string
): Promise<ClientRecord | null> {
  const clients = await getClients();
  const target = email.trim().toLowerCase();
  return clients.find((c) => c.email.toLowerCase() === target) ?? null;
}

export async function getClientById(
  id: string
): Promise<ClientRecord | null> {
  const clients = await getClients();
  return clients.find((c) => c.id === id) ?? null;
}

/** Apply an admin edit to a client and persist. Returns the updated record. */
export async function updateClient(
  id: string,
  patch: ClientPatch
): Promise<ClientRecord | null> {
  const clients = await getClients();
  const idx = clients.findIndex((c) => c.id === id);
  if (idx === -1) return null;

  const current = clients[idx];
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

  // Optional password reset.
  if (typeof patch.password === "string" && patch.password.length >= 6) {
    next.passwordHash = hashPassword(patch.password);
  }

  clients[idx] = next;
  await fs.writeFile(CLIENTS_FILE, JSON.stringify(clients, null, 2), "utf8");
  return next;
}

export async function saveLead(lead: Lead): Promise<void> {
  await ensureDir();
  const leads = await readJson<Lead[]>(LEADS_FILE, []);
  leads.unshift(lead);
  await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), "utf8");
}

export async function getLeads(): Promise<Lead[]> {
  return readJson<Lead[]>(LEADS_FILE, []);
}

/* ---------------------------- Subscribers ------------------------------ */

/** Add an email to the marketing list. De-duplicates by email. */
export async function saveSubscriber(sub: Subscriber): Promise<void> {
  await ensureDir();
  const subs = await readJson<Subscriber[]>(SUBSCRIBERS_FILE, []);
  const exists = subs.some(
    (s) => s.email.toLowerCase() === sub.email.toLowerCase()
  );
  if (exists) return;
  subs.unshift(sub);
  await fs.writeFile(SUBSCRIBERS_FILE, JSON.stringify(subs, null, 2), "utf8");
}

export async function getSubscribers(): Promise<Subscriber[]> {
  return readJson<Subscriber[]>(SUBSCRIBERS_FILE, []);
}

/* ----------------------------- Analytics ------------------------------- */

const ANALYTICS_FILE = path.join(DATA_DIR, "analytics.json");
/** Keep the event log bounded; ~20k page views is months of small-site data. */
const MAX_ANALYTICS_EVENTS = 20_000;

export async function recordPageView(view: PageView): Promise<void> {
  await ensureDir();
  const events = await readJson<PageView[]>(ANALYTICS_FILE, []);
  events.unshift(view);
  await fs.writeFile(
    ANALYTICS_FILE,
    JSON.stringify(events.slice(0, MAX_ANALYTICS_EVENTS)),
    "utf8"
  );
}

export async function getPageViews(): Promise<PageView[]> {
  return readJson<PageView[]>(ANALYTICS_FILE, []);
}

/* -------------------------------- Admins ------------------------------- */

async function ensureAdminSeed(): Promise<AdminRecord[]> {
  await ensureDir();
  const existing = await readJson<AdminRecord[] | null>(ADMINS_FILE, null);
  if (existing && Array.isArray(existing) && existing.length) return existing;

  // No default credentials: an admin account only exists if the operator
  // explicitly provides both env vars. Anything else fails closed.
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 8) {
    console.warn(
      "[auth] No admin account seeded. Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars) in the environment to create one."
    );
    return [];
  }
  const seeded: AdminRecord[] = [
    {
      id: "rsg-admin",
      name: "RSG Administrator",
      email,
      passwordHash: hashPassword(password),
    },
  ];
  await fs.writeFile(ADMINS_FILE, JSON.stringify(seeded, null, 2), "utf8");
  return seeded;
}

export async function findAdminByEmail(
  email: string
): Promise<AdminRecord | null> {
  const admins = await ensureAdminSeed();
  const target = email.trim().toLowerCase();
  return admins.find((a) => a.email.toLowerCase() === target) ?? null;
}
