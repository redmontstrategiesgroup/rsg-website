-- Cover every executive-intelligence foreign key that is not already the
-- leading column of a primary, unique, or composite index.
create index if not exists briefs_created_by_idx on public.briefs(created_by);
create index if not exists intelligence_source_id_idx on public.intelligence_items(source_id);
create index if not exists action_items_owner_id_idx on public.action_items(owner_id);
create index if not exists notes_brief_id_idx on public.notes(brief_id);
create index if not exists notes_intelligence_item_id_idx on public.notes(intelligence_item_id);
create index if not exists notes_action_item_id_idx on public.notes(action_item_id);
create index if not exists notes_opportunity_id_idx on public.notes(opportunity_id);
create index if not exists ingestion_logs_integration_id_idx on public.ingestion_logs(integration_id);
create index if not exists ingestion_logs_brief_id_idx on public.ingestion_logs(brief_id);
