// Root component: header with date and tabs, two pages (Overview, Training).
import { useEffect, useState } from 'react';
import type { TrainConnection, WeatherData } from '@home-dashboard/shared';
import { useDashboard } from './hooks/useDashboard';
import { WeatherCard } from './components/WeatherCard';
import { TrainConnections } from './components/TrainConnections';
import { WeeklyTrainingPlan } from './components/WeeklyTrainingPlan';
import { TrainingKPIs } from './components/TrainingKPIs';

const TABS = ['Overview', 'Training'] as const;
type Tab = (typeof TABS)[number];
const PLZ_STORAGE_KEY = 'home-dashboard:plz';

function normalizeStoredPlz(stored: string | null): string | undefined {
  if (!stored || !/^\d{4}(\d{2}|\d{3})?$/.test(stored)) return undefined;
  if (stored.length === 4) return stored + '00';
  if (stored.length === 7) return stored.slice(0, 6);
  return stored;
}

export function App() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [selectedPlz, setSelectedPlz] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const stored = window.localStorage.getItem(PLZ_STORAGE_KEY);
    return normalizeStoredPlz(stored);
  });
  const { snapshot, status, error, lastUpdated, refresh } = useDashboard(selectedPlz);

  useEffect(() => {
    if (selectedPlz) window.localStorage.setItem(PLZ_STORAGE_KEY, selectedPlz);
  }, [selectedPlz]);

  const onSelectLocation = (plz: string, _label: string) => setSelectedPlz(plz);

  const dateStr = new Date().toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="min-h-screen overflow-y-auto bg-slate-950 text-[13px] text-slate-100 font-sans lg:h-screen lg:overflow-hidden">
      <header className="h-[54px] bg-slate-950/90 backdrop-blur border-b border-slate-800/60 px-4 py-2 flex items-center gap-4">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">Home Dashboard</h1>
          <p className="text-[11px] text-slate-500">{dateStr}</p>
        </div>
        <nav className="flex gap-1 ml-auto bg-slate-800/50 p-1 rounded-lg">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'tap-target px-4 py-1 rounded-md text-xs font-medium transition-all ' +
                (tab === t ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-slate-200')
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex max-w-[1520px] flex-col px-3 py-2 lg:h-[calc(100vh-54px)] lg:overflow-hidden">
        {status === 'error' && error && (
          <div className="mb-2 flex-shrink-0 bg-rose-950/40 border border-rose-800 text-rose-200 rounded-lg px-3 py-1.5 text-xs">
            {error}
          </div>
        )}
        {tab === 'Overview' ? (
          <OverviewPage
            weather={snapshot?.weather ?? null}
            trains={snapshot?.trains ?? []}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
            onSelectLocation={onSelectLocation}
          />
        ) : (
          <TrainingPage />
        )}
      </main>
    </div>
  );
}

function OverviewPage({
  weather,
  trains,
  lastUpdated,
  onRefresh,
  onSelectLocation,
}: {
  weather: WeatherData | null;
  trains: TrainConnection[];
  lastUpdated: Date | null;
  onRefresh: () => void;
  onSelectLocation: (plz: string, label: string) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
      <div className="min-h-[260px] lg:min-h-0 [&>*]:h-full">
        <WeatherCard weather={weather} onSelectLocation={onSelectLocation} />
      </div>
      <div className="min-h-[260px] lg:min-h-0 [&>*]:h-full">
        <TrainConnections trains={trains} onRefresh={onRefresh} lastUpdated={lastUpdated} />
      </div>
    </div>
  );
}

function TrainingPage() {
  return (
    <div className="space-y-6 overflow-y-auto">
      <WeeklyTrainingPlan />
      <TrainingKPIs />
    </div>
  );
}
