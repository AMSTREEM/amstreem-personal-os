'use strict';

const crypto = require('node:crypto');
const EVENT_MODULES = new Set(['residence','actions','goals','calendar','habits','learning','growth','values']);
const EVENT_TYPES = new Set(['task.completed','task.reopened','focus.ended','goal.completed','goal.reopened','goal.milestone_reached','goal.milestone_unreached','habit.checked','habit.unchecked','learning.item_completed','learning.item_reopened','learning.study_logged','review.submitted','review.reopened','practice.logged','practice.unlogged','challenge.completed']);
const SOURCES = new Set(['user','system','import']);
const DATE_KEY = /^\\d{4}-\\d{2}-\\d{2}$/;
function createAtlasEvent({ requestKey, type, module, entityId = null, occurredAt = new Date(), localDate, payload = {}, source = 'user' }) {
  if (typeof requestKey !== 'string' || requestKey.length < 8 || requestKey.length > 240) throw new TypeError('A valid request key is required for an Atlas event.');
  if (!EVENT_TYPES.has(type)) throw new TypeError('Unsupported Atlas event type.');
  if (!EVENT_MODULES.has(module)) throw new TypeError('Unsupported Atlas event module.');
  if (entityId !== null && (typeof entityId !== 'string' || !entityId.length || entityId.length > 160)) throw new TypeError('Invalid Atlas event entity ID.');
  if (typeof localDate !== 'string' || !DATE_KEY.test(localDate) || Number.isNaN(Date.parse(localDate + 'T12:00:00Z'))) throw new TypeError('Atlas event localDate must be YYYY-MM-DD.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new TypeError('Atlas event payload must be an object.');
  if (!SOURCES.has(source)) throw new TypeError('Unsupported Atlas event source.');
  const occurred = occurredAt instanceof Date ? occurredAt : new Date(occurredAt);
  if (Number.isNaN(occurred.getTime())) throw new TypeError('Atlas event occurredAt must be a valid timestamp.');
  const digest = crypto.createHash('sha256').update(requestKey).digest('hex').slice(0, 32);
  const key = 'atlas:' + digest + ':' + type + ':' + (entityId || 'event');
  if (key.length > 240) throw new TypeError('Atlas event key exceeds the storage limit.');
  return { key, type, module, entityId, occurredAt: occurred.toISOString(), localDate, payload, source };
}
module.exports = { EVENT_MODULES, EVENT_TYPES, createAtlasEvent };
