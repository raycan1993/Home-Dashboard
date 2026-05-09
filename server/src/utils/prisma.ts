/**
 * Singleton Prisma client.
 *
 * Why a singleton:
 *   - Each PrismaClient instance opens a connection pool. Re-creating one
 *     per file (as the original scaffold did) leaks pools and can exhaust
 *     Postgres connection limits.
 *   - Centralised place to wire up logging and graceful shutdown
 *     (see index.ts).
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from './logger';

export const prisma = new PrismaClient({
  log: env.LOG_LEVEL === 'debug' ? ['warn', 'error'] : ['error'],
});

// Mirror Prisma errors into our redacting logger.
prisma.$on('error' as never, (e: { message: string }) => {
  logger.error('Prisma', 'Database error', { error: e.message });
});
