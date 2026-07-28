import { randomBytes } from "node:crypto";
import { getSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export class LifecycleUnavailableError extends Error {
  constructor(message = "This feature requires Supabase to be configured.") {
    super(message);
    this.name = "LifecycleUnavailableError";
  }
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new LifecycleUnavailableError();
  return sb;
}

/** Unguessable URL token for assessment/questionnaire/proposal/contract/pay links. */
export function newToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://redmontstrategiesgroup.com"
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** First day of the month for a date, as YYYY-MM-01 (metrics/reports period key). */
export function periodMonth(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Human label like "July 2026" for a YYYY-MM-DD period key. */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map((n) => Number.parseInt(n, 10));
  const d = new Date(Date.UTC(y || 2026, (m || 1) - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Storage bucket for all lifecycle files (private; signed URLs only). */
export const FILES_BUCKET = "rsg-files";

/** Single place to build portal/admin deep links used in emails. */
export const links = {
  portal: () => `${siteUrl()}/portal`,
  assessment: (token: string) => `${siteUrl()}/assessment/${token}`,
  questionnaire: (token: string) => `${siteUrl()}/prepare/${token}`,
  // /proposals/... — /proposal/[token] belongs to the managed-services system.
  proposal: (token: string) => `${siteUrl()}/proposals/${token}`,
  contract: (token: string) => `${siteUrl()}/agreement/${token}`,
  pay: (token: string) => `${siteUrl()}/pay/${token}`,
  invite: (token: string) => `${siteUrl()}/portal/invite/${token}`,
  book: (slug?: string) => (slug ? `${siteUrl()}/book/${slug}` : `${siteUrl()}/book`),
  admin: (section?: string) =>
    section ? `${siteUrl()}/admin?tab=lifecycle&section=${section}` : `${siteUrl()}/admin?tab=lifecycle`,
};

/** Firstname helper used across email variable maps. */
export function firstNameOf(fullName: string | null | undefined): string {
  return (fullName || "").trim().split(/\s+/)[0] || "there";
}
