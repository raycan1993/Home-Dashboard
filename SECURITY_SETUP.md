# Home Dashboard — Secure Deployment Guide

## Threat model (read this first)

This is a personal home dashboard running on a single Windows machine. It holds long-lived OAuth tokens for Microsoft (Tasks), Strava, and Bring, plus API keys for OpenWeather. The realistic threats are:

1. **Credential theft** — malware on the machine, accidental commit to GitHub, OneDrive cloud breach, or a backup leak exposing OAuth refresh tokens that grant ongoing access to your accounts.
2. **Lateral access from the LAN** — someone on your home Wi-Fi (guest, IoT device, compromised laptop) reaching the dashboard's HTTP port.
3. **Supply-chain compromise** — a malicious npm dependency stealing tokens or secrets at install or runtime.
4. **Account takeover via weak auth** — guessable JWT secret, replayable tokens.

Enterprise concerns like SIEM, HSMs, and zero-trust mesh are out of scope. The bar is: *don't leak tokens, don't get popped from the LAN, don't trust random npm packages*.

---

## 1. Secrets management

### Risk: secrets committed to Git

Putting `server/.env` (or hard-coded keys) into a Git commit is the #1 way home projects leak. GitHub's secret scanners catch some, but OAuth refresh tokens and self-issued JWT secrets aren't always detected. Once pushed, treat them as compromised forever — even a force-push doesn't help, since the commit lives in clones, forks, and the GitHub event log.

**Control: verified `.gitignore` + pre-commit guard.**

Confirm `.env`, `.env.*`, and `*.key` are in `.gitignore`. Then add a guard so they can't be added by accident:

```powershell
cd "C:\Users\rayca\OneDrive\Dokumente\Dev_Projects\Home_Dashboard"
npm install --save-dev --workspace-root husky lint-staged
npx husky init
```

Edit `.husky/pre-commit` to include:

```bash
git diff --cached --name-only | findstr /R "\.env$ \.env\. \.key$" && echo "Blocked: secret file" && exit 1
exit 0
```

This refuses any commit touching a `.env` or key file. *Why this works:* Git hooks run before the commit object is written, so a leaked secret never enters the repo's object store in the first place.

### Risk: secrets in plain text on disk

A `server/.env` file is plaintext. Any process running as your user — including malware that doesn't even need admin — can read it. OneDrive sync (which is where this project lives) makes it worse: the file is replicated to Microsoft's cloud and to every device signed into the same account.

**Control 1: move secrets out of the OneDrive folder.**

