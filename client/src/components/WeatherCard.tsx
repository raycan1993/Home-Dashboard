// Weather widget: current conditions + 24-hour strip (10-min precip) + 7-day forecast.
import { useEffect, useRef, useState } from 'react';
import { WeatherPattern, type WeatherData, type WeatherLocation } from '@home-dashboard/shared';
import { api, ApiError } from '../api';
import { useLang, tr, type Lang } from '../i18n';
import { Card, SectionTitle } from './Card';
import { WeatherIcon } from './WeatherIcon';
import {
  WEATHER_PATTERN_EXAMPLES,
  WeatherPatternIcon,
  weatherCodeToPattern,
  weatherPatternLabel,
} from './WeatherPatternIcon';

// Derive a translated description from the icon key — avoids relying on server-side
// German strings in weather.description.
function iconDesc(lang: Lang, icon: string): string {
  if (icon === 'sunny') return tr(lang, 'descSunny');
  if (icon === 'rainy') return tr(lang, 'descRainy');
  return tr(lang, 'descCloudy');
}

const PRECIP_BAR_MAX = 34;

function nicePrecipScale(maxValue: number): number {
  if (maxValue <= 0.5) return 0.5;
  if (maxValue <= 1) return 1;
  if (maxValue <= 2) return 2;
  if (maxValue <= 5) return 5;
  if (maxValue <= 10) return 10;
  return Math.ceil(maxValue / 5) * 5;
}

