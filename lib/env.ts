import { z } from "zod";

/**
 * Boot-time / first-use env validation. Soft fields stay optional so local
 * and partial deploys still work; production-critical secrets fail closed
 * where the domain already required them (auth, cron, ingest).
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  AUTH_SECRET: z.string().min(16).optional(),
  ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  ADMIN_PASSWORD: z.string().min(8).optional().or(z.literal("")),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional().or(z.literal("")),
  CRON_SECRET: z.string().min(16).optional().or(z.literal("")),
  BRIEF_INGESTION_SECRET: z.string().min(24).optional().or(z.literal("")),
  RESEND_API_KEY: z.string().optional().or(z.literal("")),
  ANTHROPIC_API_KEY: z.string().optional().or(z.literal("")),
  TURNSTILE_SECRET_KEY: z.string().optional().or(z.literal("")),
  STRIPE_SECRET_KEY: z.string().min(20).optional().or(z.literal("")),
  STRIPE_WEBHOOK_SECRET: z.string().min(20).optional().or(z.literal("")),
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(8).optional().or(z.literal("")),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_ENABLE_DEMO_DATA: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    AUTH_SECRET: process.env.AUTH_SECRET || undefined,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || "",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    CRON_SECRET: process.env.CRON_SECRET || "",
    BRIEF_INGESTION_SECRET: process.env.BRIEF_INGESTION_SECRET || "",
    RESEND_API_KEY: process.env.RESEND_API_KEY || "",
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
    SENTRY_DSN: process.env.SENTRY_DSN || "",
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "",
    NEXT_PUBLIC_ENABLE_DEMO_DATA: process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`[env] Invalid environment: ${issues}`);
  }

  const env = parsed.data;
  if (env.NODE_ENV === "production") {
    if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 16) {
      throw new Error("[env] AUTH_SECRET (16+) is required in production.");
    }
    if (env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true") {
      console.warn(
        "[env] NEXT_PUBLIC_ENABLE_DEMO_DATA=true in production — disable for live traffic."
      );
    }
  }

  cached = env;
  return env;
}

/** True when Upstash Redis is configured for durable rate limits. */
export function hasUpstash(): boolean {
  const env = getEnv();
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/** Production must use Supabase for durable data. */
export function requireSupabaseInProduction(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "[env] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production."
    );
  }
}
