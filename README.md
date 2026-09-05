# Flash Cup — Workers

Background cron jobs for [Flash Cup](https://github.com/UtaMarian/flashleague).
This process runs **separately** from the HTTP API: the API is stateless and
scales horizontally, the jobs must run from **exactly one instance**.

## Jobs (`src/jobs/`, started by `src/worker.js`)

| Job | Cadence | What it does |
|---|---|---|
| `matchScheduler` | every minute | simulate every `SCHEDULED` match whose kickoff has passed (`matchService.simulateDueMatches`) |
| `energyJob` | every minute | regenerate player energy (+1 per 5-min tick, capped at 100; a `FAST_ENERGY_REGEN` event shortens the interval) |
| `managerPollJob` | every minute | close manager-election polls past their 24h window and apply the result |
| `eventsJob` | every minute | advance event lifecycle by wall-clock time (`SCHEDULED → ACTIVE → ENDED`) |
| `dailyBonusJob` | — | **not started** — the daily gift is claimed manually in-app. Kept for easy re-enable. |

## How the shared code works

The jobs reuse the backend's domain logic (match simulation, event lifecycle,
manager polls, the Prisma client, the logger). Rather than reimplement it, a
slice of `flashleague-backend` is **vendored** into
`vendor/flashleague/flashleague-backend/` as plain files, and
[`src/shared.js`](src/shared.js) is the single module that reaches into it.
`npm install`'s `postinstall` runs `prisma generate` against the vendored
`prisma/schema.prisma`.

> Vendored as plain files (not a git submodule) because PaaS builders such as
> Render don't reliably clone private submodules.

> **Keep `@prisma/client` in lockstep with the backend** (`vendor/flashleague/flashleague-backend/package.json`). A mismatch breaks the generated client.

### Re-syncing the vendored backend

When `flashleague-backend` changes, refresh the copy from a checkout of the
monorepo:

```bash
rm -rf vendor/flashleague/flashleague-backend
mkdir -p vendor/flashleague/flashleague-backend
git -C /path/to/flashleague/flashleague-backend archive HEAD \
  | tar -x -C vendor/flashleague/flashleague-backend
rm -rf vendor/flashleague/flashleague-backend/prisma/migrations_sqlite_backup
git add vendor && git commit -m "Re-sync vendored backend"
```

## Local development

```bash
git clone https://github.com/UtaMarian/flashcup-workers.git
cd flashcup-workers
npm install                      # also generates the Prisma client
cp .env.example .env             # set DATABASE_URL / DIRECT_URL to the SAME db as the API
npm start                        # runs the 4 cron jobs
```

## Deployment

- CI (`.github/workflows/ci.yml`) builds and pushes `ghcr.io/utamarian/flashcup-workers:latest` on every push to `main`.
- The `flashleague` repo's `docker-compose.yml` has a `worker` service (behind the `worker` compose profile) that pulls this image:
  ```bash
  docker pull ghcr.io/utamarian/flashcup-workers:latest
  docker compose --profile worker up -d
  ```
- **Run one replica only.** `node-cron` has no leader-election; a second worker double-runs every timed action.

### Render

`render.yaml` is included. The jobs are a background process, so the natural
Render type is a **Background Worker** (paid). To use the **free Web Service**
tier instead, `src/worker.js` also binds `$PORT` with a `/` health endpoint.

Settings if creating the service by hand:

| Field | Value |
|---|---|
| Type | Web Service (free) — or Background Worker (paid, no HTTP) |
| Runtime | Node |
| Build command | `npm install` (runs `postinstall` → `prisma generate`) |
| Start command | `npm start` |
| Health check path | `/` |

Environment variables:

| Key | Value |
|---|---|
| `DATABASE_URL` | **the same database the Flash Cup API uses** — Neon's *pooled* string (`-pooler` host), with `?sslmode=require&pgbouncer=true` |
| `DIRECT_URL` | Neon's *unpooled* string. Not used at runtime here (no migrations), but the shared Prisma schema references it. Anywhere else: same value as `DATABASE_URL`. |
| `NODE_ENV` | `production` (plain JSON logs; skips `pino-pretty`) |

The vendored backend is committed in this repo, so the build needs no extra
fetch step. **Set the build command to `npm install`** (Render's Node default
is `yarn`, which ignores `package-lock.json`).

> ⚠ Render's **free** web tier spins the service down after ~15 min without
> inbound traffic, which stops the cron jobs. Keep it awake with an external
> ping to the service URL every ~10 min (e.g. cron-job.org), or use a paid
> instance (no spin-down).
