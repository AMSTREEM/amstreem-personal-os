create table if not exists amstreem.action_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('task_updates')),
  mode text not null default 'ask' check (mode in ('ask','allow')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category)
);
create table if not exists amstreem.action_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (action_type in ('complete_task','reopen_task')),
  target_id uuid not null references amstreem.life_items(id) on delete cascade,
  target_title text not null,
  explanation text not null,
  status text not null default 'awaiting_approval' check (status in ('awaiting_approval','approved','completed','failed','cancelled')),
  permission_mode text not null default 'ask' check (permission_mode in ('ask','allow')),
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  completed_at timestamptz
);
create index if not exists action_permissions_owner_idx on amstreem.action_permissions(user_id);
create index if not exists action_log_owner_created_idx on amstreem.action_log(user_id, created_at desc);
create index if not exists action_log_target_owner_idx on amstreem.action_log(target_id, user_id);
alter table amstreem.action_permissions enable row level security;
alter table amstreem.action_log enable row level security;
create policy "Users manage their action permissions" on amstreem.action_permissions for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their action log" on amstreem.action_log for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on amstreem.action_permissions to authenticated;
grant select, insert, update, delete on amstreem.action_log to authenticated;