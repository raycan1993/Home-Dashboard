/**
 * MeteoSwiss app API integration.
 *   GET /v2/forecast?plz=<plz>&graph=true  - current + hourly + daily
 *   GET /v1/search?query=<text>            - PLZ lookup for location switcher
 *
 * The strict OGD catalog publishes raw NetCDF model files, unsuitable for a
 * consumer dashboard. The app API is the same one MeteoSwiss's mobile app uses.
 */
import { z } from 'zod';
import type { WeatherData, WeatherDay, WeatherHour, WeatherLocation, WeatherPattern as WeatherPatternType } from '@home-dashboard/shared';
import { http } from '../utils/httpClient';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { SWISS_LOCATIONS } from '../data/swissLocations';

const FORECAST_CACHE_TTL = 30 * 60;
const SEARCH_CACHE_TTL = 24 * 3600;
const PLZ_RE = /^\d{6}$/;
const PLZ_INPUT_RE = /^\d{4}(\d{2}|\d{3})?$/;
const SEARCH_RE = /^[\p{L}\p{N}\s\-.'/()]{1,60}$/u;
const WeatherPattern = {
  Sunny: 'sunny',
  MostlySunny: 'mostly-sunny',
  PartlyCloudy: 'partly-cloudy',
  Cloudy: 'cloudy',
  Overcast: 'overcast',
  LightRain: 'light-rain',
  Rain: 'rain',
  HeavyRain: 'heavy-rain',
  Thunderstorm: 'thunderstorm',
  Snow: 'snow',
  Sleet: 'sleet',
  Fog: 'fog',
  LowStratus: 'low-stratus',
  Windy: 'windy',
  Hail: 'hail',
  ClearNight: 'clear-night',
  PartlyCloudyNight: 'partly-cloudy-night',
  Unknown: 'unknown',
} as const;

const CurrentSchema = z.object({
  temperature: z.union([z.number(), z.string()]).nullable().optional(),
  icon: z.number().nullable().optional(),
  iconV2: z.number().nullable().optional(),
}).passthrough();

const DayEntrySchema = z.object({
  dayDate: z.string(),
  iconDay: z.number().optional(),
  iconDayV2: z.number().optional(),
  temperatureMin: z.number().optional(),
  temperatureMax: z.number().optional(),
  precipitation: z.number().optional(),
}).passthrough();

const GraphSchema = z.object({
  start: z.union([z.string(), z.number()]).optional(),
  temperatureMean1h: z.array(z.number()).optional(),
  precipitation10m: z.array(z.number()).optional(),
  weatherIcon3h: z.array(z.number()).optional(),
  weatherIcon3hV2: z.array(z.number()).optional(),
  sunrise: z.array(z.union([z.string(), z.number()])).optional(),
  sunset: z.array(z.union([z.string(), z.number()])).optional(),
}).passthrough();

const ForecastResponseSchema = z.object({
  currentWeather: CurrentSchema.optional(),
  forecast: z.array(DayEntrySchema).optional(),
  graph: GraphSchema.optional(),
}).passthrough();

const GeoAdminSearchSchema = z.object({
  results: z.array(z.object({
    attrs: z.object({
      detail: z.string().optional(),
      label: z.string().optional(),
    }).passthrough(),
  }).passthrough()).optional(),
}).passthrough();

function iconFromCode(code: number | undefined): string {
  if (code === undefined) return 'partly-cloudy';
  const day = code > 50 ? code - 50 : code;
  if (day === 1 || day === 2 || day === 26) return 'sunny';
  if (day === 3 || day === 4 || day === 5 || day === 6 || day === 27 || day === 28) return 'partly-cloudy';
  return 'rainy';
}

function patternLabel(pattern: WeatherPatternType): string {
  return pattern.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function patternFromCode(code: number | undefined, isNight: boolean): { pattern: WeatherPatternType; fallbackReason: string | null } {
  if (code === undefined) {
    return { pattern: isNight ? WeatherPattern.PartlyCloudyNight : WeatherPattern.PartlyCloudy, fallbackReason: 'No weather code returned by MeteoSwiss.' };
  }
  const day = code > 50 ? code - 50 : code;
  const nightVariant = isNight || code > 50;
  if (day === 1) return { pattern: nightVariant ? WeatherPattern.ClearNight : WeatherPattern.Sunny, fallbackReason: null };
  if (day === 2 || day === 26) return { pattern: nightVariant ? WeatherPattern.PartlyCloudyNight : WeatherPattern.MostlySunny, fallbackReason: null };
  if (day === 3 || day === 27) return { pattern: nightVariant ? WeatherPattern.PartlyCloudyNight : WeatherPattern.PartlyCloudy, fallbackReason: null };
  if (day === 4 || day === 28) return { pattern: WeatherPattern.Cloudy, fallbackReason: null };
  if (day === 5) return { pattern: WeatherPattern.Overcast, fallbackReason: null };
  if (day === 6) return { pattern: WeatherPattern.LowStratus, fallbackReason: null };
  if (day === 7 || day === 8 || day === 9) return { pattern: WeatherPattern.Fog, fallbackReason: null };
  if (day === 10 || day === 11) return { pattern: WeatherPattern.LightRain, fallbackReason: null };
  if (day === 12 || day === 13 || day === 14) return { pattern: WeatherPattern.Rain, fallbackReason: null };
  if (day === 15 || day === 16) return { pattern: WeatherPattern.HeavyRain, fallbackReason: null };
  if (day === 17 || day === 18 || day === 19) return { pattern: WeatherPattern.Snow, fallbackReason: null };
  if (day === 20 || day === 21) return { pattern: WeatherPattern.Sleet, fallbackReason: null };
  if (day === 22 || day === 23 || day === 24) return { pattern: WeatherPattern.Thunderstorm, fallbackReason: null };
  if (day === 25) return { pattern: WeatherPattern.Hail, fallbackReason: null };
  return { pattern: nightVariant ? WeatherPattern.PartlyCloudyNight : WeatherPattern.PartlyCloudy, fallbackReason: `Unknown MeteoSwiss weather code ${code}; using readable fallback.` };
}

function toNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizePlz(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const raw = v.trim();
  if (!PLZ_INPUT_RE.test(raw)) return undefined;
  if (raw.length === 4) return raw + '00';
  if (raw.length === 7) return raw.slice(0, 6);
  return raw;
}

function displayPlz(plz: string): string {
  return plz.slice(0, 4);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/_/g, '').replace(/\s+/g, ' ').trim();
}

function labelFromGeoDetail(detail: string | undefined, fallback: string | undefined): string | undefined {
  const clean = stripHtml(detail ?? fallback ?? '');
  const m = clean.match(/^(\d{4})\s+(.+)$/);
  if (!m) return clean || undefined;
  const postcode = m[1] ?? '';
  const name = m[2] ?? '';
  const place = name.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  return place + ' (' + postcode + ')';
}

function locationLabel(plz: string): string {
  const known = SWISS_LOCATIONS.find((loc) => normalizePlz(loc.plz) === plz);
  return known?.label ?? displayPlz(plz);
}

const WEEKDAY_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function shortDay(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return WEEKDAY_DE[d.getDay()] ?? '';
}
function fmtHour(d: Date): string {
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' });
}
function describeIcon(icon: string): string {
  if (icon === 'sunny') return 'Sunny';
  if (icon === 'rainy') return 'Rainy';
  return 'Partly cloudy';
}

function calcNextHourMs(): number {
  const t = new Date();
  t.setMinutes(0, 0, 0);
  if (t.getTime() <= Date.now()) t.setHours(t.getHours() + 1);
  return t.getTime();
}

function buildHourly(
  graph: z.infer<typeof GraphSchema> | undefined,
  nextHourMs: number,
): WeatherHour[] {
  if (!graph || !graph.start || !graph.temperatureMean1h) return [];
  const startMs = new Date(graph.start).getTime();
  if (isNaN(startMs)) return [];
  const temps = graph.temperatureMean1h;
  const icons3h = graph.weatherIcon3hV2 ?? graph.weatherIcon3h ?? [];
  const precip10mArr = graph.precipitation10m ?? [];
  const out: WeatherHour[] = [];
  const firstIndex = Math.max(0, Math.ceil((nextHourMs - startMs) / 3600_000));
  for (let i = firstIndex; i < temps.length && out.length < 24; i++) {
    const t = temps[i];
    if (t === undefined) continue;
    const d = new Date(startMs + i * 3600_000);
    const iconCode = icons3h[Math.floor(i / 3)];
    let precipMm = 0;
    let hasPrecip = false;
    for (let s = 0; s < 6; s++) {
      const v = precip10mArr[i * 6 + s];
      if (v !== undefined) { precipMm += v; hasPrecip = true; }
    }
    const entry: WeatherHour = {
      time: fmtHour(d),
      temperature: Math.round(t),
      icon: iconFromCode(iconCode),
    };
    if (hasPrecip) entry.precipitation = Math.round(precipMm * 10) / 10;
    out.push(entry);
  }
  return out;
}

// 10-minute precipitation slots aligned to the same start as buildHourly.
// Returns up to 144 entries (24 h), one per 10-min interval.
function buildPrecip10m(
  graph: z.infer<typeof GraphSchema> | undefined,
  nextHourMs: number,
): { time: string; value: number }[] {
  if (!graph?.start || !graph.precipitation10m?.length) return [];
  const startMs = new Date(graph.start).getTime();
  if (isNaN(startMs)) return [];
  const precip = graph.precipitation10m;
  // Align to the same hour boundary as buildHourly
  const firstIdx = Math.round((nextHourMs - startMs) / 600_000);
  if (firstIdx < 0) return [];
  const out: { time: string; value: number }[] = [];
  for (let i = firstIdx; i < precip.length && out.length < 144; i++) {
    const v = precip[i];
    if (v === undefined) continue;
    const d = new Date(startMs + i * 600_000);
    out.push({ time: fmtHour(d), value: Math.round(v * 100) / 100 });
  }
  return out;
}

export async function getWeather(plzOverride?: string): Promise<WeatherData> {
  const plz = normalizePlz(plzOverride) ?? normalizePlz(env.WEATHER_PLZ) ?? '840000';
  const cacheKey = 'weather:' + plz;
  const cached = await cacheGet<WeatherData>(cacheKey);
  if (cached) return cached;

  try {
    const raw = await http.get<unknown>(
      'Weather',
      'https://app-prod-ws.meteoswiss-app.ch/v2/plzDetail?plz=' + plz,
    );
    const parsed = ForecastResponseSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error('Weather', 'MeteoSwiss schema validation failed');
      return getMockWeather(plz);
    }
    const r = parsed.data;
    const currentTempNum = toNum(r.currentWeather?.temperature) ?? 0;
    const currentCode = r.currentWeather?.iconV2 ?? r.currentWeather?.icon ?? undefined;
    const currentIcon = iconFromCode(currentCode);

    const daily: WeatherDay[] = (r.forecast ?? []).slice(1, 8).map((d): WeatherDay | null => {
      const hi = toNum(d.temperatureMax);
      const lo = toNum(d.temperatureMin);
      if (hi === undefined || lo === undefined) return null;
      const entry: WeatherDay = {
        day: shortDay(d.dayDate),
        icon: iconFromCode(d.iconDayV2 ?? d.iconDay),
        high: Math.round(hi),
        low: Math.round(lo),
      };
      const precip = toNum(d.precipitation);
      if (precip !== undefined) entry.precipitation = Math.round(precip * 10) / 10;
      return entry;
    }).filter((d): d is WeatherDay => d !== null);

    const nextHourMs = calcNextHourMs();
    const hourly = buildHourly(r.graph, nextHourMs);
    const precip10m = buildPrecip10m(r.graph, nextHourMs);
    const todaysDay = (r.forecast ?? [])[0];
    const todayHi = toNum(todaysDay?.temperatureMax) ?? currentTempNum;
    const todayLo = toNum(todaysDay?.temperatureMin) ?? currentTempNum;
    const sunriseIso = r.graph?.sunrise?.[0];
    const sunsetIso = r.graph?.sunset?.[0];

    const isNight = (() => {
      const now = Date.now();
      const sunriseMs = sunriseIso ? new Date(sunriseIso).getTime() : NaN;
      const sunsetMs = sunsetIso ? new Date(sunsetIso).getTime() : NaN;
      return Number.isFinite(sunriseMs) && Number.isFinite(sunsetMs) ? now < sunriseMs || now > sunsetMs : false;
    })();
    const mapped = patternFromCode(currentCode, isNight);
    const lastUpdated = new Date().toISOString();

    const data: WeatherData = {
      temperature: Math.round(currentTempNum),
      feelsLike: Math.round(currentTempNum),
      description: patternLabel(mapped.pattern),
      icon: currentIcon,
      weatherCode: currentCode ?? null,
      pattern: mapped.pattern,
      patternLabel: patternLabel(mapped.pattern),
      patternFallbackReason: mapped.fallbackReason,
      patternDebug: {
        rawApiResponse: raw,
        detectedCode: currentCode ?? null,
        mappedPattern: mapped.pattern,
        selectedIcon: mapped.pattern,
        fallbackReason: mapped.fallbackReason,
        lastUpdated,
        isNight,
      },
      isNight,
      uvIndex: currentIcon === 'sunny' && !isNight ? 6 : currentIcon === 'partly-cloudy' && !isNight ? 3 : 1,
      snowLine: mapped.pattern === WeatherPattern.Snow || mapped.pattern === WeatherPattern.Sleet ? 900 : null,
      thunderstormRisk: mapped.pattern === WeatherPattern.Thunderstorm ? 80 : null,
      fogRisk: mapped.pattern === WeatherPattern.Fog || mapped.pattern === WeatherPattern.LowStratus ? 70 : null,
      humidity: 0,
      windSpeed: 0,
      location: locationLabel(plz),
      plz,
      sunrise: sunriseIso ? Math.floor(new Date(sunriseIso).getTime() / 1000) : 0,
      sunset: sunsetIso ? Math.floor(new Date(sunsetIso).getTime() / 1000) : 0,
      high: Math.round(todayHi),
      low: Math.round(todayLo),
      hourly,
      daily,
      precip10m,
    };
    await cacheSet(cacheKey, data, FORECAST_CACHE_TTL);
    return data;
  } catch (err) {
    logger.error('Weather', 'MeteoSwiss fetch failed', { error: String(err) });
    return getMockWeather(plz);
  }
}

