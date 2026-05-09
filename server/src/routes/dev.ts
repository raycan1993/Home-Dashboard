/**
 * Developer routes.
 *
 * Disabled entirely when DEVELOPER_MODE !== 'true'. The router returns 404
 * in that case — no information disclosure about its existence.
 *
 * The SSE endpoint streams already-redacted log entries; raw secrets cannot
 * appear because redaction happens at the logger boundary.
 */
import { Router, type Request, type Response } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import type { DevLog } from '@home-dashboard/shared';

export const devRouter = Router();

devRouter.use((req, res, next) => {
  if (!env.DEVELOPER_MODE) {
    res.status(404).json({
      success: false,
      error: { code: 'not_found', message: 'Resource not found' },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  next();
});

devRouter.get('/logs', (_req, res) => {
  res.json({
    success: true,
    data: logger.getLogs(200),
    timestamp: new Date().toISOString(),
  });
});

devRouter.post('/logs/clear', (_req, res) => {
  logger.clear();
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Server-Sent Events stream of new log entries.
devRouter.get('/logs/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const onLog = (entry: DevLog) => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  };
  logger.on('log', onLog);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    logger.off('log', onLog);
  });
});
