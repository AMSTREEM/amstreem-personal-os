const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase-postgres-schema.sql'), 'utf8');
const expectedTables = [
  'tasks','modules','learning_paths','learning_lessons','learning_resources',
  'learning_study_logs','sessions','notes','settings','goals','habits','habit_logs',
  'prayer_logs','quran_logs','tahajjud_logs','self_control_logs',
  'self_control_trackers','self_control_entries','email_events'
];

test('PostgreSQL schema contains every table used by the Personal OS API', () => {
  for (const table of expectedTables) {
    assert.match(sql, new RegExp('create table if not exists public\\.' + table + '\\s*\\(', 'i'), table);
  }
});

test('every user-owned table has an owner key and an RLS policy', () => {
  for (const table of expectedTables) {
    const start = sql.toLowerCase().indexOf('create table if not exists public.' + table);
    const next = sql.toLowerCase().indexOf('create table if not exists public.', start + 1);
    const definition = sql.slice(start, next < 0 ? sql.length : next);
    assert.match(definition, /user_id uuid not null references auth\.users\(id\) on delete cascade/i, table + ' user_id');
    assert.match(sql, new RegExp("'" + table + "'", 'i'), table + ' RLS registration');
  }
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /force row level security/i);
  assert.match(sql, /auth\.uid\(\)/i);
});

test('child records are tied to parent records within the same user account', () => {
  for (const [child, parent, fk] of [
    ['learning_lessons','learning_paths','path_id'],
    ['learning_resources','learning_lessons','lesson_id'],
    ['learning_study_logs','learning_lessons','lesson_id'],
    ['habit_logs','habits','habit_id'],
    ['self_control_entries','self_control_trackers','tracker_id']
  ]) {
    assert.match(sql, new RegExp('foreign key\\s*\\(user_id,\\s*' + fk + '\\)\\s*references public\\.' + parent + '\\(user_id,\\s*id\\)', 'i'), child);
  }
});
