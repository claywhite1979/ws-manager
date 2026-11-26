-- ============================================================
-- RLS PHASE 2
--   * Everyday tables: staff (admin or manager) can read, add and edit.
--     Only ADMINS can delete.
--   * Structure tables (property, checklist_template, checklist_template_item):
--     staff can read; only ADMINS can add, edit or delete.
-- Runs as ONE transaction. Undo with sql/rollback-rls-phase2.sql
-- ============================================================

begin;

-- Everyday tables
do $$
declare t text;
begin
  foreach t in array array[
    'checklist_item_instance', 'cleaner', 'cleaning_job', 'ical_event',
    'stay', 'supply_flag', 'supply_item'
  ] loop
    execute format('drop policy if exists "Staff full access" on public.%I', t);
    execute format('drop policy if exists "Staff read" on public.%I', t);
    execute format('drop policy if exists "Staff insert" on public.%I', t);
    execute format('drop policy if exists "Staff update" on public.%I', t);
    execute format('drop policy if exists "Admin delete" on public.%I', t);

    execute format(
      'create policy "Staff read" on public.%I for select to authenticated
         using ((select public.is_staff()))', t);
    execute format(
      'create policy "Staff insert" on public.%I for insert to authenticated
         with check ((select public.is_staff()))', t);
    execute format(
      'create policy "Staff update" on public.%I for update to authenticated
         using ((select public.is_staff()))
         with check ((select public.is_staff()))', t);
    execute format(
      'create policy "Admin delete" on public.%I for delete to authenticated
         using ((select public.is_admin()))', t);
  end loop;
end $$;

-- Structure tables
do $$
declare t text;
begin
  foreach t in array array['property', 'checklist_template', 'checklist_template_item'] loop
    execute format('drop policy if exists "Staff full access" on public.%I', t);
    execute format('drop policy if exists "Staff read" on public.%I', t);
    execute format('drop policy if exists "Admin manage" on public.%I', t);

    execute format(
      'create policy "Staff read" on public.%I for select to authenticated
         using ((select public.is_staff()))', t);
    execute format(
      'create policy "Admin manage" on public.%I for all to authenticated
         using ((select public.is_admin()))
         with check ((select public.is_admin()))', t);
  end loop;
end $$;

commit;

-- Check the result (read-only).
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
