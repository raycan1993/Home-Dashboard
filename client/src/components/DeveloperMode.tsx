import { useMemo, useState } from 'react';
import {
  WeatherPattern,
  type TrainConnection,
  type WeatherData,
  type WeatherDay,
  type WeatherHour,
} from '@home-dashboard/shared';
import { WEATHER_PATTERN_EXAMPLES, weatherPatternLabel } from './WeatherPatternIcon';

type TrainScenario = 'live' | 'busy' | 'delayed' | 'cancelled' | 'empty';

export interface DevSettings {
  enabled: boolean;
  weatherPattern: WeatherPattern;
  debugNightVariant: boolean;
  previewPattern: WeatherPattern | 'live';
  temperature: number;
  windSpeed: number;
  rain: number;
  trainScenario: TrainScenario;
  trainCount: number;
  showError: boolean;
}

interface DeveloperModeProps {
  baseWeather: WeatherData | null;
  baseTrains: TrainConnection[];
  settings: DevSettings;
  onChange: (settings: DevSettings) => void;
}

const DEFAULT_SETTINGS: DevSettings = {
  enabled: false,
  weatherPattern: WeatherPattern.PartlyCloudy,
  debugNightVariant: false,
  previewPattern: 'live',
  temperature: 14,
  windSpeed: 15,
  rain: 0,
  trainScenario: 'live',
  trainCount: 15,
  showError: false,
};

const WEATHER_OPTIONS: { value: WeatherPattern; label: string }[] = WEATHER_PATTERN_EXAMPLES
  .filter((example) => example.pattern !== WeatherPattern.Unknown)
  .map((example) => ({ value: example.pattern, label: compactPatternLabel(example.pattern) }));

const TRAIN_OPTIONS: { value: TrainScenario; label: string }[] = [
  { value: 'live', label: 'Live-ish' },
  { value: 'busy', label: 'Crowded' },
  { value: 'delayed', label: 'Delays' },
  { value: 'cancelled', label: 'Cancel' },
  { value: 'empty', label: 'Empty' },
];

export const defaultDevSettings = DEFAULT_SETTINGS;

