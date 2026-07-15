/**
 * Demo-data gate. Demo/sample data (seeded portal clients) is loaded ONLY in
 * local development AND only when explicitly opted in via the env flag.
 * Production is always false, so no fake data can ever reach real users.
 *
 *   NEXT_PUBLIC_ENABLE_DEMO_DATA=true   # local dev only, opt-in
 */
export function isDemoDataEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true"
  );
}
