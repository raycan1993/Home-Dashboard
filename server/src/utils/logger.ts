/**
 * Structured logger with mandatory secret redaction
 * (OWASP A09: Security Logging and Monitoring Failures).
 *
 * The redaction step happens at the logger boundary, not at every call site,
 * so a forgotten redactor at a service can't leak credentials into logs.
 *
 * What gets redacted:
 *   - Header keys: authorization, cookie, set-cookie, x-api-key
 *   - Payload keys matching: password, secret, token, key, code, refresh, access
 *   - Query params with the same matchers
 *
 * What gets truncated:
 *   - Bodies > 2 KiB are replaced with a marker + 2-KiB preview.
 *
 * Logs are also broadcast over an EventEmitter so the dev SSE stream can
 * subscribe (see routes/dev.ts).
 */
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { DevLog, LogLevel, LogDirection } from '@home-dashboard/shared';
import { env } from '../config/env';

const REDACTED = '***REDACTED***';

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
]);

// Substring matchers — case-insensitive. Match anywhere in the key name.
const SENSITIVE_KEY_SUBSTRINGS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'cookie',
  'session',
  'refresh',
  'access',
  'code',
  'client_secret',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_HEADER_KEYS.has(lower)) return true;
  return SENSITIVE_KEY_SUBSTRINGS.some((s) => lower.includes(s));
}

/**
 * Recursively walk an object and redact sensitive values.
 * Caps recursion depth to defend against malicious input loops.
 */
export function redact(input: unknown, depth = 0): unknown {
  if (depth > 6) return '[max-depth]';
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    // If the entire string looks like a Bearer token, redact it.
    if (/^Bearer\s+/i.test(input)) return `Bearer ${REDACTED}`;
    return input;
  }
  if (typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.slice(0, 50).map((v) => redact(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

/**
 * Strip sensitive query params from a URL (`?code=...`, `?api_key=...`).
 * Done by parsing rather than regex so we don't miss URL-encoded keys.
 */
export function redactUrl(rawUrl: string): string {
  try {
    // URL constructor needs a base for relative URLs; supply a dummy.
    const url = new URL(rawUrl, 'http://placeholder.invalid');
    let mutated = false;
    url.searchParams.forEach((_v, k) => {
      if (isSensitiveKey(k)) {
        url.searchParams.set(k, REDACTED);
        mutated = true;
      }
    });
    if (!mutated) return rawUrl;
    // Re-emit; if the original was relative, strip the placeholder host.
    return rawUrl.startsWith('http')
      ? url.toString()
      : url.pathname + url.search + url.hash;
  } catch {
    return rawUrl; // unparseable — let it through; nothing in it can be matched anyway
  }
}

function truncate(payload: unknown): unknown {
  if (payload === undefined || payload === null) return payload;
  let str: string;
  try {
    str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  } catch {
    return '[unserializable]';
  }
  if (str.length > 2048) {
    return { _truncated: true, preview: str.slice(0, 2048) + '…' };
  }
  return payload;
}

class Logger extends EventEmitter {
  private logs: DevLog[] = [];
  private readonly MAX_LOGS = 500;
  private readonly levelRank: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
  };

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  log(
    level: LogLevel,
    direction: LogDirection,
    service: string,
    message: string,
    meta?: {
      url?: string;
      method?: string;
      statusCode?: number;
      duration?: number;
      payload?: unknown;
      response?: unknown;
    },
  ): void {
    if (this.levelRank[level] < this.levelRank[env.LOG_LEVEL]) return;

    const safeUrl = meta?.url ? redactUrl(meta.url) : undefined;

    const entry: DevLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      direction,
      service,
      message,
      ...(safeUrl !== undefined && { url: safeUrl }),
      ...(meta?.method !== undefined && { method: meta.method }),
      ...(meta?.statusCode !== undefined && { statusCode: meta.statusCode }),
      ...(meta?.duration !== undefined && { duration: meta.duration }),
      ...(meta?.payload !== undefined && { payload: truncate(redact(meta.payload)) }),
      ...(meta?.response !== undefined && { response: truncate(redact(meta.response)) }),
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.MAX_LOGS) this.logs = this.logs.slice(0, this.MAX_LOGS);

    if (env.DEVELOPER_MODE) this.emit('log', entry);

    // Console output — always redacted.
    const prefix = `[${entry.timestamp}][${entry.level}][${entry.direction}][${service}]`;
    const consoleArgs: unknown[] = [`${prefix} ${message}`];
    if (entry.statusCode !== undefined) consoleArgs.push(`status=${entry.statusCode}`);
    if (entry.duration !== undefined) consoleArgs.push(`${entry.duration}ms`);

    if (level === 'error') console.error(...consoleArgs);
    else if (level === 'warn') console.warn(...consoleArgs);
    else if (level === 'debug') console.debug(...consoleArgs);
    else console.log(...consoleArgs);
  }

  info(service: string, message: string, meta?: object) {
    this.log('info', 'INTERNAL', service, message, meta);
  }
  warn(service: string, message: string, meta?: object) {
    this.log('warn', 'INTERNAL', service, message, meta);
  }
  error(service: string, message: string, meta?: object) {
    this.log('error', 'INTERNAL', service, message, meta);
  }
  debug(service: string, message: string, meta?: object) {
    this.log('debug', 'INTERNAL', service, message, meta);
  }

  getLogs(limit = 100): DevLog[] {
    return this.logs.slice(0, limit);
  }

  clear(): void {
    this.logs = [];
  }
}

export const logger = new Logger();
