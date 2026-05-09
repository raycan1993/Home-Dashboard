/**
 * OAuth start + callback routes for Microsoft and Strava.
 *
 * Security:
 *   - Each callback verifies the `state` parameter against the DB
 *     (CSRF defence — OWASP A07).
 *   - The `code` and `state` query params are validated for shape.
 *   - On success we redirect back to the SPA with no sensitive data
 *     in the URL — tokens never appear in the browser.
 */
import { Router } from 'express';
import { z } from 'zod';
import { oauthLimiter } from '../middleware/rateLimit';
import { HttpError } from '../middleware/errorHandler';
import { env } from '../config/env';
import {
  buildMicrosoftAuthUrl,
  exchangeMicrosoftCode,
} from '../services/todoService';
import {
  buildStravaAuthUrl,
  exchangeStravaCode,
} from '../services/stravaService';

export const oauthRouter = Router();
oauthRouter.use(oauthLimiter);

const CallbackQuerySchema = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(8).max(256),
});

// ---------- Microsoft ----------

oauthRouter.get('/microsoft/start', async (_req, res, next) => {
  try {
    const url = await buildMicrosoftAuthUrl();
    res.redirect(url);
  } catch (err) {
    next(new HttpError('Microsoft OAuth not configured', 500, 'oauth_not_configured'));
  }
});

oauthRouter.get('/microsoft/callback', async (req, res, next) => {
  const parsed = CallbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return next(new HttpError('missing or invalid code/state', 400, 'invalid_request'));
  }
  try {
    await exchangeMicrosoftCode(parsed.data.code, parsed.data.state);
    res.redirect(`${env.CORS_ORIGIN}/?connected=microsoft`);
  } catch (err) {
    next(err);
  }
});

// ---------- Strava ----------

oauthRouter.get('/strava/start', async (_req, res, next) => {
  try {
    const url = await buildStravaAuthUrl();
    res.redirect(url);
  } catch (err) {
    next(new HttpError('Strava OAuth not configured', 500, 'oauth_not_configured'));
  }
});

oauthRouter.get('/strava/callback', async (req, res, next) => {
  const parsed = CallbackQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return next(new HttpError('missing or invalid code/state', 400, 'invalid_request'));
  }
  try {
    await exchangeStravaCode(parsed.data.code, parsed.data.state);
    res.redirect(`${env.CORS_ORIGIN}/?connected=strava`);
  } catch (err) {
    next(err);
  }
});
