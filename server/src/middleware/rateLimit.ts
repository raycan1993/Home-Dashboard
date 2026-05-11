/**
 * Per-route rate limiting for dashboard API endpoints.
 */
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many requests' } },
});
