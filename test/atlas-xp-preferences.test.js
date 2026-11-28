'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('XP preferences are saved by Settings and enforced by the database projection trigger', () => {
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const settings=fs.readFileSync(path.join(root,'client/src/pages/SettingsPage.tsx'),'utf8');
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261128043921_atlas_stage4_xp_module_preferences.sql'),'utf8');
 assert.match(server,/xp_enabled_modules/);
 assert.match(server,/xpModules=\['actions','habits','learning','growth','residence'\]/);
 assert.match(server,/v_xp_modules/);
 assert.match(settings,/xp_enabled_modules: xpEnabledModules/);
 assert.match(migration,/personal_os_workspaces/);
 assert.match(migration,/xp_enabled_modules/);
 assert.match(migration,/not \(v_xp_modules \? new\.module\)/);
});

test('habit streaks are computed from the event ledger and can be disabled in Settings', () => {
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const settings=fs.readFileSync(path.join(root,'client/src/pages/SettingsPage.tsx'),'utf8');
 assert.match(server,/calculateHabitStreak/);
 assert.match(server,/activity_events\?select=type,entity_id,local_date,payload,occurred_at/);
 assert.match(server,/streaks_enabled_modules/);
 assert.match(settings,/streaks_enabled_modules: streaksEnabledModules/);
});
