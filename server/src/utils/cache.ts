/**
 * Postgres-backed response cache.
 *
 * Security notes:
 *   - The `key` parameter is validated against a strict regex
 *     (OWASP A03: Injection — defence in depth on top of Prisma's parameterisation).
 *   - The cached `data` is JSON-serialised; we never cache OAuth tokens here.
 *   - Errors degrade silently (return null) — callers proceed without cache,
 *     so a corrupted cache row never breaks the dashboard.
 */
import { prisma } from './prisma';
import { logger } from './logger';

const KEY_REGEX = /^[A-Za-z0-9:_\-./]{1,200}$/;

function assertValidKey(key: string): void {
  if (!KEY_REGEX.test(key)) {
    throw new Error('cache: invalid key');
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    assertValidKey(key);
    const entry = await prisma.cacheEntry.findUnique({ where: { key } });
    if (!entry) return null;

    if (entry.expiresAt.getTime() < Date.now()) {
      // Expire async; caller proceeds with miss.
      prisma.cacheEntry.delete({ where: { key } }).catch(() => undefined);
      return null;
    }

    try {
      return JSON.parse(entry.data) as T;
    } catch {
      // Corrupted row — drop it and miss.
      logger.warn('Cache', `corrupted entry, evicting`, { key });
      prisma.cacheEntry.delete({ where: { key } }).catch(() => undefined);
      return null;
    }
  } catch (err) {
    logger.warn('Cache', `GET failed`, { key, error: String(err) });
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  data: T,
  ttlSeconds: number,
): Promise<void> {
  try {
    assertValidKey(key);
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 86_400 * 30) {
      throw new Error('cache: TTL must be 1s..30d');
    }
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const value = JSON.stringify(data);
    if (value.length > 1_000_000) {
      logger.warn('Cache', 'SET refused — payload >1 MiB', { key });
      return;
    }
    await prisma.cacheEntry.upsert({
      where: { key },
      create: { key, data: value, expiresAt },
      update: { data: value, expiresAt },
    });
  } catch (err) {
    logger.warn('Cache', `SET failed`, { key, error: String(err) });
  }
}

export async function cacheDelete(key: string): Promise<void> {
  try {
    assertValidKey(key);
    await prisma.cacheEntry.delete({ where: { key } }).catch(() => undefined);
  } catch {
    // ignore
  }
}

export async function cachePurgeExpired(): Promise<number> {
  try {
    const r = await prisma.cacheEntry.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    if (r.count > 0) logger.debug('Cache', `purged ${r.count} expired entries`);
    return r.count;
  } catch (err) {
    logger.warn('Cache', `purge failed`, { error: String(err) });
    return 0;
  }
}
