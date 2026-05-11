/**
 * Server entry point.
 *   1. Load + validate env (config/env.ts) - fails fast if anything is missing.
 *   2. Connect Prisma.
 *   3. Apply security middleware (helmet, strict CORS).
 *   4. Mount routers under /api/*.
 *   5. Mount 404 + error handler.
 *   6. Bind to env.HOST and env.PORT.
 *   7. Wire SIGTERM/SIGINT for graceful shutdown.
 */
import express from 'express';
import { env } from './config/env';
import { applySecurity } from './middleware/security';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { healthRouter } from './routes/health';
import { dashboardRouter } from './routes/dashboard';
import { weatherRouter } from './routes/weather';
import { devRouter } from './routes/dev';
import { prisma } from './utils/prisma';
import { logger } from './utils/logger';
import { cachePurgeExpired } from './utils/cache';

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  logger.info('Server', 'Prisma connected');

  const app = express();
  applySecurity(app);
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(requestLogger);

  app.use('/api', apiLimiter);
  app.use('/api/health', healthRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/weather', weatherRouter);
  app.use('/api/dev', devRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info('Server', 'Listening on http://' + env.HOST + ':' + env.PORT);
  });

  const cleanup = setInterval(() => {
    cachePurgeExpired().catch(() => undefined);
  }, 5 * 60_000);
  cleanup.unref();

  const shutdown = async (signal: string) => {
    logger.info('Server', signal + ' received - shutting down');
    server.close(async (err) => {
      if (err) logger.error('Server', 'http close error', { error: String(err) });
      try {
        await prisma.$disconnect();
      } catch (e) {
        logger.error('Server', 'prisma disconnect error', { error: String(e) });
      }
      process.exit(err ? 1 : 0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  process.on('uncaughtException', (err) => {
    logger.error('Server', 'uncaughtException', { error: err.message });
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('Server', 'unhandledRejection', { error: String(reason) });
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  console.error('Boot failure:', err);
  process.exit(1);
});