Keep code in OneDrive (it's nice for sync), but put `.env` outside it. Edit `server/src/index.ts` to load from a non-synced location:

```typescript
import dotenv from 'dotenv';
import path from 'path';
import os from 'os';
dotenv.config({ path: path.join(os.homedir(), '.home-dashboard', '.env') });
```

Then create the file:

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.home-dashboard"
Move-Item server\.env "$env:USERPROFILE\.home-dashboard\.env"
icacls "$env:USERPROFILE\.home-dashboard" /inheritance:r /grant:r "$env:USERNAME:(OI)(CI)F"
```

*Why this works:* the file is no longer sync'd to OneDrive's cloud, no longer captured by OneDrive backups, and the `icacls` command strips inherited ACLs and grants access only to your user — so other Windows users on the machine can't read it.

**Control 2: encrypt at rest with DPAPI for high-value secrets.**

For OAuth refresh tokens specifically, don't store them as plaintext in Postgres. Wrap with Windows DPAPI before insert:

```typescript
import { protect, unprotect } from 'win-dpapi'; // npm i win-dpapi
const enc = protect(Buffer.from(refreshToken, 'utf8'), null, 'CurrentUser');
// store enc as bytea; decrypt on read with unprotect()
```

*Why this works:* DPAPI keys are derived from your Windows login. A copy of the database file alone is useless to an attacker — they'd need to also be logged in as you on this machine. This defends against the "stolen backup" scenario.

### Risk: weak or default `JWT_SECRET`

The `.env.example` ships with a placeholder string. If anyone leaves it, every issued JWT is forgeable: an attacker mints a token claiming to be any user.

**Control: cryptographically random 256-bit secret.**

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

That's not actually cryptographic-grade — `Get-Random` isn't a CSPRNG. Use this instead:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
[Convert]::ToBase64String($bytes)
```

Paste the output as `JWT_SECRET`. *Why this works:* `RandomNumberGenerator` calls Windows' CNG (`BCryptGenRandom`), which is FIPS-validated and unguessable. 256 bits exceeds what HS256 needs and prevents brute-force attacks on the signing key.

---

## 2. Database hardening

### Risk: PostgreSQL with default password / open to the network

The `.env.example` ships with `postgres:password`. Postgres also installs listening on `*:5432` by default, meaning anyone on your LAN can attempt logins.

**Control 1: strong password and bind to localhost only.**

Set a real password during install (or `ALTER USER postgres WITH PASSWORD '...'` afterward). Then edit `postgresql.conf` (typically `C:\Program Files\PostgreSQL\16\data\postgresql.conf`):

```
listen_addresses = '127.0.0.1'
```

*Why this works:* the database accepts connections only from the same machine. A compromised IoT device on your Wi-Fi can't even *try* a password.

**Control 2: SCRAM-SHA-256 auth and a least-privilege app user.**

In `pg_hba.conf`, change `md5` to `scram-sha-256` for all entries. Create a non-superuser for the app:

```sql
CREATE USER home_dashboard_app WITH PASSWORD '<random>';
CREATE DATABASE home_dashboard OWNER home_dashboard_app;
```

Use this user (not `postgres`) in `DATABASE_URL`. *Why this works:* SCRAM resists offline cracking far better than legacy MD5. The dedicated user can't drop other databases or read other users' data, so a SQL injection (or a compromised dependency) is contained to one DB.

### Risk: SQL injection via raw queries

Prisma's query builder parameterises by default, but `prisma.$queryRawUnsafe` doesn't. A single misuse turns the `home_dashboard_app` user into an attacker's SQL shell.

**Control: lint against unsafe queries.**

Add an ESLint rule or grep guard in CI:

```powershell
npm i -D eslint-plugin-security
```

Configure `.eslintrc` to error on `no-unsanitized/method` and ban `$queryRawUnsafe`/`$executeRawUnsafe` outright unless explicitly justified. *Why this works:* the dangerous APIs become a build-break, not a code-review judgement call.

---

## 3. OAuth and external API tokens

### Risk: over-broad OAuth scopes

`Tasks.ReadWrite` on Microsoft Graph and full Strava scope let the dashboard (and anyone who steals its tokens) read/modify everything. Many apps request more than they need because the consent screens are clunky to update later.

**Control: minimum-necessary scopes.**

Microsoft: only `Tasks.ReadWrite` and `offline_access` — no `Mail.*`, `Files.*`, or `User.Read.All`. Strava: only `read,activity:read` — never `activity:write` unless the dashboard actually creates activities. Document the scope set in `server/.env.example` so future-you can't quietly widen it. *Why this works:* token theft yields only the access you originally granted. A leaked Strava read token can't delete activities.

### Risk: refresh tokens stored in plaintext

The Prisma schema almost certainly stores OAuth tokens as `String`. A backup, a misconfigured `pg_dump`, or read access to the DB hands attackers ongoing access to your linked accounts.

**Control: app-level encryption with AES-256-GCM.**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
const KEY = Buffer.from(process.env.TOKEN_ENC_KEY!, 'base64'); // 32 bytes

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}
```

Store `TOKEN_ENC_KEY` separately from `DATABASE_URL` (different `.env` section, ideally a different file). *Why this works:* GCM provides both confidentiality and integrity (the auth tag detects tampering). Without the key, the database row is useless ciphertext. Separating key from DB means a single-source compromise (just the DB dump, just the env file) is insufficient.

### Risk: tokens logged by the dev logger

`devLogger.ts` is described as "captures all in/out comms." If it logs request headers, every Microsoft Graph call writes the bearer token to disk. Log files are routinely the easiest grab for malware.

**Control: redact at the logger boundary.**

```typescript
const REDACT = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
function safeHeaders(h: Record<string,string>) {
  return Object.fromEntries(
    Object.entries(h).map(([k,v]) => REDACT.includes(k.toLowerCase()) ? [k, '***'] : [k,v])
  );
}
```

Also redact URL query strings that match `*token*`, `*key*`, `code=*`. *Why this works:* the redaction happens before the log line is formatted, so even if the log file leaks, the secrets aren't there to leak.

---

## 4. Network exposure

### Risk: dashboard exposed to LAN over plain HTTP

By default, Express on `0.0.0.0:3001` is reachable from every device on your home Wi-Fi. HTTP traffic is also readable by anything sniffing the network — your JWT cookie crosses the wire in cleartext.

**Control 1: bind to localhost.**

If you only ever view the dashboard from this PC:

```typescript
app.listen(PORT, '127.0.0.1');
```

*Why this works:* the OS kernel refuses connections to that port from any other interface. The dashboard is invisible to your LAN.

**Control 2: TLS via Caddy reverse proxy (if you want LAN access).**

If you want it on your phone too, put Caddy in front:

```
home.local {
  tls internal
  reverse_proxy 127.0.0.1:3001
}
```

Install the Caddy root cert on your phone. *Why this works:* `tls internal` makes Caddy mint a local CA and issue a cert for `home.local`. Traffic between phone and PC is encrypted; the dashboard itself only accepts requests from Caddy on localhost.

**Control 3: Windows Firewall rule.**

```powershell
New-NetFirewallRule -DisplayName "Home Dashboard - block external" `
  -Direction Inbound -Action Block -LocalPort 3001 -Protocol TCP
```

