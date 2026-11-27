-- Amstreem clean-start: private personal memory foundation.
-- Review and apply only to the dedicated Amstreem Supabase project.
-- This file is a preparation artifact; it has NOT been applied to any database.

create table if not exists public.personal_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 20000),
  memory_type text not null default 'capture'
    check (memory_type in ('capture', 'fact', 'preference', 'goal', 'reflection')),
  sensitivity text not null default 'ordinary'
    check (sensitivity in ('ordinary', 'sensitive')),
  source text not null default 'user_created'
    check (source in ('user_created', 'user_confirmed', 'imported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists personal_memories_owner_updated_idx
  on public.personal_memories (user_id, updated_at desc);

alter table public.personal_memories enable row level security;

drop policy if exists "Owners can read their own memories" on public.personal_memories;
create policy "Owners can read their own memories"
  on public.personal_memories for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Owners can create their own memories" on public.personal_memories;
create policy "Owners can create their own memories"
  on public.personal_memories for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can update their own memories" on public.personal_memories;
create policy "Owners can update their own memories"
  on public.personal_memories for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owners can delete their own memories" on public.personal_memories;
create policy "Owners can delete their own memories"
  on public.personal_memories for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.personal_memories to authenticated;
revoke all on public.personal_memories from anon;
