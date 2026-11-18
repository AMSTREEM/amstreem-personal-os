-- Personal OS workspace persistence migration.
-- The existing Express API is retained and each account's workspace is stored
-- as one JSONB snapshot. The app accesses this row with the signed-in user's
-- Supabase JWT; RLS binds every read/write to auth.uid().
--
-- Safe to re-run. Existing workspace rows are not deleted or rewritten.

create table if not exists public.personal_os_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.personal_os_workspaces enable row level security;
alter table public.personal_os_workspaces force row level security;

drop policy if exists personal_os_user_isolation on public.personal_os_workspaces;
create policy personal_os_user_isolation on public.personal_os_workspaces
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.personal_os_workspaces from anon;
grant select, insert, update on public.personal_os_workspaces to authenticated;