*Why this works:* defence in depth. Even if Express is misconfigured to bind on all interfaces, the firewall drops external connections before they reach Node.

### Risk: weak CORS

`CORS_ORIGIN=http://localhost:5173` is fine in dev, but a leftover wildcard or `*` in prod lets any website your browser visits issue authenticated requests against the API.

**Control: strict allowlist + credentials gate.**

```typescript
app.use(cors({
  origin: (origin, cb) => cb(null, origin === process.env.CORS_ORIGIN),
  credentials: true,
}));
```

Never `origin: '*'` when `credentials: true`. *Why this works:* CORS is browser-enforced, but a strict server-side check ensures malicious origins are rejected even if a misconfigured browser would otherwise allow them.

---

## 5. Express middleware hardening

### Risk: missing security headers

Out of the box, Express returns no `Content-Security-Policy`, no `Strict-Transport-Security`, no `X-Content-Type-Options`. A reflected-XSS bug in any view becomes a credential-stealer.

**Control: Helmet with a real CSP.**

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://api.openweathermap.org', 'https://graph.microsoft.com'],
      imgSrc: ["'self'", 'data:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind needs inline; tighten if possible
    },
  },
  hsts: { maxAge: 15552000, includeSubDomains: true },
}));
```

*Why this works:* CSP turns XSS from "game over" into "the injected script can't talk to anyone." HSTS forces the browser to only ever speak HTTPS to this origin once it's seen one valid cert.

### Risk: brute-force on login

`express-rate-limit` is in `package.json` but limits aren't applied per-route. Attackers will try 10k password guesses against `/auth/login` overnight.

**Control: tight per-route limit on auth endpoints.**

```typescript
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 5, standardHeaders: true });
app.post('/auth/login', loginLimiter, loginHandler);
```

*Why this works:* 5 attempts per 15 minutes makes online brute force infeasible (~2k years for a 6-digit PIN, longer for real passwords). Combined with bcrypt's slow hash, the math tilts heavily toward the defender.

### Risk: JWT in `localStorage`

If the frontend stores the JWT in `localStorage`, any XSS reads it instantly. JWTs are bearer tokens — possession equals access.

**Control: HttpOnly, Secure, SameSite=Strict cookie.**

```typescript
res.cookie('session', token, {
  httpOnly: true, secure: true, sameSite: 'strict',
  maxAge: 7*24*3600*1000, path: '/',
});
```

*Why this works:* `HttpOnly` makes the cookie invisible to JavaScript, defeating XSS exfiltration. `SameSite=Strict` prevents CSRF on state-changing endpoints. `Secure` ensures it's never sent over HTTP (this is why you want the Caddy step above).

---

## 6. Node.js runtime and supply chain

### Risk: malicious npm package

`event-stream`, `colors`, `ua-parser-js` — npm has had repeated incidents where popular packages were compromised and shipped credential stealers. The `postinstall` script runs with your user's permissions during `npm install` and can read every file you can.

**Control 1: disable lifecycle scripts by default.**

```powershell
npm config set ignore-scripts true
```

For packages that genuinely need their build step (Prisma, bcrypt), run them explicitly:

```powershell
npm rebuild prisma @prisma/client
```

*Why this works:* the attack window for a compromised dependency closes. Code only runs when you explicitly invoke it, not silently on every `npm install`.

**Control 2: lockfile enforcement.**

Always `npm ci` for production-style installs (it errors on lockfile drift), never `npm install`. Commit `package-lock.json`. *Why this works:* `ci` installs exactly the resolved tree from the lockfile, so a compromised registry can't substitute a malicious version of a transitive dependency.

**Control 3: regular auditing.**

```powershell
npm audit --omit=dev
```

Treat any "high" or "critical" as a blocker. Optionally add `npm-audit-resolver` or Renovate/Dependabot. *Why this works:* it's the cheapest way to catch known CVEs in your dependency tree.

### Risk: running Node as Administrator

If you launch PowerShell as admin and run `npm run dev`, every dependency at every level executes with admin rights — a single compromised package can install drivers, schedule tasks, or modify the registry.

**Control: standard user only.**

Never run the dashboard from an elevated shell. Confirm with `whoami /priv` — `SeShutdownPrivilege` should be present, `SeDebugPrivilege` should not. *Why this works:* least privilege. Even if a dependency is compromised, the blast radius is your user's files, not the operating system.

### Risk: PowerShell `RemoteSigned` execution policy

You set this earlier so `npm.ps1` could run. `RemoteSigned` allows any script that wasn't downloaded from the internet to run unsigned. Malware that drops a `.ps1` locally will execute fine.

**Control: scope it tightly, or use cmd.exe for CI-style runs.**

`RemoteSigned -Scope CurrentUser` only affects your user, not other Windows accounts on the machine. For automated/scheduled runs, use `cmd.exe` (where execution policy doesn't apply) or sign your own scripts. *Why this works:* the policy isn't a strong security boundary — it's a usability nudge — so the real defence is keeping the attack surface (your user account) free of dropped scripts via Windows Defender + standard user privileges.

---

## 7. Operational hygiene

### Risk: no patching

Node 20.x has had several CVEs since release. The OpenSSL pulled into Node has had several more. An old runtime is the same problem as an old browser.

**Control: nvm-windows + monthly bump.**

Use nvm-windows to track the latest Node 20 LTS patch:

```powershell
nvm install lts
nvm use lts
```

Calendar reminder once a month. *Why this works:* CVEs are useless to attackers as long as you're inside the patch window. The cost of `nvm install lts` is 30 seconds.

### Risk: unencrypted backups

If you back up the dashboard's Postgres dump to an external drive or cloud, the OAuth refresh tokens go with it. A lost USB stick is a token leak.

**Control: encrypted dumps.**

```powershell
pg_dump -U home_dashboard_app home_dashboard | `
  gpg --symmetric --cipher-algo AES256 -o backup-$(Get-Date -Format yyyy-MM-dd).sql.gpg
```

