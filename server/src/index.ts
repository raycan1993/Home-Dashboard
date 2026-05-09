/**
 * Server entry point.
 *
 * Boot order:
 *   1. Load + validate env (config/env.ts) — fails fast if anything is missing.
 *   2. Connect Prisma.
 *   3. Apply security middleware (helmet, strict CORS).
 *   4. Mount routers under /api/*.
 *   5. Mount 404 + error handler.
 *   6. Bind to env.HOST (defaults to 127.0.0.1) and env.PORT.
 *   7. Wire SIGTERM/SIGINT for graceful shutdown.
 *
 * Hardening:
 *   - Body parser size limit: 100 KiB (defends against large-payload DoS).
 *   - `trust proxy` is OFF — we are not behind a proxy by default. The
 *     rate limiter would otherwise see all requests from the proxy IP.
 *   - Default error handler returns a stable code, never a stack.
 *   - All process unhandled errors are logged through the redacting logger
 *     and the process exits — better than running in an unknown state.
 */
import express from 'express';
import { env } from './config/env';
import { applySecurity } from './middleware/security';
import { apiLimiter } from './middleware/rateLimit';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { healthRouter } from './routes/health';
import { dashboardRouter } from './routes/dashboard';
import { oauthRouter } from './routes/oauth';
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
  app.use('/api/oauth', oauthRouter);
  app.use('/api/dev', devRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info('Server', `Listening on http://${env.HOST}:${env.PORT}`);
    if (env.HOST !== '127.0.0.1' && env.HOST !== 'localhost') {
      logger.warn('Server', `Bound to ${env.HOST} — non-localhost. Confirm this is intentional.`);
    }
  });

  // Periodic cache cleanup. Lightweight; runs every 5 minutes.
  const cleanup = setInterval(() => {
    cachePurgeExpired().catch(() => undefined);
  }, 5 * 60_000);
  // Avoid keeping the event loop alive during shutdown.
  cleanup.unref();

  // Graceful shutdown — drain in-flight requests, then close DB.
  const shutdown = async (signal: string) => {
    logger.info('Server', `${signal} received — shutting down`);
    server.close(async (err) => {
      if (err) {
        logger.error('Server', 'http close error', { error: String(err) });
      }
      try {
        await prisma.$disconnect();
      } catch (e) {
        logger.error('Server', 'prisma disconnect error', { error: String(e) });
      }
      process.exit(err ? 1 : 0);
    });
    // Hard kill after 10s if shutdown stalls.
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Last-resort safety net. Better to crash visibly than to keep serving requests
  // from an unknown state.
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
  // Use console here — the logger may not be initialised yet on early failure.
  // eslint-disable-next-line no-console
  console.error('Boot failure:', err);
  process.exit(1);
});
