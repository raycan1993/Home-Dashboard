// Centralised dashboard data hook. Refetches when the active PLZ changes.
import { useCallback, useEffect, useState } from 'react';
import type { DashboardSnapshot } from '@home-dashboard/shared';
import { api, ApiError } from '../api';

type Status = 'loading' | 'ok' | 'error';

interface UseDashboardResult {
  snapshot: DashboardSnapshot | null;
  status: Status;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

const POLL_MS = 60_000;

export function useDashboard(plz?: string): UseDashboardResult {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const snap = await api.dashboard(plz ? { plz } : undefined);
      setSnapshot(snap);
      setStatus('ok');
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Network error');
    }
  }, [plz]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { snapshot, status, error, lastUpdated, refresh };
}