function getMockWeather(plz: string): WeatherData {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  if (nextHour.getTime() <= Date.now()) nextHour.setHours(nextHour.getHours() + 1);
  const now = nextHour.getTime();
  const hourly: WeatherHour[] = Array.from({ length: 24 }, (_, i) => ({
    time: fmtHour(new Date(now + i * 3600_000)),
    temperature: 14 + Math.round(Math.sin(i / 4) * 4),
    icon: i < 6 || i > 20 ? 'partly-cloudy' : 'sunny',
  }));
  const pattern = WeatherPattern.PartlyCloudy;
  return {
    temperature: 14, feelsLike: 12,
    description: 'Partly cloudy', icon: 'partly-cloudy',
    weatherCode: 3,
    pattern,
    patternLabel: patternLabel(pattern),
    patternFallbackReason: null,
    patternDebug: {
      rawApiResponse: { mock: true, source: 'getMockWeather' },
      detectedCode: 3,
      mappedPattern: pattern,
      selectedIcon: pattern,
      fallbackReason: null,
      lastUpdated: new Date().toISOString(),
      isNight: false,
    },
    isNight: false,
    uvIndex: 3,
    snowLine: null,
    thunderstormRisk: null,
    fogRisk: null,
    humidity: 72, windSpeed: 15, location: locationLabel(plz), plz,
    sunrise: Math.floor(now / 1000) - 3600,
    sunset: Math.floor(now / 1000) + 21_600,
    high: 17, low: 9, hourly,
    daily: Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() + i + 1);
      return {
        day: shortDay(d.toISOString()),
        icon: i % 3 === 0 ? 'rainy' : i % 3 === 1 ? 'partly-cloudy' : 'sunny',
        high: 14 + i,
        low: 8 + i,
      };
    }),
  };
}

