'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AtlasEventSchema } = require('../packages/contracts');
const { appendAtlasEvent, appendImportedAtlasEvents, createAtlasEvent, validateImportedAtlasEvents, validateAtlasEventBatch, MAX_EVENTS_PER_REQUEST } = require('../server/atlas-events');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20261127124100_atlas_stage4_event_ledger.sql'), 'utf8');
const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

function event(overrides = {}) {
  return {
    key: 'test-event-key-001',
    type: 'task.completed',
    module: 'actions',
    entityId: '42',
    occurredAt: '2026-11-27T12:00:00.000Z',
    localDate: '2026-11-27',
    payload: { goalLinked: false },
    source: 'user',
    ...overrides
  };
}

test('event envelope accepts a known publisher and strict payload', () => {
  assert.equal(AtlasEventSchema.safeParse(event()).success, true);
  assert.equal(createAtlasEvent(event()).type, 'task.completed');
});

test('event contract rejects unknown types, payload fields and mismatched modules', () => {
  assert.equal(AtlasEventSchema.safeParse(event({ type: 'task.finished' })).success, false);
  assert.equal(AtlasEventSchema.safeParse(event({ payload: { goalLinked: false, title: 'private task title' } })).success, false);
  assert.equal(AtlasEventSchema.safeParse(event({ module: 'growth' })).success, false);
  assert.equal(AtlasEventSchema.safeParse(event({ type: 'focus.ended', module: 'actions', payload: { minutes: 0 } })).success, false);
  assert.equal(AtlasEventSchema.safeParse(event({ type: 'task.reopened', module: 'actions', payload: { reversesEventKey: 'completed-event-123' } })).success, true);
});

test('event publishers derive stable keys from the request idempotency key', () => {
  const context = { pendingEvents: [], idempotencyKey: 'retry-key-2026' };
  const first = appendAtlasEvent(context, { type: 'task.completed', module: 'actions', entityId: '42', localDate: '2026-11-27', payload: { goalLinked: true } });
  const second = appendAtlasEvent(context, { type: 'habit.checked', module: 'habits', entityId: '7', localDate: '2026-11-27', payload: { logDate: '2026-11-27' } });
  assert.equal(first.key, 'retry-key-2026:evt:1');
  assert.equal(second.key, 'retry-key-2026:evt:2');
  assert.equal(context.pendingEvents.length, 2);
  assert.deepEqual(validateAtlasEventBatch(context.pendingEvents), context.pendingEvents);
});

test('event publisher rejects use outside a workspace request and enforces batch limits', () => {
  assert.throws(() => appendAtlasEvent(null, event()), /authenticated workspace request/);
  const context = { pendingEvents: [], idempotencyKey: 'retry-key-2026' };
  for (let index = 0; index < MAX_EVENTS_PER_REQUEST; index++) {
    appendAtlasEvent(context, { type: 'task.completed', module: 'actions', entityId: String(index + 1), localDate: '2026-11-27', payload: { goalLinked: false } });
  }
  assert.throws(() => appendAtlasEvent(context, { type: 'task.completed', module: 'actions', entityId: 'overflow', localDate: '2026-11-27', payload: { goalLinked: false } }), /too many events/);
});

test('backup events retain their original keys but are reclassified as imports', () => {
  const context = { pendingEvents: [], idempotencyKey: 'import-key-2026' };
  const imported = appendImportedAtlasEvents(context, [event({ source: 'user' })]);
  assert.equal(imported, 1);
  assert.equal(context.pendingEvents[0].key, 'test-event-key-001');
  assert.equal(context.pendingEvents[0].source, 'import');
  assert.equal(validateImportedAtlasEvents([event()])[0].source, 'import');
  assert.throws(() => validateImportedAtlasEvents([event(), event()]), /duplicate activity event keys/);
  assert.throws(() => validateImportedAtlasEvents([event({ type: 'task.reopened', payload: { reversesEventKey: 'missing-original-event' } })]), /missing an original activity event/);
});

