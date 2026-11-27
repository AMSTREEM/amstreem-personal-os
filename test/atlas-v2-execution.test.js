import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Execution actions use the Atlas v2 clean-slate workspace and preserve task APIs',()=>{
 const app=read('client/src/App.tsx'),page=read('client/src/pages/ExecutionV2Page.tsx'),css=read('client/src/pages/execution-v2.css');
 assert.match(app,/path="\/actions" element={<SuspendedPage><ExecutionV2Page \/><\/SuspendedPage>}/);
 for(const token of ["api<Task[]>('/tasks')","api<Project[]>('/projects')","json('POST'","json('PATCH'","/focus?task=",'queryKeys.tasks'])assert.ok(page.includes(token),token);
 assert.match(page,/Complete '\+task\.title|Complete \+task\.title/);
 assert.match(css,/\.atlas-v2 \.a-execution/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Calendar redesign keeps existing event, month, project and activity data contracts',()=>{
 const app=read('client/src/App.tsx'),page=read('client/src/pages/CalendarV2Page.tsx'),css=read('client/src/pages/execution-v2.css');
 assert.match(app,/path="\/calendar" element={<SuspendedPage><CalendarV2Page \/><\/SuspendedPage>}/);
 for(const token of ["api<Data>('/calendar?month='","api('/calendar/events'","api('/calendar/events/'","api<Project[]>('/projects')",'start_at','streaks'])assert.ok(page.includes(token),token);
 assert.match(page,/a-calendar__grid/);
 assert.match(css,/\.atlas-v2 \.a-calendar/);
});

test('Focus route retains the existing timer/session engine while receiving Atlas v2 room styling',()=>{
 const app=read('client/src/App.tsx'),focus=read('client/src/components/FocusWorkspace.tsx'),css=read('client/src/pages/execution-v2.css');
 assert.match(app,/a-focus-room"><FocusWorkspace \/>/);
 for(const token of ["api<Session>('/sessions'","session_key","useFocusTimer","updateFocusTimer","playAtlasFeedback('complete')"])assert.ok(focus.includes(token),token);
 assert.match(css,/\.atlas-v2 \.a-focus-room/);
});

test('Execution redesign stays outside the protected Qur’an implementation',()=>{
 const app=read('client/src/App.tsx'),page=read('client/src/pages/ExecutionV2Page.tsx'),calendar=read('client/src/pages/CalendarV2Page.tsx');
 assert.match(app,/path="\/quran" element={<AppShell \/>}/);
 for(const source of [page,calendar])assert.doesNotMatch(source,/QuranMushafReader|\/api\/quran|quranSurah/);
});
