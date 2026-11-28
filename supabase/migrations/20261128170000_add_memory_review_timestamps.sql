alter table amstreem.memories
  add column if not exists reviewed_at timestamptz;

create index if not exists memories_user_reviewed_idx
  on amstreem.memories (user_id, reviewed_at);
