/**
 * /api/weather — location search and explicit single-PLZ fetch.
 *
 * /api/weather/search?q=<text>  — MeteoSwiss location lookup (returns { plz, label }[])
 * /api/weather?plz=<7 digits>   — single-widget refresh; the dashboard route
 *                                  also accepts ?plz= for the same purpose.
 *
 * Security:
 *   - Query strings validated with Zod (regex bounds on the search term and
 *     a strict 7-digit pattern on PLZ).
 *   - Errors never leak upstream details — generic 400 with a stable code.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, WeatherData, WeatherLocation } from '@home-dashboard/shared';
import { getWeather, searchLocations } from '../services/weatherService';
import { HttpError } from '../middleware/errorHandler';

export const weatherRouter = Router();

const SearchQuerySchema = z.object({
  q: z.string().min(2).max(60),
});

const PlzQuerySchema = z.object({
  plz: z.string().regex(/^\d{4}(\d{2}|\d{3})?$/).optional(),
});

weatherRouter.get('/search', async (req, res, next) => {
  const parsed = SearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return next(new HttpError('q must be 2-60 chars', 400, 'invalid_query'));
  }
  try {
    const results = await searchLocations(parsed.data.q);
    const body: ApiResponse<WeatherLocation[]> = {
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

weatherRouter.get('/', async (req, res, next) => {
  const parsed = PlzQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return next(new HttpError('plz must be 4, 6, or 7 digits', 400, 'invalid_plz'));
  }
  try {
    const data = await getWeather(parsed.data.plz);
    const body: ApiResponse<WeatherData> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
