-- Authenticated browser clients may inspect non-secret integration status but
-- can never select the encrypted credential column. The RSG server manages
-- credentials with the service role after its own admin authorization check.
revoke select on public.integrations from authenticated;
grant select (id, integration_type, name, status, settings, last_success_at, last_failure_at, failure_message, created_at, updated_at)
  on public.integrations to authenticated;
