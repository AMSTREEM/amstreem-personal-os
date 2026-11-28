create table amstreem.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  intention text not null default '' check (char_length(intention) <= 500),
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[]
    check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index habits_user_active_idx on amstreem.habits(user_id, active, created_at);
alter table amstreem.habits enable row level security;
create policy "Users can view their own habits" on amstreem.habits for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own habits" on amstreem.habits for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own habits" on amstreem.habits for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own habits" on amstreem.habits for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on amstreem.habits to authenticated;

create table amstreem.habit_entries (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  note text not null default '' check (char_length(note) <= 500),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint habit_entries_habit_owner_fk foreign key (habit_id, user_id)
    references amstreem.habits(id, user_id) on delete cascade,
  constraint habit_entries_one_per_day unique (habit_id, entry_date)
);
create index habit_entries_user_date_idx on amstreem.habit_entries(user_id, entry_date);
alter table amstreem.habit_entries enable row level security;
create policy "Users can view their own habit entries" on amstreem.habit_entries for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can create their own habit entries" on amstreem.habit_entries for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can delete their own habit entries" on amstreem.habit_entries for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, delete on amstreem.habit_entries to authenticated;
