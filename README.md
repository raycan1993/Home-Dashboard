# Home Dashboard

A personal, self-hosted dashboard designed to show everything relevant for starting your day — current weather, live train departures, and an AI-powered weather commentary from Rocky the alien. Runs entirely on your machine with a single command and requires no API keys or account sign-ups.

---

## Management Summary

Home Dashboard is a compact web application that aggregates real-time data from two free public APIs and presents it as a clean, dark-themed dashboard in your browser.

**What it shows**

- **Weather** — current conditions (temperature, wind, humidity, UV, visibility) and a 7-day outlook sourced from MeteoSwiss. Location is searchable by Swiss city name or postcode.
- **Train connections** — the next 5 departures between two configurable Swiss stations, with real-time delay information from the SBB/opendata.ch feed.
- **Rocky the Assistant** — a weather commentary panel featuring Rocky, the alien from *Project Hail Mary* by Andy Weir. Rocky delivers dry, alien observations about the current conditions in his characteristically terse style, cycling through a fresh set of remarks every 10 seconds.
- **Training log** — a static weekly training plan and KPI summary page.

**No external accounts required.** MeteoSwiss and transport.opendata.ch are open APIs; no keys or credentials are needed.

---

## Architecture

![Home Dashboard architecture diagram](docs/architecture.svg)

The stack is three Docker containers on a private bridge network. Only `web` is reachable from your host machine. The database is used solely as a response cache so that upstream APIs are not hammered on every page load; it never stores personal data.

For software architects, the diagram shows the main runtime responsibilities: Nginx serves the React SPA and proxies `/api`, the Express server owns validation and service orchestration, PostgreSQL stores cached API responses, and MeteoSwiss plus SBB/transport.opendata.ch provide live external data.

For security architects, the diagram calls out the trust boundaries and review points: the public HTTP entry point, user-supplied station/location queries, untrusted upstream API responses, developer-mode log exposure, cached response data, and the controls currently in place (`Helmet`/CSP, CORS allowlist, rate limits, SSRF host allowlist, disabled redirects, input validation, and production blocking for `DEVELOPER_MODE`).

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
| `SBB_NUM_CONNECTIONS` | `5` | Number of connections to fetch |
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
