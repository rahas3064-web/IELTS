-- 013_enable_rls: deny the Supabase Data API (anon / authenticated) on every
-- public table. No policies, so those roles see nothing. The app connects as
-- the table owner and bypasses RLS. Do not FORCE ROW LEVEL SECURITY.
-- liara_archive is left untouched.
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;
