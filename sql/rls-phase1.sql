-- ============================================================
-- RLS PHASE 1: staff-only access (active admin or manager)
-- Run in the Supabase SQL editor. Runs as ONE transaction:
-- if any statement fails, nothing changes.
-- Undo with sql/rollback-open-rls.sql
-- ============================================================

begin;

-- 1) Helper: who is this signed-in person, according to app_user?
--    Matches the Clerk user id in the token ('sub') to app_user.clerk_id.
--    SECURITY DEFINER lets it read app_user even though app_user is locked
--    to everyone else. It only ever returns the CALLER's own role.
create or replace function public.app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_user
  where clerk_id = (auth.jwt() ->> 'sub')
    and active
  limit 1
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.app_role() in ('admin', 'manager'), false)
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

-- Only signed-in users may call these. Anonymous visitors may not.
revoke execute on function public.app_role()  from public, anon;
revoke execute on function public.is_staff()  from public, anon;
revoke execute on function public.is_admin()  from public, anon;
grant  execute on function public.app_role()  to authenticated;
grant  execute on function public.is_staff()  to authenticated;
grant  execute on function public.is_admin()  to authenticated;

-- 2) Replace the open policies with staff-only ones.
do $$
declare t text;
begin
  foreach t in array array[
    'checklist_item_instance', 'checklist_template', 'checklist_template_item',
    'cleaner', 'cleaning_job', 'ical_event', 'property',
    'stay', 'supply_flag', 'supply_item'
  ] loop
    execute format('drop policy if exists "Owner full access" on public.%I', t);
    execute format('drop policy if exists "Allow all operations" on public.%I', t);
    execute format('drop policy if exists "Staff full access" on public.%I', t);
    execute format(
      'create policy "Staff full access" on public.%I
         for all to authenticated
         using ((select public.is_staff()))
         with check ((select public.is_staff()))', t);
  end loop;
end $$;

-- 3) Trim table privileges.
--    Anonymous visitors get nothing at all.
--    Signed-in users lose TRUNCATE (which ignores row rules), TRIGGER, REFERENCES.
revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

--    New tables created later should not be handed to anon automatically.
alter default privileges in schema public revoke all on tables from anon;

commit;

-- 4) Check the result (read-only).
select tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
