'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createAtlasEvent } = require('../server/atlas-events');
test('Atlas event envelope is deterministic for request retries and matches the ledger contract', () => {
 const input={requestKey:'request-key-123',type:'task.completed',module:'actions',entityId:'42',occurredAt:'2026-11-28T04:00:00.000Z',localDate:'2026-11-28',payload:{goalLinked:true}};
 const first=createAtlasEvent(input);assert.deepEqual(first,createAtlasEvent(input));assert.equal(first.source,'user');assert.equal(first.occurredAt,'2026-11-28T04:00:00.000Z');assert.ok(first.key.length<=240);
});
test('Atlas event envelope rejects invalid modules, types, dates and payloads', () => {
 const base={requestKey:'request-key-123',type:'task.completed',module:'actions',entityId:'42',localDate:'2026-11-28',payload:{}};
 assert.throws(()=>createAtlasEvent({...base,module:'quran'}),/module/);assert.throws(()=>createAtlasEvent({...base,type:'quran.verse_read'}),/type/);assert.throws(()=>createAtlasEvent({...base,localDate:'28-11-2026'}),/localDate/);assert.throws(()=>createAtlasEvent({...base,payload:[]}),/payload/);
});
test('Atlas event keys remain within the ledger length limit for long idempotency keys', () => {
 const event=createAtlasEvent({requestKey:'x'.repeat(200),type:'focus.ended',module:'actions',entityId:'session-1',localDate:'2026-11-28',payload:{minutes:25}});assert.ok(event.key.length<=240);
});
