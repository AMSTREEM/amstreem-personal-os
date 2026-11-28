'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createAtlasEvent } = require('../server/atlas-events');
test('Atlas event envelope is deterministic for request retries and matches the ledger contract', () => {
 const input={requestKey:'request-key-123',type:'task.completed',module:'actions',entityId:'42',occurredAt:'2026-11-28T04:00:00.000Z',localDate:'2026-11-28',payload:{goalLinked:true}};
 const first=createAtlasEvent(input);assert.deepEqual(first,createAtlasEvent(input));assert.equal(first.source,'user');assert.equal(first.entity_id,'42');assert.equal(first.local_date,'2026-11-28');assert.equal(first.occurred_at,'2026-11-28T04:00:00.000Z');assert.ok(first.key.length<=240);
});
test('Atlas event envelope rejects invalid modules, types, dates and payloads', () => {
 const base={requestKey:'request-key-123',type:'task.completed',module:'actions',entityId:'42',localDate:'2026-11-28',payload:{}};
 assert.throws(()=>createAtlasEvent({...base,module:'quran'}),/module/);assert.throws(()=>createAtlasEvent({...base,type:'quran.verse_read'}),/type/);assert.throws(()=>createAtlasEvent({...base,localDate:'28-11-2026'}),/localDate/);assert.throws(()=>createAtlasEvent({...base,localDate:'2026-02-31'}),/localDate/);assert.throws(()=>createAtlasEvent({...base,payload:[]}),/payload/);
});
test('Atlas event keys remain within the ledger length limit for long idempotency keys', () => {
 const event=createAtlasEvent({requestKey:'x'.repeat(200),type:'focus.ended',module:'actions',entityId:'session-1',localDate:'2026-11-28',payload:{minutes:25}});assert.ok(event.key.length<=240);
});

test('module mutations publish deterministic events in the same workspace commit', () => {
 const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
 assert.match(server, /const context = \{ userId: user\.id, db: workspaceDb, events: \[\] \}/);
 assert.match(server, /req\.atlasEvents = context\.events/);
 assert.match(server, /events: req\.atlasEvents \|\| \[\]/);
 for (const eventType of ['task.completed','task.reopened','focus.ended','goal.completed','goal.reopened','goal.milestone_reached','goal.milestone_unreached','habit.checked','habit.unchecked','learning.item_completed','learning.item_reopened','learning.study_logged','review.submitted','practice.logged','practice.unlogged','challenge.completed']) {
  assert.ok(server.includes("type:'" + eventType + "'"), 'Missing event publisher for ' + eventType);
 }
 assert.doesNotMatch(server, /type:'quran\./);
 assert.match(server, /progress_daily\?select=metric,value&local_date=gte\./);
 assert.match(server, /async function readAtlasAchievementState/);
 assert.match(server, /type:'challenge.completed'/);
 const residence=fs.readFileSync(path.join(__dirname,'..','client/src/pages/TodayPage.tsx'),'utf8');
 assert.match(server, /requestKey:'weekly-challenge:'\+weekStart/);
 assert.match(residence, /weeklyChallengeSync\.mutate\(\)/);
 assert.match(server, /const \{ requestKey: eventRequestKey, \.\.\.eventFields \} = event/);
 assert.match(server, /app\.delete\('\/api\/tasks\/:id'[\s\S]*?type:'task\.reopened'/);
 assert.match(server, /app\.delete\('\/api\/habits\/:id'[\s\S]*?type:'habit\.unchecked'/);
 assert.match(server, /app\.delete\('\/api\/rhythm\/records\/:id'[\s\S]*?type:'practice\.unlogged'/);
});
