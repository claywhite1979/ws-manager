-- ============================================================
-- ROLLBACK OF PHASE 2: returns to the Phase 1 rules
-- (every active admin or manager has full access, including delete).
-- Safe to run more than once.
-- ============================================================

begin;

do $$
declare t text;
begin
  foreach t in array array[
    'checklist_item_instance', 'checklist_template', 'checklist_template_item',
    'cleaner', 'cleaning_job', 'ical_event', 'property',
    'stay', 'supply_flag', 'supply_item'
  ] loop
    execute format('drop policy if exists "Staff read" on public.%I', t);
    execute format('drop policy if exists "Staff insert" on public.%I', t);
    execute format('drop policy if exists "Staff update" on public.%I', t);
    execute format('drop policy if exists "Admin delete" on public.%I', t);
    execute format('drop policy if exists "Admin manage" on public.%I', t);
    execute format('drop policy if exists "Staff full access" on public.%I', t);
    execute format(
      'create policy "Staff full access" on public.%I
         for all to authenticated
         using ((select public.is_staff()))
         with check ((select public.is_staff()))', t);
  end loop;
end $$;

commit;
