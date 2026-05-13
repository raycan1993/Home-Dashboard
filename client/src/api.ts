// Type-safe API client. All responses are unwrapped from ApiResponse<T>.
import type {
  ApiResponse,
  ConnectionStatus,
  DashboardSnapshot,
  WeatherLocation,
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

interface DashboardOpts {
  plz?: string;
}

function buildDashboardUrl(opts: DashboardOpts | undefined): string {
  const params = new URLSearchParams();
  if (opts?.plz) params.set('plz', opts.plz);
  const qs = params.toString();
  return qs.length ? '/api/dashboard?' + qs : '/api/dashboard';
}

export const api = {
  health: () => call<ConnectionStatus>('/api/health'),
  dashboard: (opts?: DashboardOpts) => call<DashboardSnapshot>(buildDashboardUrl(opts)),
  weatherSearch: (q: string) =>
    call<WeatherLocation[]>('/api/weather/search?q=' + encodeURIComponent(q)),
  rocky: (plz?: string) => {
    const params = new URLSearchParams();
    if (plz) params.set('plz', plz);
    const qs = params.toString();
    return call<string[]>(qs ? '/api/rocky?' + qs : '/api/rocky');
  },
};

export { ApiError };
