function apiProblemResponses() {
  return (req, res, next) => {
    if (/^\\/quran(?:\\/|$)/.test(req.path)) return next();
    const originalJson = res.json.bind(res);
    res.json = body => {
      if (res.statusCode < 400 || !body || typeof body !== 'object' || Array.isArray(body) || body.type) {
        return originalJson(body);
      }
      const detail = typeof body.detail === 'string'
        ? body.detail
        : typeof body.error === 'string'
          ? body.error
          : 'The request could not be completed.';
      const problem = {
        type: 'about:blank',
        title: res.statusCode >= 500 ? 'Request Failed' : res.statusCode === 404 ? 'Not Found' : 'Request Rejected',
        status: res.statusCode,
        detail,
        code: typeof body.code === 'string' ? body.code : 'http_error',
        ...body
      };
      res.type('application/problem+json');
      return originalJson(problem);
    };
    next();
  };
}

module.exports = { apiProblemResponses };
