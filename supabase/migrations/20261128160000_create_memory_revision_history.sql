create table amstreem.memory_revisions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references amstreem.memories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  memory_type text not null,
  changed_at timestamptz not null default now()
);

create index memory_revisions_owner_memory_changed_idx
  on amstreem.memory_revisions (user_id, memory_id, changed_at desc);

alter table amstreem.memory_revisions enable row level security;

create policy "Users can read their own memory revisions"
  on amstreem.memory_revisions
  for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on amstreem.memory_revisions to authenticated;

create or replace function amstreem.archive_memory_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.content is distinct from new.content
      or old.memory_type is distinct from new.memory_type)
     and auth.uid() is not null
     and auth.uid() = old.user_id then
    insert into amstreem.memory_revisions
      (memory_id, user_id, content, memory_type)
    values
      (old.id, old.user_id, old.content, old.memory_type);
  end if;
  return new;
end;
$$;

revoke all on function amstreem.archive_memory_revision() from public, anon, authenticated;

create trigger memories_archive_revision
before update of content, memory_type on amstreem.memories
for each row
execute function amstreem.archive_memory_revision();