function HourlyForecastStrip({
  hours,
  precip10m,
}: {
  hours: WeatherData['hourly'];
  precip10m?: { time: string; value: number }[];
}) {
  const visibleHours = hours.slice(0, 24);
  const groupedPrecip = visibleHours.map((hour, hourIndex) => {
    const tenMinuteValues = precip10m?.slice(hourIndex * 6, hourIndex * 6 + 6).map((slot) => slot.value);
    if (tenMinuteValues && tenMinuteValues.length > 0) return tenMinuteValues;
    const hourlyValue = hour.precipitation ?? 0;
    return Array.from({ length: 6 }, () => Math.round((hourlyValue / 6) * 100) / 100);
  });
  const hourlyRates = groupedPrecip.map((slots, i) => {
    const total = slots.reduce((sum, value) => sum + value, 0);
    return Math.max(total, visibleHours[i]?.precipitation ?? 0);
  });
  const tenMinuteRates = groupedPrecip.flatMap((slots) => slots.map((value) => value * 6));
  const maxPrecip = Math.max(...hourlyRates, ...tenMinuteRates, 0);
  const scaleMax = nicePrecipScale(maxPrecip);

  return (
    <div className="grid grid-cols-[1fr_auto] gap-1">
      <div className="touch-scroll overflow-x-auto pb-1 -mx-1 px-1">
        <div className="w-max">
          <div className="mb-1 flex gap-2">
            {visibleHours.map((hour, i) => {
              const slots = groupedPrecip[i] ?? [];
              return (
                <div
                  key={'precip-' + hour.time + '-' + i}
                  className="flex h-[38px] w-10 flex-shrink-0 items-end justify-center gap-[2px] border-b border-zinc-700/70 px-[2px]"
                  title={`${hour.time}: ${hourlyRates[i] ?? 0} mm/h`}
                >
                  {slots.map((value, slotIndex) => {
                    const hourlyRate = value * 6;
                    const bh = hourlyRate > 0
                      ? Math.max(Math.round((hourlyRate / scaleMax) * PRECIP_BAR_MAX), 2)
                      : 0;
                    return (
                      <div
                        key={slotIndex}
                        className={hourlyRate > 0 ? 'w-[4px] rounded-t-sm bg-sky-400/80 shadow-[0_0_8px_rgba(56,189,248,0.2)]' : 'w-[4px] rounded-t-sm bg-zinc-800/70'}
                        style={{ height: bh }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            {visibleHours.map((hour, i) => (
              <div
                key={hour.time + '-' + i}
                className="flex w-10 flex-shrink-0 flex-col items-center text-center"
              >
                <span className="text-[10px] text-zinc-500 font-medium">{hour.time}</span>
                <WeatherIcon code={hour.icon} size={18} />
                <span className="text-[11px] text-white">{hour.temperature}&deg;</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex h-[38px] w-8 flex-col items-start justify-between pt-0.5 text-[8px] leading-none text-sky-200/75">
        <span className="tabular-nums">{scaleMax}</span>
        <span className="h-px w-4 bg-sky-300/45" />
        <span className="text-zinc-600">0</span>
        <span className="-mt-0.5 text-[7px] text-zinc-500">mm/h</span>
      </div>
    </div>
  );
}

interface Props {
  weather: WeatherData | null;
  onSelectLocation: (plz: string, label: string) => void;
  developerModeEnabled?: boolean;
  debugNightVariant?: boolean;
  previewPattern?: WeatherPattern | 'live';
  onDebugNightVariantChange?: (enabled: boolean) => void;
  onPreviewPatternChange?: (pattern: WeatherPattern | 'live') => void;
  onRefresh?: () => void;
}

export function WeatherCard({
  weather,
  onSelectLocation,
  developerModeEnabled = false,
  debugNightVariant = false,
  previewPattern = 'live',
  onDebugNightVariantChange,
  onPreviewPatternChange,
  onRefresh,
}: Props) {
  const lang = useLang();
  if (!weather) {
    return (
      <Card className="h-full">
        <SectionTitle>Weather</SectionTitle>
        <div className="text-xs text-zinc-500 py-2">{tr(lang, 'weatherLoading')}</div>
      </Card>
    );
  }

  const mapped = weather.pattern
    ? { pattern: weather.pattern, fallbackReason: weather.patternFallbackReason ?? null }
    : weatherCodeToPattern(weather.weatherCode, weather.isNight);
  const effectivePreviewPattern = developerModeEnabled ? previewPattern : 'live';
  const activePattern = effectivePreviewPattern === 'live' ? mapped.pattern : effectivePreviewPattern;
  const patternLabel = effectivePreviewPattern === 'live'
    ? weather.patternLabel ?? weatherPatternLabel(activePattern)
    : weatherPatternLabel(activePattern);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <SectionTitle>Weather - {weather.location}</SectionTitle>
        <LocationPicker onSelect={onSelectLocation} />
      </div>
      <div className="touch-scroll min-h-0 flex-1 overflow-y-auto pr-1">

        {/* ── Current conditions ──────────────────────────────────────────── */}
        <div className="mb-4 grid grid-cols-[140px_1fr] items-center gap-4">
          <div className="flex min-h-[148px] flex-col items-center justify-center overflow-visible pt-2">
            <WeatherPatternIcon
              pattern={activePattern}
              size={112}
              animated
              forceNight={developerModeEnabled && debugNightVariant}
              className="weather-pattern-icon-hero"
            />
            <div className="mt-1 text-center text-[12px] font-semibold text-zinc-100">{patternLabel}</div>
          </div>
          <div className="min-w-0">
            <div className="text-4xl font-light leading-none text-white">{weather.temperature}&deg;</div>
            <div className="text-xs text-zinc-400">{iconDesc(lang, weather.icon)}</div>
            <SecondaryWeatherBadges weather={weather} pattern={activePattern} />
            <div className="mt-2 space-y-0.5">
              <div className="text-[11px] text-zinc-500">
                {tr(lang, 'feelsLike')} <span className="text-zinc-300">{weather.feelsLike}&deg;</span>
              </div>
              <div className="text-[11px] text-zinc-500">
                {tr(lang, 'today')} <span className="text-zinc-300">{weather.low}&deg; / {weather.high}&deg;</span>
              </div>
              {weather.windSpeed > 0 && (
                <div className="text-[11px] text-zinc-500">
                  Wind <span className="text-zinc-300">{weather.windSpeed} km/h</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {developerModeEnabled && (
          <WeatherDebugPanel
            weather={weather}
            activePattern={activePattern}
            mappedPattern={mapped.pattern}
            fallbackReason={mapped.fallbackReason}
            previewPattern={previewPattern}
            debugNightVariant={debugNightVariant}
            onDebugNightVariantChange={onDebugNightVariantChange}
            onPreviewPatternChange={onPreviewPatternChange}
            onRefresh={onRefresh}
          />
        )}

        {/* ── Next 24 hours ───────────────────────────────────────────────── */}
        {weather.hourly.length > 0 && (
          <div className="mb-2 pb-2 border-b border-zinc-700/50">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mb-1">
              {tr(lang, 'next24h')}
            </div>

            <HourlyForecastStrip hours={weather.hourly} precip10m={weather.precip10m} />
          </div>
        )}

        {/* ── Next 7 days ─────────────────────────────────────────────────── */}
        {weather.daily.length > 0 && (
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
              {tr(lang, 'next7days')}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weather.daily.slice(0, 7).map((day, i) => (
                <div key={day.day + '-' + i} className="flex flex-col items-center gap-0.5 text-center">
                  <span className="text-[10px] text-zinc-500 font-medium">{day.day}</span>
                  <WeatherIcon code={day.icon} size={32} />
                  <span className="text-[11px] text-white">{day.high}&deg;</span>
                  <span className="text-[10px] text-zinc-600">{day.low}&deg;</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Card>
  );
}

function SecondaryWeatherBadges({ weather, pattern }: { weather: WeatherData; pattern: WeatherPattern }) {
  const badges: { key: string; label: string; tone: string }[] = [];
  if (weather.windSpeed >= 20 || pattern === WeatherPattern.Windy) {
    badges.push({ key: 'wind', label: `${weather.windSpeed} km/h`, tone: 'text-sky-200 border-sky-400/40 bg-sky-500/10' });
  }
  if ((weather.uvIndex ?? 0) >= 3) {
    badges.push({ key: 'uv', label: `UV ${weather.uvIndex}`, tone: 'text-amber-200 border-amber-400/40 bg-amber-500/10' });
  }
  if (weather.fogRisk || pattern === WeatherPattern.Fog || pattern === WeatherPattern.LowStratus) {
    badges.push({ key: 'fog', label: weather.fogRisk ? `Fog ${weather.fogRisk}%` : 'Fog', tone: 'text-zinc-200 border-zinc-400/40 bg-zinc-500/10' });
  }
  if (weather.thunderstormRisk || pattern === WeatherPattern.Thunderstorm) {
    badges.push({ key: 'storm', label: weather.thunderstormRisk ? `Storm ${weather.thunderstormRisk}%` : 'Storm', tone: 'text-violet-200 border-violet-400/40 bg-violet-500/10' });
  }
  if (weather.snowLine || pattern === WeatherPattern.Snow || pattern === WeatherPattern.Sleet) {
    badges.push({ key: 'snow', label: weather.snowLine ? `Snow ${weather.snowLine}m` : 'Snow', tone: 'text-cyan-100 border-cyan-300/40 bg-cyan-400/10' });
  }
  if (badges.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {badges.slice(0, 4).map((badge) => (
        <span key={badge.key} className={'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ' + badge.tone}>
          <MiniConditionIcon kind={badge.key} />
          <span className="ml-1">{badge.label}</span>
        </span>
      ))}
    </div>
  );
}

function MiniConditionIcon({ kind }: { kind: string }) {
  const common = 'inline-flex h-3 w-3 items-center justify-center text-[8px] font-black';
  if (kind === 'uv') return <span className={common}>UV</span>;
  if (kind === 'fog') return <span className={common}>FG</span>;
  if (kind === 'storm') return <span className={common}>ST</span>;
  if (kind === 'snow') return <span className={common}>SN</span>;
  return <span className={common}>W</span>;
}

function WeatherDebugPanel({
  weather,
  activePattern,
  mappedPattern,
  fallbackReason,
  previewPattern,
  debugNightVariant,
  onDebugNightVariantChange,
  onPreviewPatternChange,
  onRefresh,
}: {
  weather: WeatherData;
  activePattern: WeatherPattern;
  mappedPattern: WeatherPattern;
  fallbackReason: string | null;
  previewPattern: WeatherPattern | 'live';
  debugNightVariant: boolean;
  onDebugNightVariantChange?: (enabled: boolean) => void;
  onPreviewPatternChange?: (pattern: WeatherPattern | 'live') => void;
  onRefresh?: () => void;
}) {
  const raw = weather.patternDebug?.rawApiResponse ?? { note: 'No raw API response attached to this weather payload.' };
  const rawText = JSON.stringify(raw, null, 2);
  return (
    <div className="mb-3 rounded-xl border border-sky-500/20 bg-sky-950/10 p-2.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-sky-300">Weather Developer Mode</div>
          <div className="text-[10px] text-zinc-500">Pattern mapping and icon diagnostics</div>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="tap-target rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:border-sky-500 hover:text-sky-300"
        >
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <DebugField label="Detected code" value={String(weather.weatherCode ?? weather.patternDebug?.detectedCode ?? 'unknown')} />
        <DebugField label="Mapped pattern" value={weatherPatternLabel(mappedPattern)} />
        <DebugField label="Selected icon" value={weatherPatternLabel(activePattern)} />
        <DebugField label="Last updated" value={weather.patternDebug?.lastUpdated ?? 'unknown'} />
      </div>
      <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-[10px] text-zinc-400">
        <span className="font-semibold text-zinc-300">Fallback:</span> {fallbackReason ?? weather.patternDebug?.fallbackReason ?? 'None'}
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 py-1.5">
        <span className="text-[10px] font-semibold text-zinc-300">Preview night variant</span>
        <input
          type="checkbox"
          checked={debugNightVariant}
          onChange={(e) => onDebugNightVariantChange?.(e.target.checked)}
          className="h-4 w-4 accent-sky-400"
        />
      </div>
      <label className="mt-2 block text-[10px] font-semibold text-zinc-400">
        Preview pattern
        <select
          value={previewPattern}
          onChange={(e) => onPreviewPatternChange?.(e.target.value as WeatherPattern | 'live')}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100"
        >
          <option value="live">Live mapped pattern</option>
          {WEATHER_PATTERN_EXAMPLES.map((example) => (
            <option key={example.pattern} value={example.pattern}>{example.label}</option>
          ))}
        </select>
      </label>
      <div className="mt-2 grid grid-cols-6 gap-1">
        {WEATHER_PATTERN_EXAMPLES.map((example) => (
          <button
            key={example.pattern}
            type="button"
            onClick={() => onPreviewPatternChange?.(example.pattern)}
            className={'tap-target rounded-lg border p-1 transition-colors ' + (previewPattern === example.pattern ? 'border-sky-400 bg-sky-500/20' : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-600')}
            title={example.label}
          >
            <WeatherPatternIcon pattern={example.pattern} size={30} forceNight={debugNightVariant} />
          </button>
        ))}
      </div>
      <details className="mt-2">
        <summary className="tap-target text-[10px] font-semibold text-zinc-400 hover:text-zinc-200">Raw weather API response</summary>
        <pre className="touch-scroll mt-1 max-h-36 overflow-auto rounded-lg bg-zinc-950 p-2 text-[10px] text-zinc-400">{rawText}</pre>
      </details>
    </div>
  );
}

function DebugField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-2">
      <div className="text-zinc-600">{label}</div>
      <div className="truncate font-semibold text-zinc-200">{value}</div>
    </div>
  );
}

function LocationPicker({ onSelect }: { onSelect: (plz: string, label: string) => void }) {
  const lang = useLang();
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
        setErr(e instanceof ApiError ? e.message : tr(lang, 'searchFailed'));
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
        className="tap-target text-[10px] text-zinc-500 hover:text-sky-400 transition-colors px-2 py-0.5 rounded border border-zinc-700 hover:border-sky-500/40"
        aria-label="Change location"
        aria-expanded={open}
      >
        {tr(lang, 'changeLocation')}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-zinc-900 border border-zinc-700 rounded-lg shadow-lg z-20 p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            {...{placeholder: tr(lang, 'searchPlaceholder')}}
            className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500"
            maxLength={60}
          />
          <div className="touch-scroll mt-2 max-h-64 overflow-y-auto">
            {busy && <div className="text-[11px] text-zinc-500 px-2 py-1">{tr(lang, 'searching')}</div>}
            {err && <div className="text-[11px] text-rose-400 px-2 py-1">{err}</div>}
            {!busy && !err && query.length >= 2 && results.length === 0 && (
              <div className="text-[11px] text-zinc-500 px-2 py-1">{tr(lang, 'noResults')}</div>
            )}
            {results.map((loc) => (
              <button
                key={loc.plz}
                onClick={() => pick(loc)}
                className="tap-target w-full text-left text-xs text-zinc-200 hover:bg-zinc-800 px-2 py-2 rounded transition-colors"
              >
                {loc.label}
                <span className="text-zinc-600 ml-2">{loc.plz.slice(0, 4)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