export async function searchLocations(query: string): Promise<WeatherLocation[]> {
  const q = (query ?? '').trim();
  if (q.length < 2) return [];
  if (!SEARCH_RE.test(q)) {
    logger.warn('Weather', 'search query rejected by regex');
    return [];
  }
  const cacheKey = 'weather-search:' + Buffer.from(q.toLowerCase()).toString('base64url');
  const cached = await cacheGet<WeatherLocation[]>(cacheKey);
  if (cached) return cached;
  try {
    const localMatches = SWISS_LOCATIONS
      .map((loc) => ({ plz: normalizePlz(loc.plz) ?? loc.plz, label: loc.label }))
      .filter((loc) => PLZ_RE.test(loc.plz))
      .filter((loc) => loc.label.toLowerCase().includes(q.toLowerCase()) || displayPlz(loc.plz).startsWith(q))
      .slice(0, 8);

    const geoRaw = await http.get<unknown>(
      'Weather',
      'https://api3.geo.admin.ch/rest/services/api/SearchServer?type=featuresearch&features=ch.swisstopo-vd.ortschaftenverzeichnis_plz&limit=12&searchText=' + encodeURIComponent(q),
    );
    const geoParsed = GeoAdminSearchSchema.safeParse(geoRaw);
    const geoMatches: WeatherLocation[] = geoParsed.success
      ? (geoParsed.data.results ?? []).map((e): WeatherLocation | null => {
        const detail = stripHtml(e.attrs.detail ?? '');
        const m = detail.match(/^(\d{4})\b/);
        if (!m) return null;
        const plz = normalizePlz(m[1]);
        if (!plz) return null;
        const label = labelFromGeoDetail(e.attrs.detail, e.attrs.label) ?? displayPlz(plz);
        return { plz, label };
      }).filter((e): e is WeatherLocation => e !== null)
      : [];

    const byPlz = new Map<string, WeatherLocation>();
    for (const loc of [...localMatches, ...geoMatches]) {
      if (!byPlz.has(loc.plz)) byPlz.set(loc.plz, loc);
    }
    const out = [...byPlz.values()].slice(0, 8);
    await cacheSet(cacheKey, out, SEARCH_CACHE_TTL);
    return out;
  } catch (err) {
    logger.error('Weather', 'search failed', { error: String(err) });
    return [];
  }
}
