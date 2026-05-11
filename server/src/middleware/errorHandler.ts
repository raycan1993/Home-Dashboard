/**
 * Centralised error handler.
 *
 * - Never leaks stack traces, library messages, or upstream details to the client
 *   (OWASP A05: Security Misconfiguration / OWASP A09: information disclosure).
 * - Maps a small set of known error codes to friendly messages.
 * - Always JSON, always the ApiResponse envelope.
 */
import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import type { ApiResponse } from '@home-dashboard/shared';

export class HttpError extends Error {
  constructor(
    public override readonly message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
  }
}

export const notFoundHandler = (_req: Request, res: Response) => {
  const body: ApiResponse<never> = {
    success: false,
    error: { code: 'not_found', message: 'Resource not found' },
    timestamp: new Date().toISOString(),
  };
  res.status(404).json(body);
};

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) => {
  let status = 500;
  let code = 'internal_error';
  let message = 'Something went wrong';

  if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    message = err.message;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'validation_error';
    message = 'Request failed validation';
  }

  logger.error('HTTP', `${req.method} ${req.path} -> ${status}`, {
    code,
    error: err instanceof Error ? err.message : String(err),
  });

  const body: ApiResponse<never> = {
    success: false,
    error: { code, message },
    timestamp: new Date().toISOString(),
  };
  res.status(status).json(body);
};
