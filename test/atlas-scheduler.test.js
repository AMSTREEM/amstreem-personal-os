'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  settingsFor, jsonSetting, dateKeyInZone, clockInZone, addDays,
  mondayWeekStart, safeTimeZone, isQuietNow
} = require('../server/atlas-scheduler');

test('settings projection only reads keyed settings rows',()=>{
  assert.deepEqual(settingsFor({tables:{settings:[{key:'timezone',value:'Africa/Lagos'},{key:'notifications_enabled',value:'true'},{value:'ignored'}]}}),{timezone:'Africa/Lagos',notifications_enabled:'true'});
  assert.deepEqual(settingsFor({}),{});
});
test('JSON settings safely fall back on malformed values',()=>{
  assert.deepEqual(jsonSetting({x:'["habits"]'},'x',[]),['habits']);
  assert.deepEqual(jsonSetting({x:'bad'},'x',['safe']),['safe']);
});
test('calendar dates and local clock respect the requested timezone',()=>{
  const instant=new Date('2026-11-28T23:30:00.000Z');
  assert.equal(dateKeyInZone(instant,'Africa/Lagos'),'2026-11-29');
  assert.equal(clockInZone(instant,'Africa/Lagos').localDate,'2026-11-29');
  assert.equal(clockInZone(instant,'Africa/Lagos').hour,0);
});
test('date helpers calculate stable local-day and Monday boundaries',()=>{
  assert.equal(addDays('2026-11-28',1),'2026-11-29');
  assert.equal(addDays('2026-12-31',1),'2027-01-01');
  assert.equal(mondayWeekStart('2026-11-29'),'2026-11-23');
  assert.equal(mondayWeekStart('2026-11-23'),'2026-11-23');
});
test('invalid timezones safely fall back to Lagos',()=>{
  assert.equal(safeTimeZone('not/a-zone'),'Africa/Lagos');
  assert.equal(safeTimeZone('Europe/London'),'Europe/London');
});
test('quiet hours handle overnight and daytime windows',()=>{
  assert.equal(isQuietNow({}, {hour:23,minute:0}),true);
  assert.equal(isQuietNow({}, {hour:7,minute:59}),true);
  assert.equal(isQuietNow({}, {hour:12,minute:0}),false);
  assert.equal(isQuietNow({notification_quiet_hours:JSON.stringify({start:'09:00',end:'17:00'})},{hour:12,minute:0}),true);
  assert.equal(isQuietNow({notification_quiet_hours:JSON.stringify({start:'09:00',end:'17:00'})},{hour:18,minute:0}),false);
});
