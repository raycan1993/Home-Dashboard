/**
 * Microsoft Todo (Graph API) integration.
 *
 * Security:
 *   - Refresh token is stored AES-256-GCM-encrypted (tokenStore.ts).
 *   - Only `Tasks.ReadWrite` and `offline_access` are requested
 *     (OWASP A01: Broken Access Control — least privilege).
 *   - OAuth `state` is generated server-side and verified on callback
 *     (OWASP A07: Authentication Failures).
 *   - Upstream Graph responses are schema-validated.
 */
import { z } from 'zod';
import type { TodoItem, TodoList } from '@home-dashboard/shared';
import { http } from '../utils/httpClient';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { loadTokens, saveTokens } from '../utils/tokenStore';
import { prisma } from '../utils/prisma';
import { randomToken, safeEqual } from '../utils/crypto';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = (tenant: string) =>
  `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;

const SCOPE = 'Tasks.ReadWrite offline_access';

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
});

const ListsResponseSchema = z.object({
  value: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      isOwner: z.boolean().optional(),
    }),
  ),
});

const TasksResponseSchema = z.object({
  value: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      status: z.enum(['notStarted', 'inProgress', 'completed', 'waitingOnOthers', 'deferred']),
      importance: z.enum(['low', 'normal', 'high']),
      dueDateTime: z.object({ dateTime: z.string() }).optional(),
      createdDateTime: z.string(),
      completedDateTime: z.object({ dateTime: z.string() }).optional(),
      body: z.object({ content: z.string() }).optional(),
      hasReminderSet: z.boolean(),
    }),
  ),
});

// ---------- Token lifecycle ----------

async function refreshAccessToken(refreshToken: string): Promise<string> {
  if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET) {
    throw new Error('Microsoft client credentials not configured');
  }
  const params = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPE,
  });
  const raw = await http.post<unknown>('MicrosoftTodo', TOKEN_URL(env.MS_TENANT_ID), params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const tok = TokenResponseSchema.parse(raw);
  await saveTokens('microsoft', {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    scope: SCOPE,
  });
  return tok.access_token;
}

async function getValidAccessToken(): Promise<string | null> {
  const t = await loadTokens('microsoft');
  if (!t) return null;
  const buffer = 5 * 60 * 1000;
  if (t.expiresAt && t.expiresAt.getTime() - buffer < Date.now() && t.refreshToken) {
    try {
      return await refreshAccessToken(t.refreshToken);
    } catch (err) {
      logger.error('MicrosoftTodo', 'refresh failed', { error: String(err) });
      return null;
    }
  }
  return t.accessToken;
}

// ---------- OAuth flow ----------

export async function buildMicrosoftAuthUrl(): Promise<string> {
  if (!env.MS_CLIENT_ID || !env.MS_REDIRECT_URI) {
    throw new Error('Microsoft OAuth not configured');
  }
  const state = randomToken(24);
  await prisma.oAuthState.create({
    data: {
      state,
      provider: 'microsoft',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  const params = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: env.MS_REDIRECT_URI,
    scope: SCOPE,
    response_mode: 'query',
    state,
  });
  return `https://login.microsoftonline.com/${encodeURIComponent(env.MS_TENANT_ID)}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeMicrosoftCode(code: string, state: string): Promise<void> {
  if (!env.MS_CLIENT_ID || !env.MS_CLIENT_SECRET || !env.MS_REDIRECT_URI) {
    throw new Error('Microsoft OAuth not configured');
  }

  // Verify state — single-use, must exist, not expired.
  const stored = await prisma.oAuthState.findUnique({ where: { state } });
  if (!stored || stored.provider !== 'microsoft' || stored.expiresAt.getTime() < Date.now()) {
    throw new Error('invalid_state');
  }
  if (!safeEqual(stored.state, state)) {
    throw new Error('invalid_state');
  }
  await prisma.oAuthState.delete({ where: { state } });

  const params = new URLSearchParams({
    client_id: env.MS_CLIENT_ID,
    client_secret: env.MS_CLIENT_SECRET,
    code,
    redirect_uri: env.MS_REDIRECT_URI,
    grant_type: 'authorization_code',
    scope: SCOPE,
  });
  const raw = await http.post<unknown>('MicrosoftTodo', TOKEN_URL(env.MS_TENANT_ID), params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const tok = TokenResponseSchema.parse(raw);
  await saveTokens('microsoft', {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: new Date(Date.now() + tok.expires_in * 1000),
    scope: SCOPE,
  });
}

// ---------- Public API ----------

export async function getTodoLists(): Promise<TodoList[]> {
  const token = await getValidAccessToken();
  if (!token) {
    logger.warn('MicrosoftTodo', 'not connected — returning mock data');
    return [
      { id: 'list-1', displayName: 'Haushalt', isOwner: true },
      { id: 'list-2', displayName: 'Arbeit', isOwner: true },
    ];
  }
  const raw = await http.get<unknown>('MicrosoftTodo', `${GRAPH}/me/todo/lists`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const parsed = ListsResponseSchema.parse(raw);
  return parsed.value.map((l) => ({
    id: l.id,
    displayName: l.displayName,
    isOwner: l.isOwner ?? false,
  }));
}

export async function getTodoItems(listId?: string): Promise<TodoItem[]> {
  const token = await getValidAccessToken();
  if (!token) {
    logger.warn('MicrosoftTodo', 'not connected — returning mock data');
    return getMockTodos();
  }
  const targetListId = listId || env.MS_TODO_LIST_ID;
  if (!targetListId) {
    logger.warn('MicrosoftTodo', 'no list ID configured');
    return getMockTodos();
  }
  // Validate listId shape — Graph IDs are alphanumeric/dashes/underscores/equals.
  if (!/^[A-Za-z0-9_\-=]+$/.test(targetListId)) {
    throw new Error('invalid list id');
  }

  const raw = await http.get<unknown>(
    'MicrosoftTodo',
    `${GRAPH}/me/todo/lists/${encodeURIComponent(targetListId)}/tasks`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { $filter: "status ne 'completed'", $top: 50 },
    },
  );
  const parsed = TasksResponseSchema.parse(raw);

  return parsed.value.map((t) => ({
    id: t.id,
    title: t.title,
    status:
      t.status === 'completed' || t.status === 'inProgress' || t.status === 'notStarted'
        ? t.status
        : 'notStarted',
    importance: t.importance,
    ...(t.dueDateTime?.dateTime !== undefined && { dueDateTime: t.dueDateTime.dateTime }),
    listId: targetListId,
    createdAt: t.createdDateTime,
    ...(t.completedDateTime?.dateTime !== undefined && { completedAt: t.completedDateTime.dateTime }),
    ...(t.body?.content !== undefined && { bodyContent: t.body.content }),
    hasReminderSet: t.hasReminderSet,
  }));
}

function getMockTodos(): TodoItem[] {
  const now = new Date().toISOString();
  return [
    { id: 't1', title: 'Waschmaschine einräumen', status: 'notStarted', importance: 'normal', listId: 'list-1', createdAt: now, hasReminderSet: false },
    { id: 't2', title: 'Apotheke Medikamente holen', status: 'notStarted', importance: 'high', listId: 'list-1', createdAt: now, dueDateTime: now, hasReminderSet: true },
    { id: 't3', title: 'Newsletter abonnieren', status: 'inProgress', importance: 'low', listId: 'list-1', createdAt: now, hasReminderSet: false },
  ];
}
