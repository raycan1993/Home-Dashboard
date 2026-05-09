/**
 * Lightweight request logger.
 *
 * Note: morgan is deliberately not used. We log only method, path, status,
 * duration, and a redacted query — never headers, never body, never the
 * raw URL with query parameters intact.
 */
import type { Request, Response, NextFunction } from 'express';
import { logger, redactUrl } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = redactUrl(req.originalUrl);
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.log(
      'info',
      'IN',
      'HTTP',
      `${req.method} ${path}`,
      { method: req.method, url: path, statusCode: res.statusCode, duration },
    );
  });
  next();
}
