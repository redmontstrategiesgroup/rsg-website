create or replace function public.ingest_executive_brief(
  payload jsonb,
  idempotency_key text,
  payload_hash text,
  source_type text default 'webhook'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_variable
declare
  log_id uuid;
  new_brief_id uuid;
  existing_brief_id uuid;
  item jsonb;
  source_record_id uuid;
  tag_record_id uuid;
  brief_slug text;
begin
  insert into public.ingestion_logs (idempotency_key, status, payload_hash, raw_payload)
  values (idempotency_key, 'processing', payload_hash, payload)
  on conflict on constraint ingestion_logs_idempotency_key_key do nothing
  returning id into log_id;

  if log_id is null then
    select brief_id into existing_brief_id from public.ingestion_logs where ingestion_logs.idempotency_key = ingest_executive_brief.idempotency_key;
    return jsonb_build_object('duplicate', true, 'briefId', existing_brief_id);
  end if;

  brief_slug := trim(both '-' from regexp_replace(lower(coalesce(payload->>'title','brief')), '[^a-z0-9]+', '-', 'g'));

  insert into public.briefs (
    title, slug, brief_type, schedule_name, source_type, source_identifier,
    executive_summary, content_markdown, content_json, brief_date,
    generated_at, priority, status, raw_payload
  ) values (
    payload->>'title', brief_slug, coalesce(payload->>'briefType','daily_executive'),
    payload->>'scheduleName', source_type, payload->>'sourceIdentifier',
    payload->>'executiveSummary', coalesce(payload->>'contentMarkdown',''), payload,
    (payload->>'briefDate')::date, nullif(payload->>'generatedAt','')::timestamptz,
    coalesce(payload->>'priority','medium'), 'published', payload
  )
  returning id into new_brief_id;

  for item in select value from jsonb_array_elements(coalesce(payload->'sections','[]'::jsonb)) loop
    insert into public.brief_sections (brief_id, section_type, heading, content, position)
    values (new_brief_id, coalesce(item->>'type','other'), coalesce(item->>'heading','Section'), coalesce(item->>'content',''), coalesce((item->>'position')::integer,0));
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'actions','[]'::jsonb)) loop
    insert into public.action_items (brief_id, title, description, why_it_matters, status, priority, impact_score, effort_score, category, due_date, source_section, requires_review)
    values (new_brief_id, item->>'title', item->>'description', item->>'whyItMatters', 'new', coalesce(item->>'priority','medium'), nullif(item->>'impactScore','')::integer, nullif(item->>'effortScore','')::integer, item->>'category', nullif(item->>'dueDate','')::date, item->>'sourceSection', true);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'opportunities','[]'::jsonb)) loop
    insert into public.opportunities (brief_id, name, description, business_rationale, opportunity_type, horizon, target_customer, target_industry, potential_value, revenue_potential_score, strategic_fit_score, urgency_score, difficulty_score, speed_to_revenue_score, confidence_score, recommended_next_step, requires_review)
    values (new_brief_id, item->>'name', item->>'description', item->>'businessRationale', coalesce(item->>'opportunityType','operational_improvement'), coalesce(item->>'horizon','near_term'), item->>'targetCustomer', item->>'targetIndustry', item->>'potentialValue', nullif(item->>'revenuePotentialScore','')::integer, nullif(item->>'strategicFitScore','')::integer, nullif(item->>'urgencyScore','')::integer, nullif(item->>'difficultyScore','')::integer, nullif(item->>'speedToRevenueScore','')::integer, nullif(item->>'confidenceScore','')::integer, item->>'recommendedNextStep', true);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'risks','[]'::jsonb)) loop
    insert into public.risks (brief_id, title, description, severity, probability, potential_impact, mitigation, status, time_horizon)
    values (new_brief_id, item->>'title', item->>'description', coalesce(item->>'severity','medium'), nullif(item->>'probability','')::integer, item->>'potentialImpact', item->>'mitigation', coalesce(item->>'status','monitoring'), item->>'timeHorizon');
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'intelligence','[]'::jsonb)) loop
    insert into public.intelligence_items (brief_id, headline, summary, why_it_matters, business_impact, category, urgency, confidence, geographic_relevance, event_date, publication_date)
    values (new_brief_id, item->>'headline', item->>'summary', item->>'whyItMatters', item->>'businessImpact', coalesce(item->>'category','other'), coalesce(item->>'urgency','medium'), nullif(item->>'confidence','')::integer, item->>'geographicRelevance', nullif(item->>'eventDate','')::date, nullif(item->>'publicationDate','')::date);
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'sources','[]'::jsonb)) loop
    source_record_id := null;
    if nullif(item->>'url','') is not null then
      select id into source_record_id from public.sources where url = item->>'url';
    end if;
    if source_record_id is null then
      insert into public.sources (title, publisher, author, url, source_type, credibility_level, publication_date)
      values (coalesce(item->>'title',item->>'url','Untitled source'), item->>'publisher', item->>'author', nullif(item->>'url',''), coalesce(item->>'sourceType','other'), coalesce(item->>'credibilityLevel','unclassified'), nullif(item->>'publicationDate','')::date)
      returning id into source_record_id;
    end if;
    insert into public.brief_sources (brief_id, source_id) values (new_brief_id, source_record_id) on conflict do nothing;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(payload->'tags','[]'::jsonb)) loop
    insert into public.tags (name, slug)
    values (trim(both '"' from item::text), trim(both '-' from regexp_replace(lower(trim(both '"' from item::text)), '[^a-z0-9]+', '-', 'g')))
    on conflict (slug) do update set name = excluded.name
    returning id into tag_record_id;
    insert into public.entity_tags (tag_id, entity_type, entity_id) values (tag_record_id, 'brief', new_brief_id) on conflict do nothing;
  end loop;

  insert into public.notifications (type, title, message, related_entity_type, related_entity_id)
  values ('new_brief', 'New brief received', payload->>'title', 'brief', new_brief_id);

  update public.ingestion_logs set status='succeeded', brief_id=new_brief_id, processed_at=now() where id=log_id;
  return jsonb_build_object('duplicate', false, 'briefId', new_brief_id, 'requestId', log_id);
exception when others then
  if log_id is not null then
    update public.ingestion_logs set status='failed', error_message=left(sqlerrm,500), processed_at=now() where id=log_id;
  end if;
  raise;
end;
$$;

revoke execute on function public.ingest_executive_brief(jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.ingest_executive_brief(jsonb,text,text,text) to service_role;
