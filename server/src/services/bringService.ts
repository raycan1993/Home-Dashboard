/**
 * Bring (groceries) integration.
 *
 * Bring uses email/password auth, not OAuth. We store the resulting session
 * token AES-256-GCM-encrypted (tokenStore.ts) and re-login on expiry.
 *
 * Security:
 *   - Email/password are read once from env at login time. The login response
 *     payload (which contains the bearer) is redacted in logs.
 *   - The session token never leaves the server.
 */
import { z } from 'zod';
import type { GroceryItem } from '@home-dashboard/shared';
import { http } from '../utils/httpClient';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { loadTokens, saveTokens } from '../utils/tokenStore';

const BASE = 'https://api.getbring.com/rest/v2';
const CACHE_KEY = 'groceries:current';
const CACHE_TTL = 120;

const LoginResponseSchema = z.object({
  uuid: z.string(),
  publicUuid: z.string(),
  email: z.string(),
  name: z.string().optional(),
  photoPath: z.string().optional(),
  bringListUUID: z.string().optional(),
  access_token: z.string(),
  refresh_token: z.string().optional(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
});

const ItemsResponseSchema = z.object({
  uuid: z.string(),
  status: z.string().optional(),
  purchase: z.array(z.object({ name: z.string(), specification: z.string().optional() })),
  recently: z
    .array(z.object({ name: z.string(), specification: z.string().optional() }))
    .optional(),
});

async function login(): Promise<string | null> {
  if (!env.BRING_EMAIL || !env.BRING_PASSWORD) return null;
  try {
    const params = new URLSearchParams({ email: env.BRING_EMAIL, password: env.BRING_PASSWORD });
    const raw = await http.post<unknown>('Bring', `${BASE}/bringauth`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const tok = LoginResponseSchema.parse(raw);
    await saveTokens('bring', {
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : undefined,
      metadata: { uuid: tok.uuid, defaultListUuid: tok.bringListUUID },
    });
    return tok.access_token;
  } catch (err) {
    logger.error('Bring', 'login failed', { error: String(err) });
    return null;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  const t = await loadTokens('bring');
  if (!t) return login();
  if (t.expiresAt && t.expiresAt.getTime() < Date.now()) {
    return login();
  }
  return t.accessToken;
}

export async function getGroceries(): Promise<GroceryItem[]> {
  const cached = await cacheGet<GroceryItem[]>(CACHE_KEY);
  if (cached) return cached;

  const token = await getValidAccessToken();
  if (!token) {
    logger.warn('Bring', 'not connected — returning empty list');
    return [];
  }
  const listId = env.BRING_LIST_UUID;
  if (!listId) {
    logger.warn('Bring', 'no list UUID configured');
    return [];
  }
  if (!/^[a-f0-9-]{36}$/i.test(listId)) {
    throw new Error('invalid Bring list UUID');
  }

  try {
    const raw = await http.get<unknown>(
      'Bring',
      `${BASE}/bringlists/${encodeURIComponent(listId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const parsed = ItemsResponseSchema.parse(raw);
    const items: GroceryItem[] = parsed.purchase.map((p) => ({
      name: p.name,
      specification: p.specification ?? '',
      uuid: `${listId}:${p.name}`,
    }));
    await cacheSet(CACHE_KEY, items, CACHE_TTL);
    return items;
  } catch (err) {
    logger.error('Bring', 'fetch failed', { error: String(err) });
    return [];
  }
}
