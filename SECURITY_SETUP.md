# Security Setup

This dashboard currently keeps only weather and train integrations active.
Microsoft Todo, Bring, Strava, calendar, and OAuth flows have been removed for now.

## Local Exposure

- Docker Compose binds the web port to `127.0.0.1`.
- The server and database containers publish no host ports.
- Keep it this way unless you add proper authentication before exposing it to the LAN.

## Configuration

- Keep `.env` out of git.
- Use a strong `DB_PASSWORD`.
- Prefer storing a populated server env file outside synced folders, for example `%USERPROFILE%\.home-dashboard\.env`.

## Outbound HTTP

The server uses an HTTPS-only allowlist in `server/src/utils/httpClient.ts`.
The active upstream hosts are:

- `app-prod-ws.meteoswiss-app.ch`
- `api3.geo.admin.ch`
- `transport.opendata.ch`

## Database

Postgres is used for response caching. It no longer stores OAuth tokens or provider credentials.

## Logs

The structured logger still redacts keys that look like passwords, secrets, tokens, API keys, cookies, or authorization headers before entries reach console output or the dev SSE stream.
