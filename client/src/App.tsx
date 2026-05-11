// Root component: sticky header with date and tabs, two pages (Overview, Training).
// Single useDashboard call drives every backend-connected widget.

import { useState } from 'react';
import type {
  GroceryItem,
  TodoItem,
  TrainConnection,
  WeatherData,
} from '@home-dashboard/shared';
import { useDashboard } from './hooks/useDashboard';
import { WeeklyCalendar } from './components/WeeklyCalendar';
import { TodoToday } from './components/TodoToday';
import { ShoppingList } from './components/ShoppingList';
import { WeatherCard } from './components/WeatherCard';
import { TrainConnections } from './components/TrainConnections';
import { WeeklyTrainingPlan } from './components/WeeklyTrainingPlan';
import { TrainingKPIs } from './components/TrainingKPIs';

const TABS = ['Overview', 'Training'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [tab, setTab] = useState<Tab>('Overview');
  const { snapshot, status, error, lastUpdated, refresh } = useDashboard();

  const dateStr = new Date().toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800/60 px-6 py-3 flex items-center gap-6">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Home Dashboard</h1>
          <p className="text-xs text-slate-500">{dateStr}</p>
        </div>
        <nav className="flex gap-1 ml-auto bg-slate-800/50 p-1 rounded-xl">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'px-5 py-1.5 rounded-lg text-sm font-medium transition-all ' +
                (tab === t ? 'bg-sky-500 text-white shadow' : 'text-slate-400 hover:text-slate-200')
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        {status === 'error' && error && (
          <div className="bg-rose-950/40 border border-rose-800 text-rose-200 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {tab === 'Overview' ? (
          <OverviewPage
            todos={snapshot?.todos ?? []}
            groceries={snapshot?.groceries ?? []}
            weather={snapshot?.weather ?? null}
            trains={snapshot?.trains ?? []}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
          />
        ) : (
          <TrainingPage />
        )}
      </main>
    </div>
  );
}

function OverviewPage({
  todos,
  groceries,
  weather,
  trains,
  lastUpdated,
  onRefresh,
}: {
  todos: TodoItem[];
  groceries: GroceryItem[];
  weather: WeatherData | null;
  trains: TrainConnection[];
  lastUpdated: Date | null;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <WeeklyCalendar />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TodoToday todos={todos} />
        <div className="space-y-4">
          <WeatherCard weather={weather} />
          <ShoppingList groceries={groceries} />
        </div>
      </div>
      <TrainConnections trains={trains} onRefresh={onRefresh} lastUpdated={lastUpdated} />
    </div>
  );
}

function TrainingPage() {
  return (
    <div className="space-y-6">
      <WeeklyTrainingPlan />
      <TrainingKPIs />
    </div>
  );
}
