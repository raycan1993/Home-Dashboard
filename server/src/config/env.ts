/**
 * Centralised environment loader and validator.
 *
 * Missing required values fail fast at boot. The rest of the codebase imports
 * this typed object instead of reading process.env directly.
 */
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { z } from 'zod';

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
if (envPath) dotenv.config({ path: envPath });

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

  DATABASE_URL: z.string().min(1),

  WEATHER_PLZ: z
    .string()
    .regex(/^\d{4}(\d{2}|\d{3})?$/, 'WEATHER_PLZ must be 4, 6, or legacy 7 digits')
    .default('840000'),
  WEATHER_CITY: z.string().default('Winterthur'),

  SBB_FROM: z.string().default('Winterthur'),
  SBB_TO: z.string().default('Zürich HB'),
  SBB_NUM_CONNECTIONS: z.coerce.number().int().min(1).max(20).default(5),

  DEVELOPER_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error('Environment validation failed:\n' + issues.join('\n'));
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;

if (env.NODE_ENV === 'production') {
  if (env.DEVELOPER_MODE) {
    console.error('DEVELOPER_MODE must be false in production.');
    process.exit(1);
  }
  if (env.HOST !== '127.0.0.1' && env.HOST !== 'localhost') {
    console.warn('[security] HOST is ' + env.HOST + '; non-localhost binding. Confirm this is intentional.');
  }
}
