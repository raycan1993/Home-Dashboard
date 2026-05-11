// ============================================================
// Shared TypeScript types — used by server and client.
// Single-user, no auth: deliberately no User/Login types.
// ============================================================

// ------------------------------------------------------------
// WEATHER
// ------------------------------------------------------------
export interface WeatherForecastDay {
  /** "Mon", "Tue", ... — formatted server-side in the user's locale. */
  day: string;
  /** Stable icon name (clear-day, partly-cloudy, rain, ...). */
  icon: string;
  high: number;
  low: number;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  location: string;
  sunrise: number;
  sunset: number;
  high: number;
  low: number;
  /** Next ~4 days. May be empty if the upstream call partially fails. */
  forecast: WeatherForecastDay[];
}

// ------------------------------------------------------------
// TRAIN / SBB
// ------------------------------------------------------------
export interface TrainConnection {
  id: string;
  from: string;
  to: string;
  departure: string; // ISO string
  arrival: string;   // ISO string
  duration: string;  // e.g. "00:25"
  platform: string;
  products: string[];
  delay: number;     // minutes
  cancelled: boolean;
  transfers: number;
}

// ------------------------------------------------------------
// TODOS
// ------------------------------------------------------------
export interface TodoList {
  id: string;
  displayName: string;
  isOwner: boolean;
}

export interface TodoItem {
  id: string;
  title: string;
  status: 'notStarted' | 'inProgress' | 'completed';
  importance: 'low' | 'normal' | 'high';
  dueDateTime?: string;
  listId: string;
  createdAt: string;
  completedAt?: string;
  bodyContent?: string;
  hasReminderSet: boolean;
}

// ------------------------------------------------------------
// GROCERIES / BRING
// ------------------------------------------------------------
export interface BringList {
  listUuid: string;
  name: string;
  theme: string;
}

export interface GroceryItem {
  name: string;
  specification: string;
  uuid: string;
}

export interface GroceriesData {
  listUuid: string;
  items: GroceryItem[];
  recentItems: GroceryItem[];
}

// ------------------------------------------------------------
// STRAVA
// ------------------------------------------------------------
export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  startDate: string;
  distance: number;       // meters
  movingTime: number;     // seconds
  elapsedTime: number;
  totalElevationGain: number;
  averageSpeed: number;   // m/s
  maxSpeed: number;
  averageHeartrate?: number;
  maxHeartrate?: number;
  calories?: number;
}

export interface RunningStats {
  weeklyDistance: number;
  monthlyDistance: number;
  weeklyActivities: number;
  recentActivities: StravaActivity[];
  todaysActivity?: StravaActivity;
}

// ------------------------------------------------------------
// CONNECTION STATUS — exposed by /api/health
// Lets the UI show "Microsoft connected", "Strava not connected"
// without ever exposing the tokens themselves.
// ------------------------------------------------------------
export interface ConnectionStatus {
  microsoft: boolean;
  strava: boolean;
  bring: boolean;
  weather: boolean;
}

// ------------------------------------------------------------
// API RESPONSE WRAPPER
// ------------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  // error is a stable code, never a stack trace or library message
  error?: { code: string; message: string };
  timestamp: string;
}

// ------------------------------------------------------------
// DEVELOPER LOG
// ------------------------------------------------------------
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
  payload?: unknown;   // already redacted by the logger
  response?: unknown;  // already redacted/truncated by the logger
}

// ------------------------------------------------------------
// DASHBOARD SNAPSHOT
// ------------------------------------------------------------
export interface DashboardSnapshot {
  weather: WeatherData | null;
  trains: TrainConnection[];
  todos: TodoItem[];
  groceries: GroceryItem[];
  running: RunningStats | null;
  lastUpdated: string;
}
