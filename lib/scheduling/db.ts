import { getSupabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export class SchedulingUnavailableError extends Error {
  constructor(message = "Scheduling requires Supabase to be configured.") {
    super(message);
    this.name = "SchedulingUnavailableError";
  }
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) throw new SchedulingUnavailableError();
  return sb;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function extractDomain(websiteOrEmail: string): string {
  const raw = websiteOrEmail.trim().toLowerCase();
  if (raw.includes("@")) {
    return raw.split("@")[1] ?? "";
  }
  try {
    const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return raw.replace(/^www\./, "").split("/")[0] ?? "";
  }
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://redmontstrategiesgroup.com"
  );
}

export function adminTimezone(): string {
  return process.env.SCHEDULING_TIMEZONE?.trim() || "America/New_York";
}
