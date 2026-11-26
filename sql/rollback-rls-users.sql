-- ============================================================
-- ROLLBACK for the Users page: locks app_user again (no access for
-- anyone but the database owner). Safe to run more than once.
-- ============================================================

begin;

drop trigger if exists protect_last_admin on public.app_user;
drop function if exists public.protect_last_admin();

drop policy if exists "Admin read users" on public.app_user;
drop policy if exists "Admin add users" on public.app_user;
drop policy if exists "Admin edit users" on public.app_user;

revoke select, insert, update on public.app_user from authenticated;

commit;
