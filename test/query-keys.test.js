const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'client/src/lib/queryKeys.ts'), 'utf8');

test('Qur\'an query-key compatibility aliases retain the frozen exact arrays', () => {
  assert.match(source, /settings:\s*\['settings'\]\s+as const/);
  assert.match(source, /deenInvalidation:\s*\['deen'\]\s+as const/);
  assert.match(source, /rhythmSummaryInvalidation:\s*\['rhythm-summary'\]\s+as const/);
  assert.match(source, /overviewInvalidation:\s*\['overview'\]\s+as const/);
});

test('workspace query keys are centralized without changing the frozen reader', () => {
  assert.match(source, /tasks:\s*\['tasks'\]\s+as const/);
  assert.match(source, /goals:\s*\['goals'\]\s+as const/);
  assert.match(source, /sessions:\s*\['sessions'\]\s+as const/);
  assert.match(source, /deen:\s*\(date\?\s*:\s*string\)/);
  assert.match(source, /habits:\s*\(date\?\s*:\s*string\)/);
});
