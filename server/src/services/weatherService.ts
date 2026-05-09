/**
 * OpenWeatherMap integration.
 *
 * Security:
 *   - Upstream response is validated against a Zod schema
 *     (OWASP A03: Injection / A08: Data Integrity).
 *     A malicious or buggy upstream cannot inject unexpected fields.
 *   - API key only flows in via the env loader; never logged
 *     (logger redacts `appid` query parameter).
 */
import { z } from 'zod';
import type { WeatherData } from '@home-dashboard/shared';
import { http } from '../utils/httpClient';
import { cacheGet, cacheSet } from '../utils/cache';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const CACHE_KEY = 'weather:current';
const CACHE_TTL = 600; // 10 minutes

const OWMResponseSchema = z.object({
  name: z.string(),
  main: z.object({
    temp: z.number(),
    feels_like: z.number(),
    humidity: z.number(),
    temp_min: z.number(),
    temp_max: z.number(),
  }),
  weather: z
    .array(z.object({ description: z.string(), icon: z.string() }))
    .min(1),
  wind: z.object({ speed: z.number() }),
  sys: z.object({ sunrise: z.number(), sunset: z.number() }),
});

export async function getWeather(): Promise<WeatherData> {
  const cached = await cacheGet<WeatherData>(CACHE_KEY);
  if (cached) return cached;

  if (!env.OPENWEATHER_API_KEY) {
    logger.warn('Weather', 'no API key configured — returning mock');
    return getMockWeather();
  }

  const raw = await http.get<unknown>(
    'Weather',
    'https://api.openweathermap.org/data/2.5/weather',
    {
      params: {
        q: `${env.WEATHER_CITY},${env.WEATHER_COUNTRY}`,
        appid: env.OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'de',
      },
    },
  );

  const parsed = OWMResponseSchema.safeParse(raw);
  if (!parsed.success) {
    logger.error('Weather', 'upstream response failed schema validation');
    return getMockWeather();
  }

  const r = parsed.data;
  const data: WeatherData = {
    temperature: Math.round(r.main.temp),
    feelsLike: Math.round(r.main.feels_like),
    description: r.weather[0]?.description ?? '',
    icon: r.weather[0]?.icon ?? '',
    humidity: r.main.humidity,
    windSpeed: Math.round(r.wind.speed * 3.6),
    location: r.name,
    sunrise: r.sys.sunrise,
    sunset: r.sys.sunset,
    high: Math.round(r.main.temp_max),
    low: Math.round(r.main.temp_min),
  };

  await cacheSet(CACHE_KEY, data, CACHE_TTL);
  return data;
}

function getMockWeather(): WeatherData {
  return {
    temperature: 14,
    feelsLike: 12,
    description: 'Teilweise bewölkt',
    icon: '02d',
    humidity: 72,
    windSpeed: 15,
    location: env.WEATHER_CITY,
    sunrise: Math.floor(Date.now() / 1000) - 3600,
    sunset: Math.floor(Date.now() / 1000) + 21_600,
    high: 17,
    low: 9,
  };
}
