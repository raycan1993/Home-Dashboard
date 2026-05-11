/**
 * /api/health - liveness probe and integration-status summary.
 */
import { Router } from 'express';
import type { ApiResponse, ConnectionStatus } from '@home-dashboard/shared';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const status: ConnectionStatus = {
    weather: true,
    trains: true,
  };
  const body: ApiResponse<ConnectionStatus> = {
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  };
  res.json(body);
});
