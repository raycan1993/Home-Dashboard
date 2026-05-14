# Home Dashboard

A personal, self-hosted dashboard designed to show everything relevant for starting your day — current weather, live train departures, and an AI-powered weather commentary from Rocky the alien. Runs entirely on your machine with a single command and requires no API keys or account sign-ups.

---

## Management Summary

Home Dashboard is a compact web application that aggregates real-time data from two free public APIs and presents it as a clean, dark-themed dashboard in your browser.

**What it shows**

- **Weather** — current conditions (temperature, wind, humidity, UV, visibility) and a 7-day outlook sourced from MeteoSwiss. Location is searchable by Swiss city name or postcode.
- **Train connections** — the next 15 departures between two configurable Swiss stations, with real-time delay information from the SBB/opendata.ch feed.
- **Rocky the Assistant** — a weather commentary panel featuring Rocky, the alien from *Project Hail Mary* by Andy Weir. Rocky delivers dry, alien observations about the current conditions in his characteristically terse style, cycling through a fresh set of remarks every 10 seconds.
- **Training log** — a static weekly training plan and KPI summary page.

**No external accounts required.** MeteoSwiss and transport.opendata.ch are open APIs; no keys or credentials are needed.

---

## Architecture

```
Browser
  └─► web  (nginx, port 8080)
        ├── serves the React SPA (static files)
        └── /api  ──► server  (Node/Express, port 3001)
                         ├── /api/weather    → MeteoSwiss app API
                         ├── /api/dashboard  → weather + trains combined
                         ├── /api/rocky      → weather-contextual Rocky messages
                         └── /api/health     → status check
                                │
                               db  (PostgreSQL 16, internal only)
                                    └── response cache (weather + trains)
```

The stack is three Docker containers on a private bridge network. Only `web` is reachable from your host machine. The database is used solely as a response cache so that upstream APIs are not hammered on every page load; it never stores personal data.

### Detailed UML Architecture

The diagrams below use Mermaid and mirror the current codebase structure.

#### High-Level Architecture Diagram

```mermaid
flowchart LR
  User["User / Browser"]

  subgraph Web["web container"]
    Nginx["Nginx\nserves React bundle\nproxies /api"]
  end

  subgraph Client["React + Vite client"]
    App["App shell\nnavigation, language, developer mode"]
    Weather["Weather card\ncurrent pattern, forecast, precipitation"]
    Trains["SBB connections\nroute search, departures, capacity"]
    Training["Training views"]
    Rocky["Rocky assistant"]
    DevTools["Developer mode\nweather and train test controls"]
    ApiClient["API client"]
  end

  subgraph Server["server container"]
    Express["Express API\nsecurity, rate limits, routing"]
    Routes["API routes\n/dashboard, /weather, /trains, /rocky, /dev"]
    WeatherService["Weather service\nMeteoSwiss mapping and forecasts"]
    TrainService["Train service\nSBB routes and capacity"]
    RockyService["Rocky service\nweather-aware messages"]
    Cache["Cache layer"]
    Logger["Logger and dev log stream"]
  end

  subgraph Shared["shared workspace package"]
    Contracts["TypeScript contracts\nWeatherData, TrainConnection, DashboardSnapshot"]
  end

  subgraph Database["db container"]
    Postgres["PostgreSQL\nAPI response cache"]
  end

  subgraph External["External APIs"]
    MeteoSwiss["MeteoSwiss API"]
    SBB["SBB / transport.opendata.ch API"]
  end

  User --> Nginx
  Nginx --> App
  App --> Weather
  App --> Trains
  App --> Training
  App --> Rocky
  App --> DevTools
  App --> ApiClient

  ApiClient --> Nginx
  Nginx --> Express
  Express --> Routes
  Routes --> WeatherService
  Routes --> TrainService
  Routes --> RockyService
  Routes --> Logger

  WeatherService --> MeteoSwiss
  TrainService --> SBB
  WeatherService --> Cache
  TrainService --> Cache
  Cache --> Postgres

  Client -. uses .-> Contracts
  Server -. uses .-> Contracts
```

#### Main Data Flow Sequence

