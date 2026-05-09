/**
 * Per-route rate limiting (OWASP A04: Insecure Design — anti-automation).
 *
 * Two limiters:
 *   - api: generous, applied to all read endpoints (60/min/IP)
 *   - oauth: strict, applied to OAuth start/callback (10/15min/IP)
 *
 * Why split: the OAuth callback is the most sensitive endpoint; an attacker
 * forging callbacks should be throttled fast, even if they spoof source IPs.
 */
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many requests' } },
});

export const oauthLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'rate_limited', message: 'Too many OAuth attempts' } },
});
