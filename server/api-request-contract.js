'use strict';

const { z } = require('zod');

const bodyKeys = [
  'admin_tradition', 'all', 'all_day', 'ayah_end', 'ayah_start', 'body',
  'category', 'completed', 'content', 'date', 'description', 'detail',
  'distractions', 'done', 'due_date', 'emoji', 'end_at', 'faith_tradition',
  'features', 'focus', 'goal_id', 'horizon', 'item_type', 'juz', 'kind',
  'lesson_id', 'life_areas', 'log_date', 'message', 'metadata', 'minutes',
  'name', 'note', 'on_time', 'outcome', 'pages', 'parent_task_id', 'password',
  'period_end', 'period_start', 'period_type', 'prayed', 'prayer', 'priority',
  'project_id', 'record_date', 'record_type', 'recommendationId', 'reflection',
  'religion', 'response', 'session_date', 'session_key', 'session_kind',
  'signal', 'start_at', 'start_date', 'status', 'subject', 'surah', 'symbol',
  'target_date', 'task_id', 'theme', 'title', 'trigger', 'type', 'url',
  'urge_level', 'userIds', 'username', 'woke_up', 'widgets'
];

const queryKeys = ['date', 'end', 'month', 'period', 'start'];
const paramKeys = ['id', 'page', 'surah'];

function optionalUnknownShape(keys) {
  return Object.fromEntries(keys.map(key => [key, z.unknown().optional()]));
}

const BodySchema = z.object(optionalUnknownShape(bodyKeys)).strict();
const QuerySchema = z.object(optionalUnknownShape(queryKeys)).strict();
const ParamsSchema = z.object(optionalUnknownShape(paramKeys)).strict();
const IdempotencyKeySchema = z.string().trim().min(8).max(200);

function issueList(error) {
  return error.issues.map(issue => ({
    field: issue.path.length ? issue.path.join('.') : 'request',
    message: issue.message,
    code: issue.code
  }));
}

function apiRequestContract(req, res, next) {
  if (!req.path.startsWith('/api/') || req.path.startsWith('/api/quran/')) return next();

  const checks = [
    ['body', req.body, BodySchema],
    ['query', req.query, QuerySchema],
    ['params', req.params, ParamsSchema]
  ];

  for (const [source, value, schema] of checks) {
    if (value === undefined && source === 'body') continue;
    const result = schema.safeParse(value ?? {});
    if (!result.success) {
      const errors = issueList(result.error).map(issue => ({
        ...issue,
        field: source === 'body' ? issue.field : source + '.' + issue.field
      }));
      return res.status(400).json({
        error: 'The request contains fields that are not part of this API contract.',
        errors
      });
    }
  }

  const idempotencyKey = req.get('Idempotency-Key');
  if (idempotencyKey !== undefined && !IdempotencyKeySchema.safeParse(idempotencyKey).success) {
    return res.status(400).json({
      error: 'Idempotency-Key must contain between 8 and 200 characters.',
      errors: [{ field: 'header.Idempotency-Key', message: 'Expected 8–200 characters.', code: 'invalid_string' }]
    });
  }

  return next();
}

module.exports = {
  apiRequestContract,
  BodySchema,
  QuerySchema,
  ParamsSchema,
  IdempotencyKeySchema
};
