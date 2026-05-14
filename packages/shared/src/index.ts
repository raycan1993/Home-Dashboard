// Shared TypeScript types used by server and client.
// Single-user, no auth.

// WEATHER -----------------------------------------------------------------
export interface WeatherDay {
  day: string;
  icon: string;
  high: number;
  low: number;
  precipitation?: number;
}

export interface WeatherHour {
  time: string;
  temperature: number;
  icon: string;
  precipitation?: number;
}

export interface WeatherLocation {
  plz: string;
  label: string;
}

export const WeatherPattern = {
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

export type WeatherPattern = (typeof WeatherPattern)[keyof typeof WeatherPattern];

export interface WeatherPatternDebug {
  rawApiResponse?: unknown;
  detectedCode?: number | null;
  mappedPattern: WeatherPattern;
  selectedIcon: string;
  fallbackReason?: string | null;
  lastUpdated: string;
  isNight: boolean;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  weatherCode?: number | null;
  pattern?: WeatherPattern;
  patternLabel?: string;
  patternFallbackReason?: string | null;
  patternDebug?: WeatherPatternDebug;
  isNight?: boolean;
  uvIndex?: number | null;
  snowLine?: number | null;
  thunderstormRisk?: number | null;
  fogRisk?: number | null;
  humidity: number;
  windSpeed: number;
  location: string;
  plz: string;
  sunrise: number;
  sunset: number;
  high: number;
  low: number;
  hourly: WeatherHour[];
  daily: WeatherDay[];
  precip10m?: { time: string; value: number }[];
}

// STATION SEARCH ----------------------------------------------------------
export interface StationLocation {
  id: string;
  name: string;
}

// TRAIN -------------------------------------------------------------------
export interface TrainConnection {
  id: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  duration: string;
  platform: string;
  products: string[];
  trainType?: string;
  direction?: string;
  capacity1st?: number | null;
  capacity2nd?: number | null;
  delay: number;
  cancelled: boolean;
  transfers: number;
  legDurations?: number[];
}

// CONNECTION STATUS -------------------------------------------------------
export interface ConnectionStatus {
  weather: boolean;
  trains: boolean;
}

// API ENVELOPE ------------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  timestamp: string;
}

// DEV LOG -----------------------------------------------------------------
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
export type LogDirection = 'IN' | 'OUT' | 'INTERNAL';
export interface DevLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  direction: LogDirection;
  service: string;
  message: string;
  url?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  payload?: unknown;
  response?: unknown;
}

// DASHBOARD SNAPSHOT ------------------------------------------------------
export interface DashboardSnapshot {
  weather: WeatherData | null;
  trains: TrainConnection[];
  lastUpdated: string;
}
