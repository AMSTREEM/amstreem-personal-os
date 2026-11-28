create index if not exists habit_entries_habit_user_idx
  on amstreem.habit_entries (habit_id, user_id);

create index if not exists life_items_parent_owner_idx
  on amstreem.life_items (parent_id, user_id)
  where parent_id is not null;

create index if not exists memory_revisions_memory_idx
  on amstreem.memory_revisions (memory_id);
