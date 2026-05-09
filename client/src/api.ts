// Type-safe API client. All responses are unwrapped from ApiResponse<T>.
//
// Why fetch and not axios: one less dependency on the client, and we don't
// need axios's features here. `credentials: 'same-origin'` is the default but
// stated explicitly to flag intent.
import type {
  ApiResponse,
  ConnectionStatus,
  DashboardSnapshot,
} from '@home-dashboard/shared';

class ApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError('parse_error', 'Server returned non-JSON response');
  }
  if (!body.success || body.data === undefined) {
    throw new ApiError(body.error?.code ?? 'unknown', body.error?.message ?? 'unknown error');
  }
  return body.data;
}

export const api = {
  health: () => call<ConnectionStatus>('/api/health'),
  dashboard: () => call<DashboardSnapshot>('/api/dashboard'),
};

export { ApiError };
