-- ============================================================
-- USERS PAGE: lets ADMINS (and only admins) read, add and edit app_user.
-- No delete is granted at all: people are deactivated, never removed.
-- Also adds a guard so the last active admin can never be removed or
-- deactivated. Runs as ONE transaction.
-- Undo with sql/rollback-rls-users.sql
-- ============================================================

begin;

grant select, insert, update on public.app_user to authenticated;

drop policy if exists "Admin read users" on public.app_user;
drop policy if exists "Admin add users" on public.app_user;
drop policy if exists "Admin edit users" on public.app_user;

create policy "Admin read users" on public.app_user
  for select to authenticated
  using ((select public.is_admin()));

create policy "Admin add users" on public.app_user
  for insert to authenticated
  with check ((select public.is_admin()));

create policy "Admin edit users" on public.app_user
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Never let the last active admin disappear.
create or replace function public.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and old.active
     and (new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from public.app_user
       where role = 'admin' and active and id <> old.id
     )
  then
    raise exception 'You cannot remove or deactivate the last active admin.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_last_admin on public.app_user;
create trigger protect_last_admin
  before update on public.app_user
  for each row execute function public.protect_last_admin();

commit;

-- Check the result (read-only).
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'app_user'
order by policyname;
