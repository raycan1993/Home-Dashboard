/**
 * Strava integration.
 *
 * Security:
 *   - Scopes requested: `read,activity:read` only (no write scopes).
 *     OWASP A01: Broken Access Control — least privilege.
 *   - Refresh token AES-256-GCM-encrypted in DB (tokenStore.ts).
 *   - OAuth `state` is server-minted and verified on callback (CSRF defence).
 */
import { z } from 'zod';
import type { RunningStats, StravaActivity } from '@home-dashboard/shared';
import { http } from '../utils/httpClient';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { loadTokens, saveTokens } from '../utils/tokenStore';
import { prisma } from '../utils/prisma';
import { randomToken, safeEqual } from '../utils/crypto';

const SCOPE = 'read,activity:read';
const CACHE_KEY = 'strava:stats';
const CACHE_TTL = 600;

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  athlete: z.object({ id: z.number() }).optional(),
});

const ActivitySchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  start_date: z.string(),
  distance: z.number(),
  moving_time: z.number(),
  elapsed_time: z.number(),
  total_elevation_gain: z.number(),
  average_speed: z.number(),
  max_speed: z.number(),
  average_heartrate: z.number().optional(),
  max_heartrate: z.number().optional(),
  calories: z.number().optional(),
});

async function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
    throw new Error('Strava client credentials not configured');
  }
  const raw = await http.post<unknown>('Strava', 'https://www.strava.com/oauth/token', {
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const tok = TokenResponseSchema.parse(raw);
  await saveTokens('strava', {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: new Date(tok.expires_at * 1000),
    scope: SCOPE,
  });
  return tok.access_token;
}

async function getValidAccessToken(): Promise<string | null> {
  const t = await loadTokens('strava');
  if (!t) return null;
  const buf = 5 * 60 * 1000;
  if (t.expiresAt && t.expiresAt.getTime() - buf < Date.now() && t.refreshToken) {
    try {
      return await refreshAccessToken(t.refreshToken);
    } catch (err) {
      logger.error('Strava', 'refresh failed', { error: String(err) });
      return null;
    }
  }
  return t.accessToken;
}

// ---------- OAuth flow ----------

export async function buildStravaAuthUrl(): Promise<string> {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_REDIRECT_URI) {
    throw new Error('Strava OAuth not configured');
  }
  const state = randomToken(24);
  await prisma.oAuthState.create({
    data: {
      state,
      provider: 'strava',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.STRAVA_REDIRECT_URI,
    approval_prompt: 'auto',
    scope: SCOPE,
    state,
  });
  return `https://www.strava.com/oauth/authorize?${params}`;
}

export async function exchangeStravaCode(code: string, state: string): Promise<void> {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
    throw new Error('Strava OAuth not configured');
  }
  const stored = await prisma.oAuthState.findUnique({ where: { state } });
  if (!stored || stored.provider !== 'strava' || stored.expiresAt.getTime() < Date.now()) {
    throw new Error('invalid_state');
  }
  if (!safeEqual(stored.state, state)) throw new Error('invalid_state');
  await prisma.oAuthState.delete({ where: { state } });

  const raw = await http.post<unknown>('Strava', 'https://www.strava.com/oauth/token', {
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
  });
  const tok = TokenResponseSchema.parse(raw);
  await saveTokens('strava', {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: new Date(tok.expires_at * 1000),
    scope: SCOPE,
    metadata: tok.athlete ? { athleteId: tok.athlete.id } : undefined,
  });
}

// ---------- Public API ----------

export async function getRunningStats(): Promise<RunningStats | null> {
  const cached = await cacheGet<RunningStats>(CACHE_KEY);
  if (cached) return cached;

  const token = await getValidAccessToken();
  if (!token) {
    logger.warn('Strava', 'not connected');
    return null;
  }

  try {
    const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const raw = await http.get<unknown>(
      'Strava',
      'https://www.strava.com/api/v3/athlete/activities',
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { after: since, per_page: 50 },
      },
    );

    const activities = z.array(ActivitySchema).parse(raw);
    const mapped: StravaActivity[] = activities.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      startDate: a.start_date,
      distance: a.distance,
      movingTime: a.moving_time,
      elapsedTime: a.elapsed_time,
      totalElevationGain: a.total_elevation_gain,
      averageSpeed: a.average_speed,
      maxSpeed: a.max_speed,
      ...(a.average_heartrate !== undefined && { averageHeartrate: a.average_heartrate }),
      ...(a.max_heartrate !== undefined && { maxHeartrate: a.max_heartrate }),
      ...(a.calories !== undefined && { calories: a.calories }),
    }));

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    const today = new Date().toISOString().slice(0, 10);

    const inWindow = (a: StravaActivity, ms: number) =>
      new Date(a.startDate).getTime() >= ms;

    const stats: RunningStats = {
      weeklyDistance: mapped.filter((a) => inWindow(a, weekAgo)).reduce((s, a) => s + a.distance, 0),
      monthlyDistance: mapped.filter((a) => inWindow(a, monthAgo)).reduce((s, a) => s + a.distance, 0),
      weeklyActivities: mapped.filter((a) => inWindow(a, weekAgo)).length,
      recentActivities: mapped.slice(0, 10),
      ...(mapped.find((a) => a.startDate.startsWith(today)) && {
        todaysActivity: mapped.find((a) => a.startDate.startsWith(today))!,
      }),
    };

    await cacheSet(CACHE_KEY, stats, CACHE_TTL);
    return stats;
  } catch (err) {
    logger.error('Strava', 'fetch failed', { error: String(err) });
    return null;
  }
}
