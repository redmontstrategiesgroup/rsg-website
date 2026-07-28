-- Defense-in-depth: enable Row Level Security on every tenant/PII table.
--
-- The application connects with the Supabase SERVICE-ROLE key, which BYPASSES
-- RLS — so this migration does NOT change any application behaviour. What it
-- does is close the one gap the security review flagged: tenant isolation
-- currently rests entirely on every app query carrying `.eq("client_id", …)`,
-- with nothing behind it. If a publishable/anon key (or a future non-service
-- connection) ever touches these tables, RLS with NO permissive policy denies
-- every row instead of exposing the lot.
--
-- Enabling RLS with no policy = deny-all for any role except service_role /
-- table owner. That is exactly the safe default we want here; add scoped
-- policies later if/when the app introduces a non-service-role client path.
--
-- Idempotent and drift-tolerant: only tables that actually exist on this
-- deployment are touched (many tenant tables live in not-yet-migrated schema),
-- so this never fails on a partially-migrated database.

do $$
declare
  t text;
  tenant_tables text[] := array[
    -- identity & sessions
    'clients', 'client_users', 'sessions', 'admin_sessions', 'admins',
    -- intake / marketing PII
    'leads', 'bookings', 'subscribers',
    -- AI metering & compliance
    'ai_usage', 'audit_events', 'audit_log',
    -- mounted-app tenant data
    'observatory_scenarios', 'observatory_reports',
    -- client lifecycle / managed services
    'client_subscriptions', 'client_roadmaps', 'service_requests',
    'service_reports', 'subscription_events', 'subscription_invoices',
    'maintenance_logs', 'notes', 'proposals'
  ];
begin
  foreach t in array tenant_tables loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      -- FORCE so even the table owner is subject to RLS; service_role still
      -- bypasses (it is not the owner and has the bypassrls attribute), which
      -- is what keeps the app working unchanged.
      execute format('alter table public.%I force row level security;', t);
    end if;
  end loop;
end $$;
