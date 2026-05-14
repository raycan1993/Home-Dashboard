// Root component: header with date and tabs, two pages (Overview, Training).
import { useEffect, useMemo, useState } from 'react';
import { LangContext, type Lang } from './i18n';
import type { TrainConnection, WeatherData } from '@home-dashboard/shared';
import { useDashboard } from './hooks/useDashboard';
import { WeatherCard } from './components/WeatherCard';
import { TrainConnections } from './components/TrainConnections';
import { WeeklyTrainingPlan } from './components/WeeklyTrainingPlan';
import { TrainingKPIs } from './components/TrainingKPIs';
import { RockyAssistant } from './components/RockyAssistant';
import {
  DeveloperMode,
  applyDevTrains,
  applyDevWeather,
  defaultDevSettings,
  getDevRockyMessages,
  type DevSettings,
} from './components/DeveloperMode';

const TABS = ['Overview', 'Training'] as const;
type Tab = (typeof TABS)[number];
const PLZ_STORAGE_KEY = 'home-dashboard:plz';

function normalizeStoredPlz(stored: string | null): string | undefined {
  if (!stored || !/^\d{4}$/.test(stored)) return undefined;
  return stored;
}

export function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [tab, setTab] = useState<Tab>('Overview');
  const [devSettings, setDevSettings] = useState<DevSettings>(defaultDevSettings);
  const [selectedPlz, setSelectedPlz] = useState<string | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    const stored = window.localStorage.getItem(PLZ_STORAGE_KEY);
    return normalizeStoredPlz(stored);
  });
  const { snapshot, status, error, lastUpdated, refresh } = useDashboard(selectedPlz);
  const weather = applyDevWeather(snapshot?.weather ?? null, devSettings);
  const trains = applyDevTrains(snapshot?.trains ?? [], devSettings);
  const rockyMessages = useMemo(() => getDevRockyMessages(devSettings), [devSettings]);
  const displayError = devSettings.enabled && devSettings.showError
    ? 'Developer mode: simulated warning banner for layout and error-state testing.'
    : devSettings.enabled
      ? null
    : error;

  useEffect(() => {
    if (selectedPlz) window.localStorage.setItem(PLZ_STORAGE_KEY, selectedPlz);
  }, [selectedPlz]);

  const onSelectLocation = (plz: string, _label: string) => setSelectedPlz(plz);

  const dateStr = new Date().toLocaleDateString(lang === 'de' ? 'de-CH' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <LangContext.Provider value={lang}>
    <div className="min-h-screen overflow-y-auto bg-zinc-950 text-[13px] text-zinc-100 font-sans lg:h-screen lg:overflow-hidden">
      <header className="h-[54px] bg-zinc-950/90 backdrop-blur border-b border-zinc-800/60 px-4 py-2 flex items-center gap-4">
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">Home Dashboard</h1>
          <p className="text-[11px] text-zinc-500">{dateStr}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setLang((l) => (l === 'en' ? 'de' : 'en'))}
            className="tap-target px-3 py-1 rounded-md text-xs font-semibold border border-zinc-600 bg-zinc-800/60 text-zinc-300 hover:text-white hover:border-zinc-400 transition-colors"
            aria-label="Switch language"
          >
            {lang === 'en' ? 'DE' : 'EN'}
          </button>
          <nav className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                'tap-target px-4 py-1 rounded-md text-xs font-medium transition-all ' +
                (tab === t ? 'bg-sky-500 text-white shadow' : 'text-zinc-400 hover:text-zinc-200')
              }
            >
              {t}
            </button>
          ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto flex max-w-[1520px] flex-col px-3 py-2 lg:h-[calc(100vh-54px)] lg:overflow-hidden">
        {((status === 'error' && displayError) || (devSettings.enabled && devSettings.showError)) && (
          <div className="mb-2 flex-shrink-0 bg-rose-950/40 border border-rose-800 text-rose-200 rounded-lg px-3 py-1.5 text-xs">
            {displayError}
          </div>
        )}
        {tab === 'Overview' ? (
          <OverviewPage
            weather={weather}
            trains={trains}
            lastUpdated={lastUpdated}
            onRefresh={refresh}
            onSelectLocation={onSelectLocation}
            selectedPlz={selectedPlz}
            rockyMessages={rockyMessages}
            devSettings={devSettings}
            onDevSettingsChange={setDevSettings}
          />
        ) : (
          <TrainingPage />
        )}
      </main>
      <DeveloperMode
        baseWeather={snapshot?.weather ?? null}
        baseTrains={snapshot?.trains ?? []}
        settings={devSettings}
        onChange={setDevSettings}
      />
    </div>
    </LangContext.Provider>
  );
}

function OverviewPage({
  weather,
  trains,
  lastUpdated,
  onRefresh,
  onSelectLocation,
  selectedPlz,
  rockyMessages,
  devSettings,
  onDevSettingsChange,
}: {
  weather: WeatherData | null;
  trains: TrainConnection[];
  lastUpdated: Date | null;
  onRefresh: () => void;
  onSelectLocation: (plz: string, label: string) => void;
  selectedPlz: string | undefined;
  rockyMessages?: string[];
  devSettings: DevSettings;
  onDevSettingsChange: (settings: DevSettings) => void;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-2">
      {/* Left column: Weather on top, Rocky below */}
      <div className="flex flex-col gap-2 min-h-0 lg:h-full">
        <div className="min-h-[220px] flex-1 lg:min-h-0 [&>*]:h-full">
          <WeatherCard
            weather={weather}
            onSelectLocation={onSelectLocation}
            onRefresh={onRefresh}
            developerModeEnabled={devSettings.enabled}
            debugNightVariant={devSettings.debugNightVariant}
            previewPattern={devSettings.previewPattern}
            onDebugNightVariantChange={(debugNightVariant) => onDevSettingsChange({ ...devSettings, debugNightVariant })}
            onPreviewPatternChange={(previewPattern) => onDevSettingsChange({ ...devSettings, previewPattern })}
          />
        </div>
        <div className="flex-shrink-0">
          <RockyAssistant plz={selectedPlz} devMessages={rockyMessages} />
        </div>
      </div>
      {/* Right column: Train connections full height */}
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