```mermaid
sequenceDiagram
autonumber
actor User
participant Browser
participant React as React SPA
participant Api as client/api.ts
participant Nginx as nginx web container
participant Express as Express server
participant Dashboard as /api/dashboard
participant Weather as WeatherService
participant Trains as TrainService
participant Cache as Cache utility
participant DB as PostgreSQL
participant Meteo as MeteoSwiss API
participant SBB as transport.opendata.ch

User->>Browser: Open dashboard
Browser->>Nginx: GET /
Nginx-->>Browser: React static assets
Browser->>React: Boot App
React->>Api: dashboard({ plz? })
Api->>Nginx: GET /api/dashboard
Nginx->>Express: Proxy request
Express->>Dashboard: route handler
Dashboard->>Weather: getWeather(plz)
Dashboard->>Trains: getTrainConnections()

Weather->>Cache: cacheGet(weather:plz)
Cache->>DB: SELECT cache row
alt Weather cache hit
  DB-->>Cache: cached WeatherData
  Cache-->>Weather: WeatherData
else Weather cache miss
  Weather->>Meteo: GET plzDetail
  Meteo-->>Weather: raw forecast payload
  Weather->>Weather: validate Zod schema
  Weather->>Weather: map weather code to WeatherPattern
  Weather->>Weather: build hourly + 10-minute precip
  Weather->>Cache: cacheSet(weather:plz, ttl)
  Cache->>DB: UPSERT cache row
end

Trains->>Cache: cacheGet(route:from:to:minute)
Cache->>DB: SELECT cache row
alt Train cache hit
  DB-->>Cache: cached TrainConnection[]
  Cache-->>Trains: TrainConnection[]
else Train cache miss
  Trains->>SBB: GET /v1/connections
  SBB-->>Trains: raw connection payload
  Trains->>Trains: validate Zod schema
  Trains->>Trains: parse delays, capacity, legs
  Trains->>Cache: cacheSet(route, ttl)
  Cache->>DB: UPSERT cache row
end

Weather-->>Dashboard: WeatherData
Trains-->>Dashboard: TrainConnection[]
Dashboard-->>Express: DashboardSnapshot
Express-->>Nginx: ApiResponse<DashboardSnapshot>
Nginx-->>Api: JSON response
Api-->>React: typed snapshot
React->>React: apply developer overrides if enabled
React-->>Browser: Render WeatherCard, TrainConnections, RockyAssistant
```

#### Interactive Route And Developer Mode Sequence

```mermaid
sequenceDiagram
autonumber
actor User
participant TrainUI as TrainConnections
participant WeatherUI as WeatherCard
participant DevUI as DeveloperMode
participant Api as client/api.ts
participant Express as Express server
participant Trains as TrainService
participant Weather as WeatherService
participant SBB as transport.opendata.ch
participant Meteo as MeteoSwiss API

User->>TrainUI: Type station query
TrainUI->>Api: trainSearch(q)
Api->>Express: GET /api/trains/stations?q=
Express->>Trains: searchStations(q)
Trains->>SBB: GET /v1/locations
SBB-->>Trains: station candidates
Trains-->>Express: StationLocation[]
Express-->>TrainUI: candidates
User->>TrainUI: Select from/to station
TrainUI->>Api: trainConnections(from, to)
Api->>Express: GET /api/trains/connections
Express->>Trains: getTrainConnectionsForRoute()
Trains->>SBB: GET /v1/connections
SBB-->>Trains: connections with capacity
Trains-->>TrainUI: TrainConnection[]
TrainUI->>TrainUI: render capacity icons for 1st/2nd class

User->>DevUI: Open hidden Dev button
DevUI-->>User: Show controls disabled while off
User->>DevUI: Toggle developer mode on
DevUI->>WeatherUI: enable pattern preview/debug controls
DevUI->>WeatherUI: inject simulated WeatherData
DevUI->>TrainUI: inject simulated TrainConnection[]
DevUI->>DevUI: show warning/train/weather test controls
User->>WeatherUI: Select preview pattern/night variant
WeatherUI->>WeatherUI: render selected icon only while dev mode is active
User->>WeatherUI: Manual refresh
WeatherUI->>Api: dashboard/weather refresh
Api->>Express: GET /api/dashboard or /api/weather
Express->>Weather: getWeather(plz)
Weather->>Meteo: fetch if cache miss
Meteo-->>Weather: forecast payload
Weather-->>WeatherUI: updated live weather
```

**Key technology choices**

| Layer | Stack |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, TypeScript |
| Backend | Node 20, Express 5, Zod, Helmet, Prisma |
| Database | PostgreSQL 16 (cache only) |
| Container | Docker Compose, multi-stage builds |
| Shared types | `@home-dashboard/shared` (npm workspace) |

---

## Prerequisites

