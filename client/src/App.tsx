import { useEffect, useState } from 'react';
import type {
  ConnectionStatus,
  DashboardSnapshot,
} from '@home-dashboard/shared';
import { api, ApiError } from './api';

// Single-page dashboard. Polls every 60s. No auth — backend is bound to localhost.
export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const [snap, hs] = await Promise.all([api.dashboard(), api.health()]);
        if (!mounted) return;
        setSnapshot(snap);
        setStatus(hs);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : 'Network error');
      }
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
      <header className="flex items-baseline justify-between mb-8 border-b border-slate-800 pb-4">
        <h1 className="text-3xl font-light tracking-wide">Home Dashboard</h1>
        <ConnectionsBar status={status} />
      </header>

      {error && (
        <div className="bg-red-950/40 border border-red-800 text-red-200 rounded p-4 mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <WeatherCard snapshot={snapshot} />
        <TrainsCard snapshot={snapshot} />
        <TodosCard snapshot={snapshot} />
        <GroceriesCard snapshot={snapshot} />
        <RunningCard snapshot={snapshot} />
      </div>

      <footer className="mt-10 text-xs text-slate-500 text-center">
        {snapshot ? `Updated ${new Date(snapshot.lastUpdated).toLocaleTimeString()}` : 'Loading…'}
      </footer>
    </div>
  );
}

function ConnectionsBar({ status }: { status: ConnectionStatus | null }) {
  if (!status) return null;
  const Pill = ({ ok, label, href }: { ok: boolean; label: string; href?: string }) => {
    const cls = ok ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800' : 'bg-slate-800 text-slate-400 border-slate-700';
    const inner = <span className={`text-xs border px-2 py-1 rounded ${cls}`}>{label}{ok ? ' ✓' : ''}</span>;
    return href && !ok ? <a href={href}>{inner}</a> : inner;
  };
  return (
    <div className="flex gap-2">
      <Pill ok={status.weather} label="Weather" />
      <Pill ok={status.microsoft} label="Microsoft" href="/api/oauth/microsoft/start" />
      <Pill ok={status.strava} label="Strava" href="/api/oauth/strava/start" />
      <Pill ok={status.bring} label="Bring" />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-900/60 border border-slate-800 rounded-lg p-5">
      <h2 className="text-sm uppercase tracking-widest text-slate-400 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function WeatherCard({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const w = snapshot?.weather;
  if (!w) return <Card title="Weather"><Skeleton /></Card>;
  return (
    <Card title="Weather">
      <div className="flex items-baseline gap-3">
        <span className="text-5xl font-extralight">{w.temperature}°</span>
        <span className="text-slate-300">{w.description}</span>
      </div>
      <div className="text-xs text-slate-400 mt-2">
        {w.location} · feels {w.feelsLike}° · H {w.high}° / L {w.low}° · wind {w.windSpeed} km/h
      </div>
    </Card>
  );
}

function TrainsCard({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const trains = snapshot?.trains ?? [];
  if (!trains.length) return <Card title="Trains"><Skeleton /></Card>;
  return (
    <Card title={`${trains[0]!.from} → ${trains[0]!.to}`}>
      <ul className="space-y-2">
        {trains.slice(0, 5).map((t) => (
          <li key={t.id} className="flex items-baseline gap-3 text-sm">
            <span className="font-mono w-12">{new Date(t.departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-slate-400 w-12">Pl. {t.platform}</span>
            <span className="text-slate-300">{t.products.join(', ')}</span>
            {t.delay > 0 && <span className="text-amber-400">+{t.delay}'</span>}
            {t.cancelled && <span className="text-red-400">cancelled</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function TodosCard({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const todos = snapshot?.todos ?? [];
  if (!todos.length) return <Card title="Todos"><span className="text-slate-500">All clear.</span></Card>;
  return (
    <Card title="Todos">
      <ul className="space-y-1">
        {todos.slice(0, 8).map((t) => (
          <li key={t.id} className="text-sm flex gap-2">
            <span className={t.importance === 'high' ? 'text-red-400' : 'text-slate-500'}>•</span>
            <span>{t.title}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GroceriesCard({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const groceries = snapshot?.groceries ?? [];
  if (!groceries.length) return <Card title="Groceries"><span className="text-slate-500">Nothing on the list.</span></Card>;
  return (
    <Card title="Groceries">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {groceries.slice(0, 12).map((g) => (
          <li key={g.uuid}>{g.name}{g.specification && <span className="text-slate-500"> ({g.specification})</span>}</li>
        ))}
      </ul>
    </Card>
  );
}

function RunningCard({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const r = snapshot?.running;
  if (!r) return <Card title="Running"><span className="text-slate-500">Not connected.</span></Card>;
  return (
    <Card title="Running">
      <div className="flex gap-6 text-sm">
        <Stat label="This week" value={`${(r.weeklyDistance / 1000).toFixed(1)} km`} />
        <Stat label="This month" value={`${(r.monthlyDistance / 1000).toFixed(1)} km`} />
        <Stat label="Activities" value={`${r.weeklyActivities}`} />
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-2xl font-light">{value}</div>
    </div>
  );
}

function Skeleton() {
  return <div className="h-8 bg-slate-800/60 rounded animate-pulse" />;
}
