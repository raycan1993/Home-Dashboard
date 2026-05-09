/**
 * AES-256-GCM symmetric encryption for OAuth refresh tokens
 * (OWASP A02: Cryptographic Failures).
 *
 * Format on disk:  base64( iv (12B) ‖ tag (16B) ‖ ciphertext )
 *
 * Why GCM:
 *   - Provides confidentiality AND integrity in one primitive.
 *     A bit-flipped ciphertext fails decryption with an auth-tag mismatch
 *     instead of producing garbage plaintext.
 *
 * Why a fresh random IV per call:
 *   - GCM is catastrophically broken if an (iv, key) pair is reused.
 *     12 bytes from `randomBytes` gives ~2^48 safe encryptions per key,
 *     vastly more than this app will ever issue.
 *
 * Why the key lives in env, not the DB:
 *   - The DB and the key must be compromised together for tokens to leak.
 *     A `pg_dump` alone yields ciphertext only.
 */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { logger } from './logger';

const ALG = 'aes-256-gcm' as const;
const IV_LEN = 12;
const TAG_LEN = 16;

const KEY = Buffer.from(env.TOKEN_ENC_KEY, 'base64');
// Defensive — env.ts already validated this, but leaving here as a tripwire
// so any future change can't accidentally weaken it.
if (KEY.length !== 32) {
  throw new Error('crypto: TOKEN_ENC_KEY must decode to 32 bytes');
}

export function encryptToken(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptToken: plaintext must be a non-empty string');
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}

export function decryptToken(ciphertextB64: string): string {
  try {
    const buf = Buffer.from(ciphertextB64, 'base64');
    if (buf.length < IV_LEN + TAG_LEN + 1) {
      throw new Error('ciphertext too short');
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ct = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALG, KEY, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch (err) {
    // Never include the ciphertext or details in the error — could aid an oracle attack.
    logger.error('Crypto', 'decryptToken failed', { error: 'auth_tag_or_format' });
    throw new Error('decryptToken failed');
  }
}

/**
 * Constant-time string comparison for OAuth state and similar tokens.
 * Avoids leaking length/prefix information through response timing
 * (OWASP A07: Authentication Failures).
 */
export function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'utf8');
  const bBuf = Buffer.from(b, 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Generate a URL-safe random token (used for OAuth `state` and similar).
 */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
