/**
 * /api/dashboard - aggregates all dashboard widgets.
 * One widget failing does not break the others (Promise.allSettled).
 * Accepts ?plz=<4, 6, or legacy 7 digits> to override the weather location.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, DashboardSnapshot } from '@home-dashboard/shared';
import { getWeather } from '../services/weatherService';
import { getTrainConnections } from '../services/trainService';
import { logger } from '../utils/logger';

const QuerySchema = z.object({
  plz: z.string().regex(/^\d{4}(\d{2}|\d{3})?$/).optional(),
});

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res, next) => {
  try {
    const parsedQuery = QuerySchema.safeParse(req.query);
    const plzOverride = parsedQuery.success ? parsedQuery.data.plz : undefined;

    const [weather, trains] = await Promise.allSettled([
      getWeather(plzOverride),
      getTrainConnections(),
    ]);

    const failures: string[] = [];
    if (weather.status === 'rejected') failures.push('weather');
    if (trains.status === 'rejected') failures.push('trains');
    if (failures.length) logger.warn('Dashboard', 'partial failure', { failures });

    const data: DashboardSnapshot = {
      weather: weather.status === 'fulfilled' ? weather.value : null,
      trains: trains.status === 'fulfilled' ? trains.value : [],
      lastUpdated: new Date().toISOString(),
    };

    const body: ApiResponse<DashboardSnapshot> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
