import { ApiError } from '../utils/ApiError.js';

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const statusCode = error.name === 'MulterError' ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
    : error instanceof ApiError ? error.statusCode
    : error.type === 'entity.too.large' ? 413
    : error.type === 'entity.parse.failed' ? 400 : 500;
  const message = error.name === 'MulterError' ? (statusCode === 413 ? 'Logo must be no larger than 5 MiB' : 'Provide one logo file and listing version')
    : error instanceof ApiError ? error.message
    : statusCode === 413 ? 'Request body too large'
    : statusCode === 400 ? 'Invalid JSON body' : 'Internal server error';
  if (statusCode >= 500) {
    // Do not log request bodies, Authorization headers, or upstream error objects.
    console.error(JSON.stringify({ requestId: req.id, event: 'request_failed', statusCode }));
  }
  res.status(statusCode).json({ error: { message, requestId: req.id } });
}
