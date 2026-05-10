/**
 * /api/health — liveness probe and connection-status summary.
 * Never returns secrets, only booleans for "is X provider connected".
 */
import { Router } from 'express';
import type { ApiResponse, ConnectionStatus } from '@home-dashboard/shared';
import { isProviderConnected } from '../utils/tokenStore';
import { env } from '../config/env';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res, next) => {
  try {
    const status: ConnectionStatus = {
      microsoft: await isProviderConnected('microsoft'),
      strava: await isProviderConnected('strava'),
      bring: await isProviderConnected('bring') || (!!env.BRING_EMAIL && !!env.BRING_PASSWORD),
      // Open-Meteo needs no key — always available.
      weather: true,
    };
    const body: ApiResponse<ConnectionStatus> = {
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    };
    res.json(body);
  } catch (err) {
    next(err);
  }
});
