-- ============================================================
-- ROLLBACK: restores the original wide-open policies AND the
-- original table privileges on the 10 app tables.
-- Safe to run more than once. Does NOT touch app_user or audit_log,
-- which stay locked.
-- ============================================================

begin;

-- Tables that used the "Owner full access" policy
do $$
declare t text;
begin
  foreach t in array array[
    'checklist_item_instance', 'checklist_template', 'checklist_template_item',
    'cleaner', 'cleaning_job', 'property', 'supply_flag', 'supply_item'
  ] loop
    execute format('drop policy if exists "Staff full access" on public.%I', t);
    execute format('drop policy if exists "Owner full access" on public.%I', t);
    execute format('create policy "Owner full access" on public.%I for all to public using (true)', t);
  end loop;
end $$;

-- Tables that used "Allow all operations"
do $$
declare t text;
begin
  foreach t in array array['ical_event', 'stay'] loop
    execute format('drop policy if exists "Staff full access" on public.%I', t);
    execute format('drop policy if exists "Allow all operations" on public.%I', t);
    execute format(
      'create policy "Allow all operations" on public.%I
         for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Table privileges as they were
do $$
declare t text;
begin
  foreach t in array array[
    'checklist_item_instance', 'checklist_template', 'checklist_template_item',
    'cleaner', 'cleaning_job', 'ical_event', 'property',
    'stay', 'supply_flag', 'supply_item'
  ] loop
    execute format('grant all on public.%I to anon, authenticated', t);
  end loop;
end $$;

commit;
