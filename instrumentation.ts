export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv, requireSupabaseInProduction } = await import("./lib/env");
    getEnv();
    // Fail closed: a production boot without Supabase must not start and then
    // silently degrade lead persistence to email-only. (audit M1)
    requireSupabaseInProduction();
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  ...args: Parameters<
    NonNullable<typeof import("@sentry/nextjs").captureRequestError>
  >
) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  return captureRequestError(...args);
};
