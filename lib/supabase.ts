import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared server-side Supabase client (service-role key — bypasses RLS).
 * Returns null when Supabase isn't configured, so callers can fall back to
 * the local file store. Never import this into client components.
 */

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required in production."
      );
    }
    return null;
  }
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } });
  }
  return cached;
}

/** Throw if production is missing Supabase (call from durable write paths). */
export function assertSupabaseConfigured(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is required in production. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}