export function DeveloperMode({ baseWeather, baseTrains, settings, onChange }: DeveloperModeProps) {
  const [open, setOpen] = useState(false);
  const activeSummary = useMemo(() => {
    if (!settings.enabled) return 'off';
    return `${weatherPatternLabel(settings.weatherPattern)}, ${settings.temperature} deg, ${settings.trainScenario}`;
  }, [settings]);

  const update = (patch: Partial<DevSettings>) => onChange({ ...settings, ...patch });
  const syncFromLive = () => {
    update({
      weatherPattern: baseWeather?.pattern ?? normalizeWeatherKind(baseWeather?.icon),
      previewPattern: 'live',
      temperature: baseWeather?.temperature ?? settings.temperature,
      windSpeed: baseWeather?.windSpeed ?? settings.windSpeed,
      rain: Math.round(((baseWeather?.precip10m ?? [])[0]?.value ?? settings.rain) * 10) / 10,
      trainCount: Math.max(15, baseTrains.length || settings.trainCount),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          'tap-target fixed bottom-3 right-3 z-50 h-8 rounded-full border px-3 text-[10px] font-black uppercase tracking-[0.16em] shadow-2xl backdrop-blur transition-all ' +
          (settings.enabled
            ? 'border-sky-300/70 bg-sky-400 text-zinc-950 shadow-sky-500/20'
            : 'border-zinc-700/70 bg-zinc-950/30 text-zinc-600 hover:bg-zinc-900/90 hover:text-zinc-300')
        }
        aria-label="Toggle developer mode panel"
        aria-expanded={open}
      >
        Dev
      </button>

      {open && (
        <div className="fixed bottom-14 right-3 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/95 text-zinc-100 shadow-2xl shadow-black/50 backdrop-blur-xl animate-fade-in-up">
          <div className="border-b border-zinc-800 bg-zinc-900/70 px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.9)]" />
              <div className="min-w-0">
                <div className="text-xs font-black tracking-wide">Developer Mode</div>
                <div className="truncate text-[10px] text-zinc-500">{activeSummary}</div>
              </div>
              <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[10px] font-bold text-zinc-400">
                <span>{settings.enabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(e) => update({ enabled: e.target.checked })}
                  className="sr-only"
                />
                <span className={'relative h-5 w-9 rounded-full transition-colors ' + (settings.enabled ? 'bg-sky-400' : 'bg-zinc-700')}>
                  <span className={'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ' + (settings.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
                </span>
              </label>
            </div>
          </div>

          <div className="touch-scroll max-h-[70vh] space-y-4 overflow-y-auto p-3">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Weather Lab</span>
                <button
                  type="button"
                  onClick={syncFromLive}
                  disabled={!settings.enabled}
                  className="tap-target rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400 hover:border-sky-500 hover:text-sky-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-400"
                >
                  Sync live
                </button>
              </div>
              <Segmented
                value={settings.weatherPattern}
                options={WEATHER_OPTIONS}
                disabled={!settings.enabled}
                onChange={(value) => update({ weatherPattern: value, previewPattern: value })}
              />
              <Slider disabled={!settings.enabled} label="Temperature" value={settings.temperature} min={-12} max={38} unit=" C" onChange={(temperature) => update({ temperature })} />
              <Slider disabled={!settings.enabled} label="Wind" value={settings.windSpeed} min={0} max={90} unit=" km/h" onChange={(windSpeed) => update({ windSpeed })} />
              <Slider disabled={!settings.enabled} label="Rain now" value={settings.rain} min={0} max={8} step={0.5} unit=" mm" onChange={(rain) => update({ rain })} />
            </div>

            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Train Board</div>
              <Segmented disabled={!settings.enabled} value={settings.trainScenario} options={TRAIN_OPTIONS} onChange={(trainScenario) => update({ trainScenario })} />
              <Slider disabled={!settings.enabled} label="Rows" value={settings.trainCount} min={15} max={20} unit="" onChange={(trainCount) => update({ trainCount })} />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <span>
                <span className="block text-xs font-semibold text-zinc-200">Show system warning</span>
                <span className="block text-[10px] text-zinc-500">Tests top error banner and cramped layouts.</span>
              </span>
              <input
                type="checkbox"
                checked={settings.showError}
                disabled={!settings.enabled}
                onChange={(e) => update({ showError: e.target.checked })}
                className="h-4 w-4 accent-sky-400"
              />
            </label>

            <button
              type="button"
              onClick={() => onChange(DEFAULT_SETTINGS)}
              className="tap-target w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
            >
              Reset lab
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="mt-2 block">
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className="font-bold tabular-nums text-zinc-100">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="dev-range w-full disabled:cursor-not-allowed disabled:opacity-40"
      />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(62px,1fr))] gap-1 rounded-lg bg-zinc-900 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={
            'tap-target rounded-md px-2 py-1.5 text-[10px] font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ' +
            (value === option.value
              ? 'bg-sky-400 text-zinc-950 shadow shadow-sky-500/20'
              : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200')
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function applyDevWeather(base: WeatherData | null, settings: DevSettings): WeatherData | null {
  if (!settings.enabled) return base;
  const now = Date.now();
  const seed = base ?? createFallbackWeather(now);
  const pattern = settings.weatherPattern;
  const icon = legacyIconFromPattern(pattern);
  const hourly: WeatherHour[] = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now + (i + 1) * 3600_000);
    const swing = Math.round(Math.sin(i / 3) * 4);
    return {
      time: d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
      temperature: settings.temperature + swing,
      icon: i % 5 === 0 ? alternateIcon(icon) : icon,
      precipitation: settings.rain > 0 ? Math.round(Math.max(0, settings.rain - i * 0.18) * 10) / 10 : 0,
    };
  });
  const daily: WeatherDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i + 1);
    return {
      day: d.toLocaleDateString('de-CH', { weekday: 'short' }).slice(0, 2),
      icon: i % 3 === 1 ? alternateIcon(icon) : icon,
      high: settings.temperature + 2 + i,
      low: settings.temperature - 5 + Math.floor(i / 2),
      precipitation: settings.rain > 0 ? Math.max(0, settings.rain - i) : 0,
    };
  });
  const precip10m = Array.from({ length: 144 }, (_, i) => {
    const d = new Date(now + i * 600_000);
    const wave = Math.max(0, Math.sin(i / 7) * settings.rain);
    return {
      time: d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
      value: Math.round(wave * 10) / 10,
    };
  });

  return {
    ...seed,
    temperature: settings.temperature,
    feelsLike: settings.temperature - (settings.windSpeed > 25 ? 3 : 1),
    description: weatherPatternLabel(pattern),
    icon,
    weatherCode: mockCodeFromPattern(pattern),
    pattern,
    patternLabel: weatherPatternLabel(pattern),
    patternFallbackReason: null,
    patternDebug: {
      rawApiResponse: createPatternMockRaw(pattern, settings),
      detectedCode: mockCodeFromPattern(pattern),
      mappedPattern: pattern,
      selectedIcon: pattern,
      fallbackReason: null,
      lastUpdated: new Date(now).toISOString(),
      isNight: settings.debugNightVariant,
    },
    isNight: settings.debugNightVariant,
    uvIndex: sunnyPattern(pattern) && !settings.debugNightVariant ? 6 : 1,
    snowLine: pattern === WeatherPattern.Snow || pattern === WeatherPattern.Sleet ? 900 : null,
    thunderstormRisk: pattern === WeatherPattern.Thunderstorm ? 85 : null,
    fogRisk: pattern === WeatherPattern.Fog || pattern === WeatherPattern.LowStratus ? 75 : null,
    windSpeed: settings.windSpeed,
    high: settings.temperature + 4,
    low: settings.temperature - 5,
    hourly,
    daily,
    precip10m,
    location: seed.location.endsWith(' Lab') ? seed.location : seed.location + ' Lab',
  };
}

export function applyDevTrains(base: TrainConnection[], settings: DevSettings): TrainConnection[] {
  if (!settings.enabled || settings.trainScenario === 'live') return base;
  if (settings.trainScenario === 'empty') return [];
  const now = Date.now();
  return Array.from({ length: settings.trainCount }, (_, i) => {
    const dep = new Date(now + (5 + i * 7) * 60_000);
    const duration = 22 + (i % 4) * 8;
    const cancelled = settings.trainScenario === 'cancelled' && i % 4 === 1;
    const delayed = settings.trainScenario === 'delayed';
    const busy = settings.trainScenario === 'busy';
    return {
      id: 'dev-train-' + settings.trainScenario + '-' + i,
      from: 'Winterthur',
      to: 'Zuerich HB',
      departure: dep.toISOString(),
      arrival: new Date(dep.getTime() + duration * 60_000).toISOString(),
      duration: '00:' + String(duration).padStart(2, '0'),
      platform: String((i % 9) + 1),
      products: i % 3 === 0 ? ['IC'] : i % 3 === 1 ? ['IR'] : ['S'],
      trainType: i % 3 === 0 ? 'IC 1' : i % 3 === 1 ? 'IR 75' : 'S 11',
      direction: i % 2 === 0 ? 'Zuerich HB' : 'Aarau',
      capacity1st: busy ? 3 : i % 3 === 0 ? 1 : 2,
      capacity2nd: busy ? 3 : i % 3 === 0 ? 2 : 1,
      delay: cancelled ? 0 : delayed ? (i % 4) * 3 + 2 : i % 5 === 0 ? 1 : 0,
      cancelled,
      transfers: i % 5 === 0 ? 1 : 0,
      legDurations: i % 5 === 0 ? [12, duration - 12] : undefined,
    };
  });
}

export function getDevRockyMessages(settings: DevSettings): string[] | undefined {
  if (!settings.enabled) return undefined;
  const weather = rainyPattern(settings.weatherPattern)
    ? 'Water falls from sky. Human should wear shell.'
    : sunnyPattern(settings.weatherPattern)
      ? 'Star is loud today. Skin protection wise.'
      : 'Cloud blanket acceptable. Visibility medium.';
  const trains = settings.trainScenario === 'empty'
    ? 'Train board empty. Suspiciously quiet.'
    : settings.trainScenario === 'busy'
      ? 'Many humans will compress into tube. Choose patience.'
      : settings.trainScenario === 'delayed'
        ? 'Schedule has become suggestion. Still useful. Mostly.'
        : settings.trainScenario === 'cancelled'
          ? 'Some trains vanish. Dashboard survives test.'
          : 'Transport appears nominal. Celebrate softly.';
  return [
    `Dev mode active. Temperature set to ${settings.temperature} degrees.`,
    weather,
    trains,
  ];
}

function createFallbackWeather(now: number): WeatherData {
  const pattern = WeatherPattern.PartlyCloudy;
  return {
    temperature: 14,
    feelsLike: 13,
    description: weatherPatternLabel(pattern),
    icon: 'partly-cloudy',
    weatherCode: 3,
    pattern,
    patternLabel: weatherPatternLabel(pattern),
    patternFallbackReason: null,
    patternDebug: {
      rawApiResponse: { mock: true, source: 'client fallback' },
      detectedCode: 3,
      mappedPattern: pattern,
      selectedIcon: pattern,
      fallbackReason: null,
      lastUpdated: new Date(now).toISOString(),
      isNight: false,
    },
    isNight: false,
    uvIndex: 3,
    snowLine: null,
    thunderstormRisk: null,
    fogRisk: null,
    humidity: 60,
    windSpeed: 10,
    location: 'Dev Weather',
    plz: '840000',
    sunrise: Math.floor((now - 3600_000) / 1000),
    sunset: Math.floor((now + 21_600_000) / 1000),
    high: 18,
    low: 9,
    hourly: [],
    daily: [],
  };
}

function normalizeWeatherKind(icon: string | undefined): WeatherPattern {
  if (icon === 'sunny') return WeatherPattern.Sunny;
  if (icon === 'rainy') return WeatherPattern.Rain;
  return WeatherPattern.PartlyCloudy;
}

function alternateIcon(icon: string): string {
  if (icon === 'sunny') return 'partly-cloudy';
  if (icon === 'rainy') return 'partly-cloudy';
  return 'sunny';
}

function compactPatternLabel(pattern: WeatherPattern): string {
  return weatherPatternLabel(pattern)
    .replace('Partly cloudy', 'Partly')
    .replace('Thunderstorm', 'Storm')
    .replace('Low stratus', 'Stratus')
    .replace('Mostly sunny', 'Mostly');
}

function legacyIconFromPattern(pattern: WeatherPattern): string {
  if (sunnyPattern(pattern)) return 'sunny';
  if (
    rainyPattern(pattern) ||
    pattern === WeatherPattern.Snow ||
    pattern === WeatherPattern.Sleet ||
    pattern === WeatherPattern.Hail ||
    pattern === WeatherPattern.Thunderstorm
  ) return 'rainy';
  return 'partly-cloudy';
}

function sunnyPattern(pattern: WeatherPattern): boolean {
  return pattern === WeatherPattern.Sunny || pattern === WeatherPattern.MostlySunny || pattern === WeatherPattern.ClearNight;
}

function rainyPattern(pattern: WeatherPattern): boolean {
  return pattern === WeatherPattern.LightRain || pattern === WeatherPattern.Rain || pattern === WeatherPattern.HeavyRain;
}

function mockCodeFromPattern(pattern: WeatherPattern): number {
  const index = WEATHER_PATTERN_EXAMPLES.findIndex((example) => example.pattern === pattern);
  return index >= 0 ? index + 1 : 999;
}

function createPatternMockRaw(pattern: WeatherPattern, settings: DevSettings): unknown {
  return {
    developerMode: true,
    currentWeather: {
      iconV2: mockCodeFromPattern(pattern),
      mappedPattern: pattern,
      temperature: settings.temperature,
      windSpeed: settings.windSpeed,
      rain: settings.rain,
      nightVariant: settings.debugNightVariant,
    },
  };
}
