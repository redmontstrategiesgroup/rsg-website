-- Webhook fan-out: drop the global idempotency_key uniqueness.
--
-- 20260714180000_scheduling_platform.sql made `idempotency_key` unique across
-- the whole webhook_deliveries table. The outbox writes the event's stable id
-- there (it is what receivers get as their Idempotency-Key header), and since
-- Phase 3 that id is deliberately identical for every endpoint that should
-- receive the event. With the global index, the second endpoint's insert hit
-- 23505 and was skipped as "already queued", so a client endpoint plus an
-- admin endpoint subscribed to the same event received exactly one delivery
-- between them.
--
-- Per-endpoint dedupe is provided by webhook_deliveries_event_uniq
-- (endpoint_id, event_id) from 20260728000000_webhook_outbox_hardening.sql,
-- which is the constraint the outbox actually relies on.

drop index if exists public.webhook_deliveries_idempotency_uidx;
