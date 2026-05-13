/**
 * /api/rocky — Rocky weather assistant.
 *
 * Returns a pool of weather-contextual Rocky-style messages.
 * The client cycles through them locally every 10 s.
 *
 * Accepts the same optional ?plz= parameter as /api/weather and
 * /api/dashboard so it follows the active location the user selected.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse } from '@home-dashboard/shared';
import { getWeather } from '../services/weatherService';
import { generateRockyMessages } from '../services/rockyService';
import { HttpError } from '../middleware/errorHandler';

export const rockyRouter = Router();

const PlzQuerySchema = z.object({
  plz: z.string().regex(/^\d{4}(\d{2}|\d{3})?$/).optional(),
});

rockyRouter.get('/', async (req, res, next) => {
  const parsed = PlzQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return next(new HttpError('plz must be 4, 6, or 7 digits', 400, 'invalid_plz'));
  }
  try {
    const weather = await getWeather(parsed.data.plz);
    const messages = generateRockyMessages(weather);
    const body: ApiResponse<string[]> = {
      success: true,
      data: messages,
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
