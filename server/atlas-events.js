'use strict';

const crypto = require('node:crypto');
const { AtlasEventSchema } = require('../packages/contracts');

const MAX_EVENTS_PER_COMMIT = 50;

function createAtlasEvent(input) {
  const parsed = AtlasEventSchema.safeParse(input);
  if (!parsed.success) {
    const error = new Error('Atlas event failed its shared contract: ' + parsed.error.issues.map(issue => issue.path.join('.') + ' ' + issue.message).join('; '));
    error.code = 'ATLAS_EVENT_INVALID';
    error.issues = parsed.error.issues;
    throw error;
  }
  return parsed.data;
}

function appendAtlasEvent(context, input) {
  if (!context || !Array.isArray(context.pendingEvents)) {
    throw new Error('Atlas events can only be published inside an authenticated workspace request.');
  }
  if (context.pendingEvents.length >= MAX_EVENTS_PER_COMMIT) {
    throw new Error('This workspace mutation produced too many events.');
  }
  const sequence = context.pendingEvents.length + 1;
  const key = context.idempotencyKey
    ? context.idempotencyKey + ':evt:' + sequence
    : crypto.randomUUID();
  const event = createAtlasEvent({
    ...input,
    key,
    occurredAt: input.occurredAt || new Date().toISOString(),
    source: input.source || 'user'
  });
  context.pendingEvents.push(event);
  return event;
}

function validateAtlasEventBatch(events) {
  if (!Array.isArray(events) || events.length > MAX_EVENTS_PER_COMMIT) {
    throw new TypeError('Atlas event batch must contain between 0 and ' + MAX_EVENTS_PER_COMMIT + ' events.');
  }
  return events.map(event => createAtlasEvent(event));
}

module.exports = {
  MAX_EVENTS_PER_COMMIT,
  createAtlasEvent,
  appendAtlasEvent,
  validateAtlasEventBatch
};
