-- Run once in Supabase SQL Editor before opening public registration.
-- Stores only account profile identity; personal workspace records stay in per-user databases.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  username text not null,
  created_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,24}$')
);
create unique index if not exists profiles_username_lower_unique on public.profiles (lower(username));
alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.sync_profile_from_auth()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id, display_name, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(nullif(new.raw_user_meta_data->>'username',''), 'user_' || substr(new.id::text,1,8)))
  on conflict (user_id) do update set
    display_name = excluded.display_name,
    username = excluded.username;
  return new;
end;
$$;
drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of raw_user_meta_data on auth.users
for each row execute procedure public.sync_profile_from_auth();
