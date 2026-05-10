/**
 * Open-Meteo integration.
 *
 * Why Open-Meteo: no API key required, so one less secret to manage
 * (smaller attack surface — OWASP A02).
 *
 * Security:
 *   - Upstream response validated with Zod (OWASP A03/A08).
 *   - Lat/lon are bounded numbers (validated in env loader) — no string
 *     interpolation of free-form user input into the URL.
 */
import { z } from 'zod';
import type { WeatherData } from '@home-dashboard/shared';
import { http } from '../utils/httpClient';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const CACHE_KEY = 'weather:current';
const CACHE_TTL = 600; // 10 minutes

const OpenMeteoSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    wind_speed_10m: z.number(),
    weather_code: z.number(),
  }),
  daily: z.object({
    temperature_2m_max: z.array(z.number()).min(1),
    temperature_2m_min: z.array(z.number()).min(1),
    sunrise: z.array(z.string()).min(1),
    sunset: z.array(z.string()).min(1),
  }),
});

// WMO weather code → human description (de) + a stable icon name.
// Names are upstream-agnostic so the frontend can map to any icon set.
function describeCode(code: number): { description: string; icon: string } {
  if (code === 0) return { description: 'Klar', icon: 'clear-day' };
  if (code === 1) return { description: 'Überwiegend klar', icon: 'mostly-clear' };
  if (code === 2) return { description: 'Teilweise bewölkt', icon: 'partly-cloudy' };
  if (code === 3) return { description: 'Bedeckt', icon: 'overcast' };
  if (code === 45 || code === 48) return { description: 'Nebel', icon: 'fog' };
  if (code >= 51 && code <= 57) return { description: 'Niesel', icon: 'drizzle' };
  if (code >= 61 && code <= 67) return { description: 'Regen', icon: 'rain' };
  if (code >= 71 && code <= 77) return { description: 'Schnee', icon: 'snow' };
  if (code >= 80 && code <= 82) return { description: 'Regenschauer', icon: 'rain' };
  if (code >= 85 && code <= 86) return { description: 'Schneeschauer', icon: 'snow' };
  if (code >= 95 && code <= 99) return { description: 'Gewitter', icon: 'thunder' };
  return { description: 'Unbekannt', icon: 'unknown' };
}

export async function getWeather(): Promise<WeatherData> {
  const cached = await cacheGet<WeatherData>(CACHE_KEY);
  if (cached) return cached;

  try {
    const raw = await http.get<unknown>(
      'Weather',
      'https://api.open-meteo.com/v1/forecast',
      {
        params: {
          latitude: env.WEATHER_LATITUDE.toFixed(4),
          longitude: env.WEATHER_LONGITUDE.toFixed(4),
          current:
            'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
          daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
          temperature_unit: 'celsius',
          wind_speed_unit: 'kmh',
          timezone: 'auto',
          forecast_days: 1,
        },
      },
    );

    const parsed = OpenMeteoSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error('Weather', 'upstream schema validation failed');
      return getMockWeather();
    }

    const r = parsed.data;
    const { description, icon } = describeCode(r.current.weather_code);
    const sunrise = r.daily.sunrise[0]!;
    const sunset = r.daily.sunset[0]!;
    const high = r.daily.temperature_2m_max[0]!;
    const low = r.daily.temperature_2m_min[0]!;

    const data: WeatherData = {
      temperature: Math.round(r.current.temperature_2m),
      feelsLike: Math.round(r.current.apparent_temperature),
      description,
      icon,
      humidity: Math.round(r.current.relative_humidity_2m),
      windSpeed: Math.round(r.current.wind_speed_10m),
      location: env.WEATHER_CITY,
      sunrise: Math.floor(new Date(sunrise).getTime() / 1000),
      sunset: Math.floor(new Date(sunset).getTime() / 1000),
      high: Math.round(high),
      low: Math.round(low),
    };

    await cacheSet(CACHE_KEY, data, CACHE_TTL);
    return data;
  } catch (err) {
    logger.error('Weather', 'fetch failed', { error: String(err) });
    return getMockWeather();
  }
}

function getMockWeather(): WeatherData {
  return {
    temperature: 14,
    feelsLike: 12,
    description: 'Teilweise bewölkt',
    icon: 'partly-cloudy',
    humidity: 72,
    windSpeed: 15,
    location: env.WEATHER_CITY,
    sunrise: Math.floor(Date.now() / 1000) - 3600,
    sunset: Math.floor(Date.now() / 1000) + 21_600,
    high: 17,
    low: 9,
  };
}
