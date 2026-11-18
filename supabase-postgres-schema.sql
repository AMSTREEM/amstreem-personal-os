-- Personal OS workspace persistence and row-level security.
-- The current Express API stores each signed-in user's workspace as a JSONB
-- snapshot in the existing public.personal_os_workspaces table.
--
-- Safe to re-run. Existing accounts and workspace rows are preserved.

create table if not exists public.personal_os_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.personal_os_workspaces enable row level security;
alter table public.personal_os_workspaces force row level security;

drop policy if exists personal_os_user_isolation on public.personal_os_workspaces;
drop policy if exists "workspace owner read" on public.personal_os_workspaces;
drop policy if exists "workspace owner insert" on public.personal_os_workspaces;
drop policy if exists "workspace owner update" on public.personal_os_workspaces;

create policy "workspace owner read"
on public.personal_os_workspaces for select to authenticated
using ((select auth.uid()) = user_id);

create policy "workspace owner insert"
on public.personal_os_workspaces for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "workspace owner update"
on public.personal_os_workspaces for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
revoke all on table public.personal_os_workspaces from anon, authenticated;
grant select, insert, update on table public.personal_os_workspaces to authenticated;
