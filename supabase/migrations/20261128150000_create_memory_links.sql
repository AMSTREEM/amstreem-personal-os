create table amstreem.memory_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_id uuid not null references amstreem.memories(id) on delete cascade,
  life_item_id uuid not null references amstreem.life_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint memory_links_unique unique (user_id, memory_id, life_item_id)
);

create index memory_links_user_idx on amstreem.memory_links(user_id);
create index memory_links_memory_idx on amstreem.memory_links(memory_id);
create index memory_links_life_item_idx on amstreem.memory_links(life_item_id);

create or replace function amstreem.validate_memory_link_ownership()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from amstreem.memories m
    where m.id = new.memory_id and m.user_id = new.user_id
  ) then
    raise exception 'Memory must belong to the same account';
  end if;

  if not exists (
    select 1 from amstreem.life_items i
    where i.id = new.life_item_id and i.user_id = new.user_id
  ) then
    raise exception 'Goal, project or task must belong to the same account';
  end if;

  return new;
end;
$$;

revoke all on function amstreem.validate_memory_link_ownership() from public, anon, authenticated;
create trigger validate_memory_link_ownership
before insert or update on amstreem.memory_links
for each row execute function amstreem.validate_memory_link_ownership();

alter table amstreem.memory_links enable row level security;
create policy "Users can view their own memory links"
on amstreem.memory_links for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own memory links"
on amstreem.memory_links for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own memory links"
on amstreem.memory_links for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, delete on amstreem.memory_links to authenticated;