-- Amstreem clean-start: isolated memory foundation.
-- Applied to Supabase project amstreem-atlas-staging (yllzeblecyqnncgktnjw).
-- This is a reference snapshot of the live migration; do not use it to reset
-- or replace the existing public schema. Existing Atlas/Personal OS tables remain untouched.

create schema if not exists amstreem;

revoke all on schema amstreem from public, anon;
grant usage on schema amstreem to authenticated;

create table if not exists amstreem.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 8000),
  memory_type text not null default 'fact'
    check (memory_type in ('fact', 'preference', 'goal', 'project', 'experience', 'other')),
  sensitivity text not null default 'ordinary'
    check (sensitivity in ('ordinary', 'sensitive')),
  source text not null default 'user_created'
    check (source in ('user_created', 'user_confirmed', 'imported')),
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sensitive_memory_requires_consent
    check (sensitivity <> 'sensitive' or consented_at is not null)
);

create index if not exists memories_user_updated_idx
  on amstreem.memories (user_id, updated_at desc);

alter table amstreem.memories enable row level security;

drop policy if exists "Users can read their own memories" on amstreem.memories;
create policy "Users can read their own memories"
  on amstreem.memories for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own memories" on amstreem.memories;
create policy "Users can create their own memories"
  on amstreem.memories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own memories" on amstreem.memories;
create policy "Users can update their own memories"
  on amstreem.memories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own memories" on amstreem.memories;
create policy "Users can delete their own memories"
  on amstreem.memories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on amstreem.memories to authenticated;
revoke all on amstreem.memories from anon;
