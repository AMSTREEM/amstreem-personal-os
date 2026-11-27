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

const AtlasEventSchema = z.object({
  key: z.string().trim().min(1).max(240),
  type: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
  module: ModuleIdSchema,
  entityId: z.string().min(1).optional(),
  occurredAt: UtcInstantSchema,
  localDate: DateOnlySchema,
  payload: z.record(z.string(), z.unknown()),
  source: EventSourceSchema
}).strict();

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
  AtlasEventSchema,
  ModuleManifestSchema,
  BootstrapResponseSchema,
  ApiJsonResponseSchema,
  CursorPageQuerySchema,
  problemDetails,
  validate
};