- **Docker Desktop** — [download here](https://www.docker.com/products/docker-desktop/). This is the only requirement; everything else runs inside containers.
- **Git** — to clone the repository.
- **(Optional) Make** — for the convenience `make` shortcuts. Git for Windows ships with it; on macOS it is pre-installed.

---

## Quick Start

```sh
git clone <repo-url> home-dashboard
cd home-dashboard
docker compose up -d --build
```

Open **http://localhost:8080** once the build completes (usually 60–90 seconds on first run).

That is all. No `.env` file needs to be created, no passwords need to be set, and no configuration files need to be edited.

---

## Management Commands

Using `make` (recommended):

| Command | Effect |
|---|---|
| `make` or `make start` | Build images and start all containers |
| `make stop` | Stop containers (data is preserved) |
| `make restart` | Stop, rebuild, and start |
| `make logs` | Tail live logs from all containers |
| `make update` | Pull latest code and rebuild |
| `make clean` | Tear down everything including the database volume |

Using Docker Compose directly:

| Command | Effect |
|---|---|
| `docker compose up -d --build` | Build and start |
| `docker compose down` | Stop |
| `docker compose logs -f` | Live logs |
| `docker compose down -v` | Full reset including database |

---

## Configuration Reference

All settings have built-in defaults. You only need a `.env` file if you want to override them.

| Variable | Default | Description |
|---|---|---|
| `DB_PASSWORD` | `home_dashboard_secret` | PostgreSQL password for the app user |
| `WEATHER_PLZ` | `8400` | 4-digit Swiss postal code for the default weather location |
| `WEATHER_CITY` | `Winterthur` | Display name for the default location |
| `SBB_FROM` | `Winterthur` | Departure station for train connections |
| `SBB_TO` | `Zürich HB` | Destination station |
| `SBB_NUM_CONNECTIONS` | `15` | Number of connections to fetch |
| `WEB_PORT` | `8080` | Host port the dashboard is served on |
| `PUBLIC_URL` | `http://localhost:8080` | Full public URL (used for CORS) |
| `LOG_LEVEL` | `info` | Server log verbosity (`debug`, `info`, `warn`, `error`) |
| `DEVELOPER_MODE` | `false` | Enables the `/api/dev` debugging endpoint |

To override any setting, create a `.env` file in the project root and set only the variables you want to change:

```sh
# .env  (only include what you want to change)
SBB_FROM=Zürich HB
SBB_TO=Bern
WEATHER_PLZ=3000000
WEATHER_CITY=Bern
```

---

## Development Setup

To run the app locally without Docker (for active development):

**Prerequisites:** Node 20+, npm 10+, a running PostgreSQL instance.

```sh
# 1. Install all dependencies (root, client, server, shared)
npm install

# 2. Build the shared types package
npm run build -w packages/shared

# 3. Configure the server
cp server/.env.example server/.env
#    Edit server/.env and set DATABASE_URL to your local Postgres instance

# 4. Push the Prisma schema
cd server && npx prisma db push && cd ..

# 5. Start the server (port 3001) and the Vite dev server (port 5173) in parallel
npm run dev -w server &
npm run dev -w client
```

The Vite dev server proxies `/api` requests to `localhost:3001`, so both run as a unified local stack.

---

## Repository Layout

```
packages/
  shared/src/index.ts       Shared TypeScript types (ApiResponse, WeatherData, …)

server/src/
  config/env.ts             Environment validation (Zod)
  middleware/               Security (Helmet, CORS, rate-limit), logging, errors
  routes/                   health, dashboard, weather, rocky
  services/
    weatherService.ts       MeteoSwiss API integration + caching
    trainService.ts         SBB opendata.ch integration + caching
    rockyService.ts         Weather-to-Rocky-message mapping
  utils/                    Prisma client, HTTP client (SSRF allowlist), logger, cache

client/src/
  components/
    WeatherCard.tsx         Current conditions + location search + 7-day forecast
    TrainConnections.tsx    Live departure board with delay indicators
    RockyAssistant.tsx      Rocky SVG illustration + speech bubble + message cycling
    WeeklyTrainingPlan.tsx  Static training schedule
    TrainingKPIs.tsx        Training metrics display
  hooks/useDashboard.ts     Polling hook for the dashboard snapshot
  api.ts                    Type-safe API client
```

---

## Security Notes

- The web port is bound to `127.0.0.1` — it is not accessible from other machines on your network.
- The database container has no host port binding; it is unreachable from outside the Docker network.
- The server's HTTP client enforces an SSRF allowlist — it will only contact the three known upstream hosts.
- All upstream API responses are validated with Zod schemas before use.
- Request logs redact any fields whose names resemble secrets.
