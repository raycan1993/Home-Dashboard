// Weather widget: current conditions + 24-hour strip + 7-day forecast.
import { useEffect, useRef, useState } from 'react';
import type { WeatherData, WeatherLocation } from '@home-dashboard/shared';
import { api, ApiError } from '../api';
import { Card, SectionTitle } from './Card';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  weather: WeatherData | null;
  onSelectLocation: (plz: string, label: string) => void;
}

export function WeatherCard({ weather, onSelectLocation }: Props) {
  if (!weather) {
    return (
      <Card className="h-full">
        <SectionTitle>Weather</SectionTitle>
        <div className="text-xs text-slate-500 py-2">Lädt...</div>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <SectionTitle>Weather - {weather.location}</SectionTitle>
        <LocationPicker onSelect={onSelectLocation} />
      </div>
      <div className="touch-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="flex items-center gap-3 mb-3">
          <WeatherIcon code={weather.icon} size={40} />
          <div>
            <div className="text-3xl font-light text-white">{weather.temperature}&deg;</div>
            <div className="text-xs text-slate-400">{weather.description}</div>
          </div>
          <div className="ml-auto text-right space-y-0.5">
            <div className="text-[11px] text-slate-500">
              Gefühlt <span className="text-slate-300">{weather.feelsLike}&deg;</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Heute <span className="text-slate-300">{weather.low}&deg; / {weather.high}&deg;</span>
            </div>
            {weather.windSpeed > 0 && (
              <div className="text-[11px] text-slate-500">
                Wind <span className="text-slate-300">{weather.windSpeed} km/h</span>
              </div>
            )}
          </div>
        </div>

        {weather.hourly.length > 0 && (
          <div className="mb-2 pb-2 border-b border-slate-700/50">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Nächste 24 Stunden</div>
            <div className="touch-scroll flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {weather.hourly.slice(0, 24).map((hour, i) => (
                <div key={hour.time + '-' + i} className="flex flex-col items-center gap-0.5 text-center flex-shrink-0 w-10">
                  <span className="text-[10px] text-slate-500 font-medium">{hour.time}</span>
                  <WeatherIcon code={hour.icon} size={18} />
                  <span className="text-[11px] text-white">{hour.temperature}&deg;</span>
                  {hour.precipitation !== undefined && hour.precipitation > 0 ? (
                    <span className="text-[9px] text-sky-300">{hour.precipitation}</span>
                  ) : (
                    <span className="text-[9px] text-slate-700">.</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {weather.daily.length > 0 && (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Nächste 7 Tage</div>
            <div className="grid grid-cols-7 gap-1.5">
              {weather.daily.slice(0, 7).map((day, i) => (
                <div key={day.day + '-' + i} className="flex flex-col items-center gap-0.5 text-center">
                  <span className="text-[10px] text-slate-500 font-medium">{day.day}</span>
                  <WeatherIcon code={day.icon} size={18} />
                  <span className="text-[11px] text-white">{day.high}&deg;</span>
                  <span className="text-[10px] text-slate-600">{day.low}&deg;</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function LocationPicker({ onSelect }: { onSelect: (plz: string, label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) { setResults([]); setErr(null); return; }
    const id = setTimeout(async () => {
      setBusy(true); setErr(null);
      try {
        const r = await api.weatherSearch(query.trim());
        setResults(r);
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : 'Suche fehlgeschlagen');
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [query, open]);

  const pick = (loc: WeatherLocation) => {
    onSelect(loc.plz, loc.label);
    setOpen(false); setQuery(''); setResults([]);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="tap-target text-[10px] text-slate-500 hover:text-sky-400 transition-colors px-2 py-0.5 rounded border border-slate-700 hover:border-sky-500/40"
        aria-label="Ort ändern"
        aria-expanded={open}
      >
        Ändern
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-lg z-20 p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Stadt oder PLZ suchen..."
            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
            maxLength={60}
          />
          <div className="touch-scroll mt-2 max-h-64 overflow-y-auto">
            {busy && <div className="text-[11px] text-slate-500 px-2 py-1">Sucht...</div>}
            {err && <div className="text-[11px] text-rose-400 px-2 py-1">{err}</div>}
            {!busy && !err && query.length >= 2 && results.length === 0 && (
              <div className="text-[11px] text-slate-500 px-2 py-1">Keine Treffer.</div>
            )}
            {results.map((loc) => (
              <button
                key={loc.plz}
                onClick={() => pick(loc)}
                className="tap-target w-full text-left text-xs text-slate-200 hover:bg-slate-800 px-2 py-2 rounded transition-colors"
              >
                {loc.label}
                <span className="text-slate-600 ml-2">{loc.plz.slice(0, 4)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
