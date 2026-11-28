create table amstreem.routine_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null default 'personal' check (category in ('focus','study','class','personal','break','rest','other')),
  weekdays smallint[] not null check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  notes text not null default '' check (char_length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index routine_templates_user_active_idx on amstreem.routine_templates(user_id, active);
alter table amstreem.routine_templates enable row level security;
create policy "Users can view their own routine templates" on amstreem.routine_templates for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own routine templates" on amstreem.routine_templates for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own routine templates" on amstreem.routine_templates for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own routine templates" on amstreem.routine_templates for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on amstreem.routine_templates to authenticated;
