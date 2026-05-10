/**
 * Centralised environment loader and validator.
 *
 * Why a separate module:
 *   - All secrets pass through Zod validation (OWASP A05: Security Misconfiguration).
 *   - Missing or weak required values fail fast at boot — never at runtime, never silently.
 *   - The rest of the codebase imports a typed `env` object instead of reading
 *     `process.env` directly. This means a renamed variable is a compile error.
 *   - The module looks for the .env file outside of OneDrive first
 *     (~/.home-dashboard/.env on Windows), falling back to ./server/.env.
 */
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { z } from 'zod';

// 1. Locate the .env file.
//    Preference order:
//      a) HOME_DASHBOARD_ENV_FILE env var (explicit override)
//      b) %USERPROFILE%/.home-dashboard/.env (off OneDrive)
//      c) ./server/.env (local fallback)
function resolveEnvPath(): string | undefined {
  const explicit = process.env.HOME_DASHBOARD_ENV_FILE;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const offDrivePath = path.join(os.homedir(), '.home-dashboard', '.env');
  if (fs.existsSync(offDrivePath)) return offDrivePath;

  const localPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(localPath)) return localPath;

  return undefined;
}

const envPath = resolveEnvPath();
if (envPath) {
  dotenv.config({ path: envPath });
}

// 2. Validate. Empty strings are coerced to undefined so `.optional()` works.
const stringNonEmpty = z.string().min(1);
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: stringNonEmpty,

  // 32 raw bytes => 44-char base64. We accept >= 32 base64 chars and verify byte length below.
  TOKEN_ENC_KEY: z
    .string()
    .min(32, 'TOKEN_ENC_KEY must be at least 32 base64 chars (32 raw bytes).'),

  // Open-Meteo — no API key. Defaults are Winterthur (CH).
  WEATHER_LATITUDE: z.coerce.number().min(-90).max(90).default(47.5022),
  WEATHER_LONGITUDE: z.coerce.number().min(-180).max(180).default(8.7386),
  WEATHER_CITY: z.string().default('Winterthur'),

  SBB_FROM: z.string().default('Winterthur'),
  SBB_TO: z.string().default('Zürich HB'),
  SBB_NUM_CONNECTIONS: z.coerce.number().int().min(1).max(20).default(5),

  MS_CLIENT_ID: optionalString,
  MS_CLIENT_SECRET: optionalString,
  MS_TENANT_ID: z.string().default('common'),
  MS_REDIRECT_URI: optionalString,
  MS_TODO_LIST_ID: optionalString,

  BRING_EMAIL: optionalString,
  BRING_PASSWORD: optionalString,
  BRING_LIST_UUID: optionalString,

  STRAVA_CLIENT_ID: optionalString,
  STRAVA_CLIENT_SECRET: optionalString,
  STRAVA_REDIRECT_URI: optionalString,

  DEVELOPER_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // Print the field names that failed but never the values — values may be secrets.
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error('Environment validation failed:\n' + issues.join('\n'));
  process.exit(1);
}

// Verify that the encryption key decodes to exactly 32 bytes.
const keyBuf = Buffer.from(parsed.data.TOKEN_ENC_KEY, 'base64');
if (keyBuf.length !== 32) {
  console.error(
    `TOKEN_ENC_KEY must decode to exactly 32 bytes (got ${keyBuf.length}). ` +
      'Generate one with: ' +
      'powershell -c "$b=New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b)"',
  );
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;

// Production sanity checks. These prevent silent regressions
// (e.g. someone setting DEVELOPER_MODE=true in prod).
if (env.NODE_ENV === 'production') {
  if (env.DEVELOPER_MODE) {
    console.error('DEVELOPER_MODE must be false in production.');
    process.exit(1);
  }
  if (env.HOST !== '127.0.0.1' && env.HOST !== 'localhost') {
    console.warn(
      `[security] HOST is ${env.HOST}. The dashboard is single-user and should normally bind to localhost only.`,
    );
  }
}
