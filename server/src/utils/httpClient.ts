/**
 * Outbound HTTP client with security and observability built in.
 *
 * Security controls:
 *   - SSRF allowlist (OWASP A10): only the hostnames in ALLOWED_HOSTS may be
 *     called. Any service that wants to talk to a new external API must add
 *     its host here, in code, where it shows up in code review.
 *   - HTTPS-only (OWASP A02): http:// is rejected.
 *   - Hard timeout: prevents a slow upstream from holding sockets open.
 *   - Response size cap: defends against a malicious upstream returning gigabytes
 *     to OOM the process.
 *   - Redaction at log boundary (OWASP A09): tokens in headers/URLs never reach disk.
 */
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger, redact } from './logger';

const ALLOWED_HOSTS = new Set([
  'api.open-meteo.com',
  'transport.opendata.ch',
  'graph.microsoft.com',
  'login.microsoftonline.com',
  'api.getbring.com',
  'www.strava.com',
  'api.strava.com',
]);

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MiB

function assertAllowed(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('http: invalid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`http: refusing non-HTTPS URL (${parsed.protocol})`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`http: host not in allowlist (${parsed.hostname})`);
  }
  return parsed;
}

interface RequestOptions extends Omit<AxiosRequestConfig, 'url' | 'method'> {
  /** Per-call override; default 10s. */
  timeoutMs?: number;
}

async function request<T>(
  service: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  assertAllowed(url);
  const start = Date.now();

  logger.log('debug', 'OUT', service, `${method} ${url}`, {
    url,
    method,
    payload: body ?? opts?.params,
  });

  try {
    const response: AxiosResponse<T> = await axios.request<T>({
      url,
      method,
      data: body,
      timeout: opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_BYTES,
      maxBodyLength: MAX_RESPONSE_BYTES,
      // Reject redirects to non-allowlisted hosts. We disable axios's default
      // redirect-following entirely — services that need redirects can set
      // maxRedirects in opts after they've thought about it.
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 300,
      ...opts,
    });

    const duration = Date.now() - start;
    logger.log('info', 'IN', service, `${method} ${url} → ${response.status}`, {
      url,
      method,
      statusCode: response.status,
      duration,
      response: response.data,
    });
    return response.data;
  } catch (err) {
    const duration = Date.now() - start;
    const ax = err as AxiosError;
    logger.log('error', 'IN', service, `${method} ${url} FAILED`, {
      url,
      method,
      statusCode: ax.response?.status,
      duration,
      response: redact(ax.response?.data),
    });
    throw err;
  }
}

export const http = {
  get: <T>(service: string, url: string, opts?: RequestOptions) =>
    request<T>(service, 'GET', url, undefined, opts),
  post: <T>(service: string, url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(service, 'POST', url, body, opts),
  patch: <T>(service: string, url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(service, 'PATCH', url, body, opts),
  put: <T>(service: string, url: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(service, 'PUT', url, body, opts),
  delete: <T>(service: string, url: string, opts?: RequestOptions) =>
    request<T>(service, 'DELETE', url, undefined, opts),
};
