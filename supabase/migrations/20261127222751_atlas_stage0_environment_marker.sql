-- Stage 0: database environment tripwire.
-- This table is readable only by the server-side service role; browser roles get no access.

create table if not exists public.app_meta (
  key text primary key check (length(key) between 1 and 80),
  value text not null check (length(value) between 1 and 120),
  updated_at timestamptz not null default now()
);

alter table public.app_meta enable row level security;
alter table public.app_meta force row level security;
revoke all privileges on table public.app_meta from public, anon, authenticated;
grant select on table public.app_meta to service_role;

insert into public.app_meta (key, value)
values ('environment', 'staging')
on conflict (key) do update
set value = excluded.value, updated_at = now();
