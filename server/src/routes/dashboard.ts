/**
 * /api/dashboard — single endpoint that aggregates the dashboard widgets.
 *
 * All five widgets fetch in parallel; one widget failing does not break the
 * others (Promise.allSettled). The response envelope is always ApiResponse<T>.
 */
import { Router } from 'express';
import type { ApiResponse, DashboardSnapshot } from '@home-dashboard/shared';
import { getWeather } from '../services/weatherService';
import { getTrainConnections } from '../services/trainService';
import { getTodoItems } from '../services/todoService';
import { getGroceries } from '../services/bringService';
import { getRunningStats } from '../services/stravaService';
import { logger } from '../utils/logger';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (_req, res, next) => {
  try {
    const [weather, trains, todos, groceries, running] = await Promise.allSettled([
      getWeather(),
      getTrainConnections(),
      getTodoItems(),
      getGroceries(),
      getRunningStats(),
    ]);

    const failures: string[] = [];
    if (weather.status === 'rejected') failures.push('weather');
    if (trains.status === 'rejected') failures.push('trains');
    if (todos.status === 'rejected') failures.push('todos');
    if (groceries.status === 'rejected') failures.push('groceries');
    if (running.status === 'rejected') failures.push('running');
    if (failures.length) {
      logger.warn('Dashboard', 'partial failure', { failures });
    }

    const data: DashboardSnapshot = {
      weather: weather.status === 'fulfilled' ? weather.value : null,
      trains: trains.status === 'fulfilled' ? trains.value : [],
      todos: todos.status === 'fulfilled' ? todos.value : [],
      groceries: groceries.status === 'fulfilled' ? groceries.value : [],
      running: running.status === 'fulfilled' ? running.value : null,
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
