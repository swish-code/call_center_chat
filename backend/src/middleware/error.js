'use strict';

/** Wrap an async route handler so thrown errors reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** 404 for unmatched routes. */
function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

/** Central error handler. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error('Error:', err.stack || err.message);
  res.status(status).json({
    error: err.message || 'Internal server error',
    code: err.code,
  });
}

module.exports = { asyncHandler, notFound, errorHandler };
