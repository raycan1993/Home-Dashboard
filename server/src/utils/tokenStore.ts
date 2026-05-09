/**
 * Encrypted OAuth token store.
 *
 * Tokens are stored as ciphertext (AES-256-GCM, see crypto.ts) and decrypted
 * only at the moment they're needed for an outbound API call.
 *
 * Audit events are written for grant / refresh / decrypt-failure
 * (OWASP A09: Logging & Monitoring).
 */
import { prisma } from './prisma';
import { encryptToken, decryptToken } from './crypto';
import { logger } from './logger';

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  metadata?: Record<string, unknown>;
}

async function audit(
  eventType: string,
  provider: string | null,
  message: string,
  context?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: { eventType, provider, message, context: context ?? null },
    });
  } catch (err) {
    logger.warn('Audit', 'audit write failed', { error: String(err) });
  }
}

export async function saveTokens(
  provider: 'microsoft' | 'strava' | 'bring',
  creds: OAuthCredentials,
): Promise<void> {
  const accessTokenCipher = encryptToken(creds.accessToken);
  const refreshTokenCipher = creds.refreshToken
    ? encryptToken(creds.refreshToken)
    : null;

  await prisma.oAuthToken.upsert({
    where: { provider },
    create: {
      provider,
      accessTokenCipher,
      refreshTokenCipher,
      expiresAt: creds.expiresAt ?? null,
      scope: creds.scope ?? null,
      metadata: (creds.metadata ?? null) as never,
    },
    update: {
      accessTokenCipher,
      refreshTokenCipher,
      expiresAt: creds.expiresAt ?? null,
      scope: creds.scope ?? null,
      metadata: (creds.metadata ?? null) as never,
    },
  });

  await audit('oauth.granted', provider, 'tokens stored', { scope: creds.scope });
}

export async function loadTokens(
  provider: 'microsoft' | 'strava' | 'bring',
): Promise<OAuthCredentials | null> {
  const row = await prisma.oAuthToken.findUnique({ where: { provider } });
  if (!row) return null;
  try {
    return {
      accessToken: decryptToken(row.accessTokenCipher),
      refreshToken: row.refreshTokenCipher
        ? decryptToken(row.refreshTokenCipher)
        : undefined,
      expiresAt: row.expiresAt ?? undefined,
      scope: row.scope ?? undefined,
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    };
  } catch {
    await audit('token.decrypt_failed', provider, 'AES-GCM auth tag mismatch');
    return null;
  }
}

export async function clearTokens(
  provider: 'microsoft' | 'strava' | 'bring',
): Promise<void> {
  await prisma.oAuthToken.delete({ where: { provider } }).catch(() => undefined);
  await audit('oauth.revoked', provider, 'tokens cleared');
}

export async function isProviderConnected(
  provider: 'microsoft' | 'strava' | 'bring',
): Promise<boolean> {
  const row = await prisma.oAuthToken.findUnique({
    where: { provider },
    select: { id: true },
  });
  return !!row;
}
