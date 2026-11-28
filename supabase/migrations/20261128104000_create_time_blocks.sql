-- Daily time blocks, owned by one authenticated user.
create table if not exists amstreem.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_date date not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  category text not null default 'personal' check (category in ('focus','study','class','personal','break','rest','other')),
  start_time time without time zone not null,
  end_time time without time zone not null,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_blocks_valid_range check (end_time > start_time)
);
create index if not exists time_blocks_user_date_start_idx
  on amstreem.time_blocks (user_id, block_date, start_time);
alter table amstreem.time_blocks enable row level security;
drop policy if exists "Users can view their own time blocks" on amstreem.time_blocks;
create policy "Users can view their own time blocks"
  on amstreem.time_blocks for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Users can create their own time blocks" on amstreem.time_blocks;
create policy "Users can create their own time blocks"
  on amstreem.time_blocks for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can update their own time blocks" on amstreem.time_blocks;
create policy "Users can update their own time blocks"
  on amstreem.time_blocks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own time blocks" on amstreem.time_blocks;
create policy "Users can delete their own time blocks"
  on amstreem.time_blocks for delete to authenticated
  using ((select auth.uid()) = user_id);
grant select, insert, update, delete on amstreem.time_blocks to authenticated;
