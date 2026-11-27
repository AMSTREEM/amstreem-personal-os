'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { apiRequestContract } = require('../server/api-request-contract');

function invoke({ path = '/api/tasks', body, query = {}, params = {} } = {}) {
  const req = {
    path,
    body,
    query,
    params,
    get(name) { return name === 'Idempotency-Key' ? undefined : undefined; }
  };
  let status = 200;
  let payload;
  let continued = false;
  const res = {
    status(value) { status = value; return this; },
    json(value) { payload = value; return this; }
  };
  apiRequestContract(req, res, () => { continued = true; });
  return { status, payload, continued };
}

test('strict request contracts reject undeclared JSON body fields', () => {
  const result = invoke({ body: { title: 'Task', unexpectedAdminFlag: true } });
  assert.equal(result.status, 400);
  assert.equal(result.continued, false);
  assert.equal(result.payload.errors[0].field, 'unexpectedAdminFlag');
});

test('strict request contracts reject undeclared query parameters', () => {
  const result = invoke({ path: '/api/calendar', query: { month: '2026-11', debug: 'true' } });
  assert.equal(result.status, 400);
  assert.equal(result.payload.errors[0].field, 'query.debug');
});

test('strict request contracts reject undeclared route parameters', () => {
  const result = invoke({ path: '/api/tasks/:id', params: { id: '4', ownerId: 'x' } });
  assert.equal(result.status, 400);
  assert.equal(result.payload.errors[0].field, 'params.ownerId');
});

test('known route request fields pass the strict allowlist', () => {
  const result = invoke({
    path: '/api/tasks',
    body: { title: 'Study', detail: '', category: 'Learning', due_date: null, priority: 2 },
    query: {},
    params: {}
  });
  assert.equal(result.continued, true);
});

test('Qur’an API requests are excluded from Stage 2 request middleware', () => {
  const result = invoke({ path: '/api/quran/page/1', body: { unexpected: true } });
  assert.equal(result.continued, true);
});

test('backup envelopes are accepted for the dedicated import endpoints', () => {
  const result = invoke({
    path: '/api/import/preview',
    body: {
      format: 'atlas-backup',
      schemaVersion: 3,
      checksum: 'a'.repeat(64),
      data: { goals: [] }
    }
  });
  assert.equal(result.continued, true);
});
