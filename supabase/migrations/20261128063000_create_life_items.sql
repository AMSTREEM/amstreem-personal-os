create table if not exists amstreem.life_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid null,
  kind text not null check (kind in ('goal', 'project', 'task')),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint life_items_parent_owner_fk foreign key (parent_id, user_id)
    references amstreem.life_items(id, user_id) on delete cascade,
  constraint life_items_not_own_parent check (parent_id is null or parent_id <> id)
);

create index if not exists life_items_user_kind_status_idx on amstreem.life_items(user_id, kind, status);
create index if not exists life_items_parent_idx on amstreem.life_items(parent_id);
create index if not exists life_items_due_date_idx on amstreem.life_items(user_id, due_date) where due_date is not null;

create or replace function amstreem.validate_life_item_parent()
returns trigger language plpgsql set search_path = '' as $$
declare parent_kind text;
begin
  if new.parent_id is null then return new; end if;
  select kind into parent_kind from amstreem.life_items where id = new.parent_id and user_id = new.user_id;
  if parent_kind is null then raise exception 'Parent item not found for this account'; end if;
  if new.kind = 'goal' then raise exception 'Goals cannot have a parent item';
  elsif new.kind = 'project' and parent_kind <> 'goal' then raise exception 'Projects can only belong to a goal';
  elsif new.kind = 'task' and parent_kind not in ('goal', 'project') then raise exception 'Tasks can only belong to a goal or project';
  end if;
  return new;
end;
$$;

drop trigger if exists life_items_validate_parent on amstreem.life_items;
create trigger life_items_validate_parent before insert or update of kind, parent_id, user_id on amstreem.life_items
for each row execute function amstreem.validate_life_item_parent();

create or replace function amstreem.set_life_item_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  if new.status = 'completed' and old.status <> 'completed' then new.completed_at = now();
  elsif new.status <> 'completed' then new.completed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists life_items_updated_at on amstreem.life_items;
create trigger life_items_updated_at before update on amstreem.life_items
for each row execute function amstreem.set_life_item_updated_at();

alter table amstreem.life_items enable row level security;
drop policy if exists "Users can manage their own life items" on amstreem.life_items;
create policy "Users can manage their own life items" on amstreem.life_items for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant usage on schema amstreem to authenticated;
grant select, insert, update, delete on amstreem.life_items to authenticated;
