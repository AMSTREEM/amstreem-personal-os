'use strict';

const crypto = require('node:crypto');
const { AtlasEventSchema } = require('../packages/contracts');

const MAX_EVENTS_PER_REQUEST = 50;
const MAX_IMPORTED_EVENTS = 5000;

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
  if (context.pendingEvents.length >= MAX_EVENTS_PER_REQUEST) {
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

function validateImportedAtlasEvents(events) {
  if (!Array.isArray(events) || events.length > MAX_IMPORTED_EVENTS) {
    throw new TypeError('The backup contains too many activity events to import.');
  }
  const keys = new Set();
  return events.map(input => {
    const event = createAtlasEvent({ ...input, source: 'import' });
    if (keys.has(event.key)) throw new TypeError('The backup contains duplicate activity event keys.');
    keys.add(event.key);
    return event;
  });
}

function appendImportedAtlasEvents(context, events) {
  if (!context || !Array.isArray(context.pendingEvents)) {
    throw new Error('Imported Atlas events can only be appended inside an authenticated workspace request.');
  }
  const imported = validateImportedAtlasEvents(events || []);
  if (context.pendingEvents.length + imported.length > MAX_IMPORTED_EVENTS) {
    throw new TypeError('The combined activity event batch is too large.');
  }
  context.pendingEvents.push(...imported);
  return imported.length;
}

function validateAtlasEventBatch(events) {
  if (!Array.isArray(events) || events.length > MAX_IMPORTED_EVENTS) {
    throw new TypeError('Atlas event batch exceeds the allowed size.');
  }
  return events.map(event => createAtlasEvent(event));
}

module.exports = {
  MAX_EVENTS_PER_REQUEST,
  MAX_IMPORTED_EVENTS,
  createAtlasEvent,
  appendAtlasEvent,
  appendImportedAtlasEvents,
  validateImportedAtlasEvents,
  validateAtlasEventBatch
};
