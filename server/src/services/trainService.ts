/**
 * SBB / transport.opendata.ch integration. Public, no auth.
 *
 * Security:
 *   - Upstream response validated with Zod.
 *   - Cache key is normalised through encodeURIComponent so user-provided
 *     station names can't break the cache regex.
 */
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import type { TrainConnection } from '@home-dashboard/shared';
import { http } from '../utils/httpClient';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const CACHE_TTL = 60;

const ODCSchema = z.object({
  connections: z.array(
    z.object({
      from: z.object({
        station: z.object({ name: z.string() }),
        departure: z.string(),
        platform: z.string().nullable().optional(),
        delay: z.number().nullable().optional(),
      }),
      to: z.object({
        station: z.object({ name: z.string() }),
        arrival: z.string(),
      }),
      duration: z.string().nullable().optional(),
      products: z.array(z.string()).nullable().optional(),
      transfers: z.number().nullable().optional(),
    }),
  ),
});

function safeKeyFragment(s: string): string {
  // Cache keys must match KEY_REGEX in cache.ts. Map anything outside to '_'.
  return s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60);
}

export async function getTrainConnections(): Promise<TrainConnection[]> {
  const minute = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const cacheKey = `trains:${safeKeyFragment(env.SBB_FROM)}:${safeKeyFragment(env.SBB_TO)}:${minute}`;
  const cached = await cacheGet<TrainConnection[]>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await http.get<unknown>(
      'Trains',
      'https://transport.opendata.ch/v1/connections',
      {
        params: {
          from: env.SBB_FROM,
          to: env.SBB_TO,
          limit: env.SBB_NUM_CONNECTIONS,
          'transportations[]': ['train', 'tram', 'metro'],
        },
      },
    );

    const parsed = ODCSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error('Trains', 'upstream schema validation failed');
      return getMockTrains();
    }

    const out: TrainConnection[] = parsed.data.connections.map((c) => {
      const delaySec = c.from.delay ?? 0;
      const delayMin = Math.round(delaySec / 60);
      const cancelled = delayMin === 9999 || delayMin < -1000;
      return {
        id: uuidv4(),
        from: c.from.station.name,
        to: c.to.station.name,
        departure: c.from.departure,
        arrival: c.to.arrival,
        duration: (c.duration ?? '').replace('00d', '').trim(),
        platform: c.from.platform || '–',
        products: c.products ?? [],
        delay: cancelled ? 0 : delayMin,
        cancelled,
        transfers: c.transfers ?? 0,
      };
    });

    await cacheSet(cacheKey, out, CACHE_TTL);
    return out;
  } catch (err) {
    logger.error('Trains', 'fetch failed', { error: String(err) });
    return getMockTrains();
  }
}

function getMockTrains(): TrainConnection[] {
  const now = Date.now();
  return Array.from({ length: 5 }, (_, i) => {
    const dep = new Date(now + (i * 30 + 5) * 60_000);
    const arr = new Date(dep.getTime() + 25 * 60_000);
    return {
      id: uuidv4(),
      from: env.SBB_FROM,
      to: env.SBB_TO,
      departure: dep.toISOString(),
      arrival: arr.toISOString(),
      duration: '00:25',
      platform: `${i + 1}`,
      products: i % 2 === 0 ? ['IC'] : ['S'],
      delay: i === 1 ? 3 : 0,
      cancelled: false,
      transfers: 0,
    };
  });
}
