'use strict';

const { z } = require('zod');

const ModuleIdSchema = z.enum([
  'residence',
  'actions',
  'goals',
  'calendar',
  'habits',
  'learning',
  'growth',
  'values'
]);

const EventSourceSchema = z.enum(['user', 'system', 'import']);
const DateOnlySchema = z.iso.date();
const UtcInstantSchema = z.iso.datetime({ offset: true });
const IdempotencyKeySchema = z.string().trim().min(8).max(200);

const ValidationIssueSchema = z.object({
  field: z.string().min(1),
  message: z.string().min(1),
  code: z.string().min(1).optional()
}).strict();

const ProblemDetailsSchema = z.object({
  type: z.string().url(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  code: z.enum([
    'unauthenticated',
    'forbidden',
    'validation_failed',
    'not_found',
    'conflict',
    'rate_limited',
    'payload_too_large',
    'internal'
  ]),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().min(1),
  errors: z.array(ValidationIssueSchema).optional()
}).strict();

const AtlasEventTypeSchema = z.enum([
  'task.completed', 'task.reopened',
  'focus.ended',
  'goal.completed', 'goal.reopened', 'goal.milestone_reached', 'goal.milestone_unreached',
  'habit.checked', 'habit.unchecked',
  'learning.item_completed', 'learning.item_reopened', 'learning.study_logged',
  'review.submitted', 'review.reopened',
  'practice.logged',
  'challenge.completed'
]);

const AtlasEventPayloadSchemas = Object.freeze({
  'task.completed': z.object({ goalLinked: z.boolean() }).strict(),
  'task.reopened': z.object({}).strict(),
  'focus.ended': z.object({ minutes: z.number().int().min(1).max(600) }).strict(),
  'goal.completed': z.object({}).strict(),
  'goal.reopened': z.object({}).strict(),
  'goal.milestone_reached': z.object({ projectId: z.string().min(1) }).strict(),
  'goal.milestone_unreached': z.object({ projectId: z.string().min(1) }).strict(),
  'habit.checked': z.object({ logDate: DateOnlySchema }).strict(),
  'habit.unchecked': z.object({ logDate: DateOnlySchema }).strict(),
  'learning.item_completed': z.object({}).strict(),
  'learning.item_reopened': z.object({}).strict(),
  'learning.study_logged': z.object({ minutes: z.number().int().min(1).max(600) }).strict(),
  'review.submitted': z.object({ periodType: z.enum(['daily', 'weekly']), periodStart: DateOnlySchema }).strict(),
  'review.reopened': z.object({ periodType: z.enum(['daily', 'weekly']), periodStart: DateOnlySchema }).strict(),
  'practice.logged': z.object({ practiceType: z.enum(['daily_intention', 'wisdom_note', 'evening_reflection']) }).strict(),
  'challenge.completed': z.object({
    challengeId: z.string().min(1).max(80),
    metric: z.string().min(1).max(64),
    value: z.number().int().nonnegative(),
    target: z.number().int().positive()
  }).strict()
});

const EVENT_MODULES = Object.freeze({
  'task.completed': 'actions',
  'task.reopened': 'actions',
  'focus.ended': 'actions',
  'goal.completed': 'goals',
  'goal.reopened': 'goals',
  'goal.milestone_reached': 'goals',
  'goal.milestone_unreached': 'goals',
  'habit.checked': 'habits',
  'habit.unchecked': 'habits',
  'learning.item_completed': 'learning',
  'learning.item_reopened': 'learning',
  'learning.study_logged': 'learning',
  'review.submitted': 'growth',
  'review.reopened': 'growth',
  'practice.logged': 'values',
  'challenge.completed': 'growth'
});

const AtlasEventSchema = z.object({
  key: z.string().trim().min(8).max(240),
  type: AtlasEventTypeSchema,
  module: ModuleIdSchema,
  entityId: z.string().min(1).max(160).optional(),
  occurredAt: UtcInstantSchema,
  localDate: DateOnlySchema,
  payload: z.record(z.string(), z.unknown()),
  source: EventSourceSchema
}).strict().superRefine((event, context) => {
  const payload = AtlasEventPayloadSchemas[event.type].safeParse(event.payload);
  if (!payload.success) {
    for (const issue of payload.error.issues) {
      context.addIssue({ ...issue, path: ['payload', ...issue.path] });
    }
  }
  if (EVENT_MODULES[event.type] !== event.module) {
    context.addIssue({
      code: 'custom',
      path: ['module'],
      message: 'Event module does not match its publisher contract.'
    });
  }
});

const ModuleManifestSchema = z.object({
  id: ModuleIdSchema,
  name: z.string().min(1),
  icon: z.string().min(1),
  accent: z.string().min(1),
  routes: z.array(z.string().startsWith('/')).min(1),
  nav: z.object({
    group: z.enum(['home', 'plan', 'practice', 'reflect']),
    order: z.number().int().nonnegative()
  }).strict()
}).strict();

const CursorPageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(512).optional()
}).strict();

const ApiJsonResponseSchema = z.union([
  z.array(z.unknown()),
  z.record(z.string(), z.unknown())
]);

const BootstrapResponseSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().email().nullable(),
    name: z.string(),
    username: z.string()
  }).strict(),
  role: z.enum(['user', 'admin']),
  today: DateOnlySchema,
  settings: z.record(z.string(), z.string()),
  navigationBadges: z.record(z.string(), z.number().int().nonnegative())
}).strict();

function problemDetails({ status, code, title, detail, requestId, instance, errors }) {
  return ProblemDetailsSchema.parse({
    type: `https://amstreem.app/problems/${code}`,
    title,
    status,
    code,
    ...(detail ? { detail } : {}),
    ...(instance ? { instance } : {}),
    requestId,
    ...(errors?.length ? { errors } : {})
  });
}

function validate(schema, value) {
  return schema.safeParse(value);
}

module.exports = {
  z,
  ModuleIdSchema,
  EventSourceSchema,
  DateOnlySchema,
  UtcInstantSchema,
  IdempotencyKeySchema,
  ValidationIssueSchema,
  ProblemDetailsSchema,
  AtlasEventTypeSchema,
  AtlasEventPayloadSchemas,
  EVENT_MODULES,
  AtlasEventSchema,
  ModuleManifestSchema,
  BootstrapResponseSchema,
  ApiJsonResponseSchema,
  CursorPageQuerySchema,
  problemDetails,
  validate
};
