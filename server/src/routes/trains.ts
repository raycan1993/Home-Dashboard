/**
 * /api/trains — station search and on-demand connection lookup.
 *
 * GET /api/trains/stations?q=<text>           → StationLocation[]
 * GET /api/trains/connections?from=&to=        → TrainConnection[]
 */
import { Router } from 'express';
import { z } from 'zod';
import type { ApiResponse, StationLocation, TrainConnection } from '@home-dashboard/shared';
import { searchStations, getTrainConnectionsForRoute } from '../services/trainService';
import { HttpError } from '../middleware/errorHandler';

export const trainsRouter = Router();

trainsRouter.get('/stations', async (req, res, next) => {
  const schema = z.object({ q: z.string().min(2).max(80) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return next(new HttpError('q must be 2–80 characters', 400, 'invalid_query'));
  }
  try {
    const stations = await searchStations(parsed.data.q);
    const body: ApiResponse<StationLocation[]> = {
      success: true,
      data: stations,
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});

trainsRouter.get('/connections', async (req, res, next) => {
  const schema = z.object({
    from: z.string().min(1).max(100),
    to: z.string().min(1).max(100),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return next(new HttpError('from and to are required', 400, 'invalid_params'));
  }
  try {
    const connections = await getTrainConnectionsForRoute(parsed.data.from, parsed.data.to);
    const body: ApiResponse<TrainConnection[]> = {
      success: true,
      data: connections,
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
