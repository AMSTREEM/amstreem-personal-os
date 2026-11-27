'use strict';

const { z } = require('zod');

const bodyKeys = [
  'admin_tradition', 'all', 'all_day', 'author', 'ayah_end', 'ayah_start', 'body',
  'category', 'completed', 'content', 'date', 'description', 'detail',
  'distractions', 'done', 'due_date', 'emoji', 'end_at', 'faith_tradition',
  'features', 'focus', 'goal_id', 'horizon', 'item_type', 'juz', 'kind',
  'lesson_id', 'life_areas', 'log_date', 'message', 'metadata', 'minutes',
  'name', 'note', 'notes', 'on_time', 'outcome', 'pages', 'parent_task_id', 'password',
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

const legacyImportKeys = [
  'goals', 'projects', 'project_milestones', 'tasks', 'modules', 'learning_paths',
  'learning_lessons', 'learning_resources', 'learning_study_logs', 'sessions',
  'calendar_events', 'notes', 'reviews', 'habits', 'habit_logs', 'prayer_logs',
  'quran_logs', 'tahajjud_logs', 'faith_logs', 'self_control_logs',
  'self_control_trackers', 'self_control_entries', 'rhythm_records',
  'reading_items', 'settings', 'email_events', 'login_events', 'xp_events',
  'achievement_unlocks', 'weekly_challenges', 'feedback_logs', 'exportedAt'
];
const BackupEnvelopeSchema = z.object({
  format: z.literal('atlas-backup'),
  schemaVersion: z.number().int().min(1).max(3),
  exportedAt: z.string().optional(),
  appVersion: z.string().optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  data: z.record(z.string(), z.unknown())
}).strict();
const LegacyBackupSchema = z.object(optionalUnknownShape(legacyImportKeys)).strict();
const bodyShape = optionalUnknownShape(bodyKeys);
const strings = ['title','detail','body','description','message','name','username','password','subject','url','author','notes','note','reflection','focus','category','type','item_type','status','kind','horizon','session_kind','record_type','activity','religion','faith_tradition','admin_tradition','theme','symbol','emoji','surah','date','log_date','record_date','due_date','target_date','start_date','start_at','end_at','session_date','period_start','period_end','period_type','session_key','trigger','response','signal','recommendationId'];
for (const key of strings) bodyShape[key] = z.union([z.string().max(10000), z.null()]).optional();
const ids = ['goal_id','project_id','task_id','lesson_id','parent_task_id'];
for (const key of ids) bodyShape[key] = z.union([z.string(), z.number().int(), z.null()]).optional();
const numbers = ['minutes','priority','pages','juz','ayah_start','ayah_end','urge_level'];
for (const key of numbers) bodyShape[key] = z.union([z.number().finite(), z.string().regex(/^\\d+(?:\\.\\d+)?$/)]).optional();
const booleans = ['completed','done','all_day','on_time','woke_up','prayed'];
for (const key of booleans) bodyShape[key] = z.union([z.boolean(), z.number().int().min(0).max(1)]).optional();
bodyShape.distractions = z.array(z.unknown()).optional();
bodyShape.metadata = z.record(z.string(), z.unknown()).optional();
bodyShape.userIds = z.array(z.string()).optional();
const BodySchema = z.object(bodyShape).strict();
const QuerySchema = z.object({
  date: z.string().max(40).optional(),
  end: z.string().max(40).optional(),
  month: z.string().regex(/^\\d{4}-\\d{2}$/).optional(),
  period: z.enum(['daily', 'weekly']).optional(),
  start: z.string().max(40).optional()
}).strict();
const ParamsSchema = z.object({
  id: z.string().min(1).max(128).optional(),
  page: z.string().regex(/^\\d+$/).optional(),
  surah: z.string().regex(/^\\d+$/).optional()
}).strict();
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
    ['body', req.body,
      req.path === '/api/import' || req.path === '/api/import/preview'
        ? z.union([BackupEnvelopeSchema, LegacyBackupSchema])
        : BodySchema],
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