test('workspace version commits append events atomically and skip duplicate idempotency replays', () => {
  assert.match(server, /rpc\/commit_workspace_with_events/);
  assert.match(server, /p_events: validateAtlasEventBatch\(events\)\.map\(event => \(\{ key: event\.key, type: event\.type, module: event\.module, entity_id: event\.entityId \|\| null, occurred_at: event\.occurredAt, local_date: event\.localDate/);
  assert.match(server, /p_user_id: userId/);
  assert.match(server, /function supabaseAdminHeaders\(extra = \{\}\)/);
  assert.match(server, /headers\.Authorization = `Bearer \$\{serviceRoleJwt\}`/);
  assert.match(server, /pendingEvents: \[\]/);
  assert.match(server, /context\.pendingEvents/);
  assert.match(migration, /public\.commit_workspace_with_events/);
  assert.match(migration, /if not coalesce\(\(v_result->>'replayed'\)::boolean,false\) then/);
  assert.match(migration, /unique \(user_id, event_key\)/);
});

test('event ledger is append-only, account-scoped and has explicit Data API grants', () => {
  assert.match(migration, /alter table public\.activity_events enable row level security/);
  assert.match(migration, /activity events owner read/);
  assert.match(migration, /activity events owner append/);
  assert.match(migration, /activity_events_append_only/);
  assert.match(migration, /revoke all on public\.activity_events from anon, authenticated/);
  assert.match(migration, /grant select on public\.activity_events to authenticated/);
  assert.match(migration, /grant select, insert on public\.activity_events to service_role/);
  assert.doesNotMatch(migration, /grant select, insert on public\.activity_events to authenticated/);
  assert.match(migration, /current_user <> 'service_role'/);
  assert.match(migration, /commit_workspace_with_events\(uuid,bigint,jsonb,integer,text,text,boolean,text,jsonb\) to service_role/);
  assert.match(migration, /grant select on public\.xp_ledger to service_role/);
});

test('incremental projections can be rebuilt from events and achievement unlocks are idempotent', () => {
  assert.match(migration, /atlas_private\.rebuild_progress_daily/);
  assert.match(migration, /delete from public\.progress_daily where user_id = p_user_id/);
  assert.match(migration, /on conflict \(user_id, achievement_id\) do nothing/);
  assert.match(migration, /atlas_private\.evaluate_achievements/);
  assert.match(migration, /legacy:session:/);
  assert.match(migration, /legacy:habit:/);
  assert.match(migration, /legacy:study:/);
  assert.match(migration, /legacy:practice:/);
  assert.match(migration, /atlas_achievement_unlocks\(user_id,achievement_id,unlocked_at\)/);
});

test('XP ledger enforces source awards, daily caps, compensating reversals and legacy backfill', () => {
  assert.match(migration, /create table if not exists public\.xp_ledger/);
  for (const cap of ['100','120','60','80','30']) assert.ok(migration.includes('then '+cap), 'missing daily XP cap '+cap);
  assert.match(migration, /'reversal:' \|\| new\.event_key/);
  assert.match(migration, /-v_original_xp_points/);
  assert.match(migration, /if new\.source = 'import' then/);
  assert.match(migration, /from public\.personal_os_workspaces w/);
  assert.match(migration, /'legacy:' \|\|/);
  assert.doesNotMatch(server, /awardXp\(/);
});

test('module publishers emit the contracted facts without instrumenting Qur’an or faith routes', () => {
  for (const type of [
    'task.completed','task.reopened','focus.ended','goal.completed','goal.reopened',
    'goal.milestone_reached','goal.milestone_unreached','habit.checked','habit.unchecked',
    'learning.item_completed','learning.item_reopened','learning.study_logged',
    'review.submitted','review.reopened','practice.logged','practice.unlogged'
  ]) assert.ok(server.includes("type:'"+type+"'"), 'missing publisher for '+type);
  const quranRoute = server.slice(server.indexOf("app.post('/api/deen/quran'"), server.indexOf("app.delete('/api/deen/quran/:id'"));
  const faithRoute = server.slice(server.indexOf("app.patch('/api/faith'"), server.indexOf("// Daily Rhythm records"));
  assert.doesNotMatch(quranRoute, /publishAtlasEvent/);
  assert.doesNotMatch(faithRoute, /publishAtlasEvent/);
  assert.match(server, /\['daily_intention','wisdom_note','evening_reflection'\]\.includes\(type\)/);
  assert.doesNotMatch(migration, /quran_logs|faith_logs/i);
});

test('XP, achievements, weekly challenges and Residence briefing read shared projections', () => {
  assert.match(server, /rpc\/get_xp_summary/);
  assert.match(server, /rpc\/get_progress_totals/);
  assert.match(server, /atlas_achievement_unlocks\?select=/);
  assert.match(server, /progress_daily\?select=local_date,module,metric,value/);
  assert.match(server, /app\.get\('\/api\/residence\/briefing'/);
  assert.match(server, /publishAtlasEvent\(\{type:'challenge\.completed'/);
});
