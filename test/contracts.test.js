'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  AtlasEventSchema,
  ModuleManifestSchema,
  ProblemDetailsSchema,
  problemDetails,
  IdempotencyKeySchema,
  ApiJsonResponseSchema,
  BootstrapResponseSchema
} = require('../packages/contracts');

test('problem details use the shared RFC 9457 application contract', () => {
  const problem = problemDetails({
    status: 409,
    code: 'conflict',
    title: 'Conflict',
    detail: 'The resource changed.',
    requestId: 'req_test_123',
    instance: '/api/v1/actions'
  });
  assert.equal(ProblemDetailsSchema.parse(problem).status, 409);
  assert.equal(problem.type, 'https://amstreem.app/problems/conflict');
});

test('problem details reject undeclared fields', () => {
  assert.equal(ProblemDetailsSchema.safeParse({
    type: 'https://amstreem.app/problems/internal',
    title: 'Internal error',
    status: 500,
    code: 'internal',
    requestId: 'req_test_123',
    unexpected: true
  }).success, false);
});

test('event envelope rejects unknown fields and invalid module ids', () => {
  const event = {
    key: 'task.completed:42:2026-11-27',
    type: 'task.completed',
    module: 'actions',
    occurredAt: '2026-11-27T11:00:00Z',
    localDate: '2026-11-27',
    payload: { goalLinked: false },
    source: 'user'
  };
  assert.equal(AtlasEventSchema.safeParse(event).success, true);
  assert.equal(AtlasEventSchema.safeParse({ ...event, module: 'quran' }).success, false);
  assert.equal(AtlasEventSchema.safeParse({ ...event, accountId: 'not-allowed' }).success, false);
});

test('module manifests are strict and use supported navigation groups', () => {
  const manifest = {
    id: 'actions',
    name: 'Actions',
    icon: 'check-square',
    accent: 'orange',
    routes: ['/actions'],
    nav: { group: 'plan', order: 0 }
  };
  assert.equal(ModuleManifestSchema.safeParse(manifest).success, true);
  assert.equal(ModuleManifestSchema.safeParse({ ...manifest, privateImport: true }).success, false);
});

test('idempotency keys have bounded lengths', () => {
  assert.equal(IdempotencyKeySchema.safeParse('atlas-test-key-123').success, true);
  assert.equal(IdempotencyKeySchema.safeParse('short').success, false);
});

test('shared API success responses are JSON objects or arrays', () => {
  assert.equal(ApiJsonResponseSchema.safeParse({ ok: true }).success, true);
  assert.equal(ApiJsonResponseSchema.safeParse([{ id: 1 }]).success, true);
  assert.equal(ApiJsonResponseSchema.safeParse('unexpected scalar').success, false);
});

test('bootstrap response is a strict typed contract', () => {
  const payload = {
    user: { id: 'user_1', email: null, name: '', username: '' },
    role: 'user',
    today: '2026-11-27',
    settings: {},
    navigationBadges: {}
  };
  assert.equal(BootstrapResponseSchema.safeParse(payload).success, true);
  assert.equal(BootstrapResponseSchema.safeParse({ ...payload, unexpected: true }).success, false);
});
