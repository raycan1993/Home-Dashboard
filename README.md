# Home Dashboard

Personal dashboard showing weather and train connections. Single-user, runs on your machine, and is served at `http://localhost:8080` by default.

## Quick Start

Prerequisite: Docker Desktop for Windows.

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up -d --build
start http://localhost:8080
```

Required configuration:

- `DB_PASSWORD`: password for the local Postgres app user.

Optional configuration:

- `WEATHER_PLZ`, `WEATHER_CITY`
- `SBB_FROM`, `SBB_TO`, `SBB_NUM_CONNECTIONS`
- `WEB_PORT`, `PUBLIC_URL`
- `DEVELOPER_MODE`, `LOG_LEVEL`

## Features

- Weather from MeteoSwiss, including location search by Swiss city or postcode.
- Train connections from transport.opendata.ch / SBB data.
- Compact responsive dashboard layout.
- Static training page remains available, but no Strava integration is active.

## Architecture

```text
Browser -> web (nginx) -> server (Express) -> db (Postgres)
```

- `web`: serves the React SPA and reverse-proxies `/api` to the server.
- `server`: exposes `/api/health`, `/api/dashboard`, `/api/weather`, and `/api/dev`.
- `db`: stores response-cache entries for weather and train data.

The removed Microsoft Todo, Bring, Strava, calendar, and OAuth routes are not mounted.

## Useful Commands

| Action | Command |
| --- | --- |
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Rebuild | `docker compose up -d --build` |
| Logs | `docker compose logs -f` |
| Wipe local DB volume | `docker compose down -v` |

## Repository Shape

```text
packages/shared/src/index.ts  Shared API types
server/src/routes             health, dashboard, weather, dev
server/src/services           weather and train services
server/src/utils              logger, HTTP client, cache, Prisma helper
client/src/components         dashboard widgets
client/src/hooks              dashboard polling hook
```

## Security Notes

- The published web port is bound to `127.0.0.1` in Docker Compose.
- The API only calls allowlisted HTTPS upstream hosts.
- Upstream responses are validated with Zod before use.
- Logs redact sensitive-looking keys at the logger boundary.
