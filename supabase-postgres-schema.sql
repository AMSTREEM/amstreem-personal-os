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
-- Supabase projects may have broad default Data API grants on public tables.
-- Remove anonymous access across the schema; authenticated access remains governed
-- by each table's explicit grants and RLS policies.
revoke all privileges on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

revoke all on table public.personal_os_workspaces from anon, authenticated;
grant select, insert, update on table public.personal_os_workspaces to authenticated;

-- Other setup tables are server-managed only. Their RLS remains enabled,
-- but browser roles receive no direct table privileges.
revoke all on table public.personal_os_profiles from anon, authenticated;
revoke all on table public.personal_os_admins from anon, authenticated;
revoke all on table public.personal_os_invites from anon, authenticated;

-- These SECURITY DEFINER routines are internal only. The auth bootstrap
-- routine continues to run from its auth.users trigger; clients cannot call
-- any of these routines through the Data API.
revoke execute on function public.personal_os_bootstrap_user() from public, anon, authenticated;
revoke execute on function public.personal_os_is_admin() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists personal_os_invites_invited_by_idx
on public.personal_os_invites(invited_by);
