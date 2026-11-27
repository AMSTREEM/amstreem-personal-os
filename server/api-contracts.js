const { z } = require('zod');

const positiveIdSchema = z.coerce.number().int().positive().safe();
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD.');
const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100000).default(0)
}).strict();
const communicationStyleSchema = z.enum(['adaptive', 'jarvis', 'companion', 'advisor']);
const communicationSettingsSchema = z.object({
  communication_style: communicationStyleSchema
}).strict();

function validationProblem(error) {
  return {
    type: 'https://atlas.amstreem.com/problems/validation-error',
    title: 'Request validation failed',
    status: 400,
    detail: 'One or more request fields are invalid.',
    code: 'validation_error',
    errors: error.issues.map(issue => ({
      path: issue.path.map(String).join('.'),
      message: issue.message
    }))
  };
}

function validateRequest(schema, source = 'body') {
  if (!['body', 'params', 'query'].includes(source)) {
    throw new TypeError('Validation source must be body, params, or query.');
  }
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const problem = validationProblem(result.error);
      res.status(problem.status).type('application/problem+json').json(problem);
      return;
    }
    req.validated ||= {};
    req.validated[source] = result.data;
    next();
  };
}

const requestObjectSchema = z.record(z.string(), z.unknown());

function validateApiEnvelope() {
  return (req, res, next) => {
    const pathname = req.path || '';
    if (pathname === '/api/quran' || pathname.startsWith('/api/quran/')) return next();
    const sources = ['params', 'query'];
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) sources.push('body');
    const parsed = {};
    for (const source of sources) {
      const value = req[source] === undefined ? {} : req[source];
      const result = requestObjectSchema.safeParse(value);
      if (!result.success) {
        const problem = validationProblem(result.error);
        res.status(problem.status).type('application/problem+json').json(problem);
        return;
      }
      parsed[source] = result.data;
    }
    req.validated ||= {};
    Object.assign(req.validated, parsed);
    next();
  };
}

function sendProblem(res, { status = 500, title = 'Internal Server Error', detail = 'The request could not be completed.', code = 'internal_error', type, instance } = {}) {
  const problem = {
    type: type || 'about:blank',
    title,
    status,
    detail,
    code
  };
  if (instance) problem.instance = instance;
  return res.status(status).type('application/problem+json').json(problem);
}

module.exports = {
  positiveIdSchema,
  dateKeySchema,
  paginationQuerySchema,
  communicationStyleSchema,
  communicationSettingsSchema,
  validateRequest,
  validateApiEnvelope,
  requestObjectSchema,
  validationProblem,
  sendProblem
};
