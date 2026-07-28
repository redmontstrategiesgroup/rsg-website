-- RSG Supabase — security hardening for SECURITY DEFINER RPC functions
-- Run in the target project's SQL editor (as the postgres role).
--
-- Removes REST/RPC (/rest/v1/rpc/...) access for anonymous and signed-in users on
-- backend-only functions, while keeping your backend (service_role key) working.
-- These four are only ever called by your server, and the appointment ones already
-- have internal staff-permission guards.
--
-- NOTE: rsg_is_staff() and rsg_role() are intentionally excluded. They are called
-- INSIDE your RLS policies, and revoking EXECUTE from `authenticated` breaks RLS
-- evaluation (verified by test: "permission denied for function"). Leave them as-is;
-- their advisor warnings are expected for RLS helper functions.

revoke execute on function public.rsg_book_appointment(uuid, uuid, uuid, uuid, uuid, timestamptz, text, text, text, boolean) from public, anon, authenticated;
grant  execute on function public.rsg_book_appointment(uuid, uuid, uuid, uuid, uuid, timestamptz, text, text, text, boolean) to service_role;

revoke execute on function public.rsg_cancel_appointment(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.rsg_cancel_appointment(uuid, text, text) to service_role;

revoke execute on function public.rsg_reschedule_appointment(uuid, timestamptz, text) from public, anon, authenticated;
grant  execute on function public.rsg_reschedule_appointment(uuid, timestamptz, text) to service_role;

revoke execute on function public.rsg_slot_is_free(uuid, timestamptz, timestamptz, integer, integer, uuid, text) from public, anon, authenticated;
grant  execute on function public.rsg_slot_is_free(uuid, timestamptz, timestamptz, integer, integer, uuid, text) to service_role;