*Why this works:* the dump never exists on disk in plaintext form. Lose the drive, the attacker has ciphertext.

### Risk: no anomaly visibility

If a token does leak, you'll find out when Strava emails you about a bulk delete. Detection beats clean-up.

**Control: review provider audit logs monthly.**

Microsoft has [account.microsoft.com/activity](https://account.microsoft.com/activity), Strava shows recent app activity in settings. Add this to the same monthly checklist as Node updates. *Why this works:* the human-in-the-loop is fine for a personal project — you don't need a SIEM, you need 5 minutes a month.

---

## Setup sequence (security-first)

Once the project itself is fully scaffolded, the order matters:

1. Generate `JWT_SECRET` and `TOKEN_ENC_KEY` with `RandomNumberGenerator` (Section 1).
2. Move `.env` to `%USERPROFILE%\.home-dashboard\` and lock ACLs (Section 1).
3. Install Postgres, set strong password, edit `postgresql.conf` to `127.0.0.1` only, set `pg_hba.conf` to `scram-sha-256`, create least-privilege app user (Section 2).
4. Configure OAuth apps with minimum scopes; do NOT request `Mail.*`, `Files.*`, or `activity:write` (Section 3).
5. `npm config set ignore-scripts true`, then `npm ci` (Section 6).
6. `npm rebuild` only the packages that need build steps.
7. Add Helmet, strict CORS, per-route rate limits, HttpOnly cookie config to Express (Section 5).
8. Bind Express to `127.0.0.1`, add Windows Firewall block rule (Section 4).
9. (Optional) Set up Caddy with `tls internal` for phone access.
10. Add the husky pre-commit guard before any first push (Section 1).
11. Run `npm audit --omit=dev` and resolve highs.
12. Test the OAuth flows end-to-end, then verify in DB that refresh tokens are stored as ciphertext, not plaintext.

## What I deliberately skipped

- **HSM-backed JWT signing.** Overkill for one user; `aes-256-gcm` + DPAPI is appropriate.
- **mTLS between client and server.** A reverse proxy with `tls internal` is enough at home scale.
- **Vault / cloud secret manager.** Adds a paid dependency for one machine; DPAPI is the right answer here.
- **WAF.** No public exposure if you bind to localhost or use Caddy on the LAN.

If any of those become relevant — e.g., if you ever expose this past the LAN via a tunnel — revisit the threat model.
