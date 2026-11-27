const test = require('node:test');
const assert = require('node:assert/strict');
const { replayWorkspaceMutation } = require('../workspace-replay');

function snapshot(tables) {
  return { format: 'personal-os-sqlite-snapshot-v3', schemaVersion: 3, tables: {
    goals: [], projects: [], project_milestones: [], tasks: [], modules: [], learning_paths: [],
    learning_lessons: [], learning_resources: [], learning_study_logs: [], sessions: [],
    calendar_events: [], notes: [], reviews: [], settings: [], habits: [], habit_logs: [],
    prayer_logs: [], quran_logs: [], tahajjud_logs: [], faith_logs: [], self_control_logs: [],
    self_control_trackers: [], self_control_entries: [], rhythm_records: [], reading_items: [],
    email_events: [], login_events: [], xp_events: [], achievement_unlocks: [], weekly_challenges: [],
    feedback_logs: [], ...tables
  }};
}

test('replays independent row changes without dropping either writer', () => {
  const base = snapshot({ goals: [{ id: 1, title: 'Goal A' }], notes: [{ id: 1, title: 'Note A' }] });
  const local = snapshot({ goals: [{ id: 1, title: 'Goal A updated' }], notes: [{ id: 1, title: 'Note A' }] });
  const latest = snapshot({ goals: [{ id: 1, title: 'Goal A' }], notes: [{ id: 1, title: 'Note A updated elsewhere' }] });
  const merged = replayWorkspaceMutation(base, local, latest);
  assert.equal(merged.tables.goals[0].title, 'Goal A updated');
  assert.equal(merged.tables.notes[0].title, 'Note A updated elsewhere');
});

test('accepts an already-applied identical mutation', () => {
  const base = snapshot({ settings: [{ key: 'theme', value: 'dark' }] });
  const local = snapshot({ settings: [{ key: 'theme', value: 'light' }] });
  const latest = snapshot({ settings: [{ key: 'theme', value: 'light' }] });
  assert.equal(replayWorkspaceMutation(base, local, latest).tables.settings[0].value, 'light');
});

test('rejects overlapping edits instead of choosing a winner', () => {
  const base = snapshot({ goals: [{ id: 1, title: 'Original' }] });
  const local = snapshot({ goals: [{ id: 1, title: 'Local edit' }] });
  const latest = snapshot({ goals: [{ id: 1, title: 'Remote edit' }] });
  assert.throws(() => replayWorkspaceMutation(base, local, latest), /same record was changed/);
});

test('rejects colliding concurrent inserts and deletes of remotely changed rows', () => {
  const base = snapshot({ goals: [] });
  const local = snapshot({ goals: [{ id: 1, title: 'Local insert' }] });
  const latest = snapshot({ goals: [{ id: 1, title: 'Remote insert' }] });
  assert.throws(() => replayWorkspaceMutation(base, local, latest), /same key/);
  const baseDelete = snapshot({ goals: [{ id: 2, title: 'Original' }] });
  const localDelete = snapshot({ goals: [] });
  const remoteEdit = snapshot({ goals: [{ id: 2, title: 'Changed elsewhere' }] });
  assert.throws(() => replayWorkspaceMutation(baseDelete, localDelete, remoteEdit), /request deleted it/);
});
